import { Readable } from 'node:stream';
import { NodeAdapter } from './adapters/node';
import { Context } from './context';
import { compileSchema, validateSchema } from './validation';
import { BaseError, NotFoundError } from './errors';
import { Router, isStaticPath, joinPaths, normalizePath } from './router';
import { Events } from './events';
import { awaitMaybePromise, chain, printTraces } from './helpers';
import { BunAdapter } from './adapters/bun';
import { FetchAdapter } from './adapters/fetch';
import { PubSub } from './pubsub';
import { RUNTIME } from './env';
export class Exot {
    init;
    static createRouter(init) {
        return new Router(init);
    }
    static defaultErrorHandler(err, ctx) {
        ctx.set.status = err.statusCode || 500;
        ctx.json(err instanceof BaseError ? err : { error: err.message }, false);
    }
    static throwNotFound() {
        throw new NotFoundError();
    }
    decorators = {};
    events;
    shared = {};
    stores = {};
    pubsub = new PubSub();
    #adapter;
    #composed = false;
    #handlers = [];
    #notFoundFn;
    #stack = [];
    #traceHandler;
    errorHandler = Exot.defaultErrorHandler;
    constructor(init = {}) {
        this.init = init;
        this.events = new Events(this.init.name);
        if (init.tracing) {
            this.trace((ctx) => printTraces(ctx));
        }
        if (init.prefix) {
            if (!isStaticPath(init.prefix)) {
                throw new Error("Parameter 'prefix' must be a static path without named parameters.");
            }
            this.init.prefix = normalizePath(init.prefix);
        }
    }
    get fetch() {
        const adapter = this.#ensureAdapter(RUNTIME === 'bun' ? BunAdapter : FetchAdapter);
        if (!this.#composed) {
            this.#compose();
        }
        this.#ensureNotFoundHandler();
        return (req, ...args) => {
            return adapter.fetch(req, ...args);
        };
    }
    get prefix() {
        return this.init.prefix;
    }
    get routes() {
        const routes = [];
        for (let { handler, method, path, options } of this.#handlers) {
            if (path) {
                routes.push({
                    method,
                    path,
                    options,
                    instance: this,
                });
            }
            else if (handler instanceof Exot) {
                routes.push(...handler.routes);
            }
        }
        return routes;
    }
    adapter(adapter) {
        this.#adapter = adapter;
        this.#adapter.mount(this);
        return this;
    }
    notFound(handler) {
        this.#notFoundFn = this.#createHandlerFn(handler);
        return this;
    }
    trace(handler) {
        this.#traceHandler = handler;
        return this;
    }
    decorate(name, value) {
        if (typeof name === 'object') {
            Object.assign(this.decorators, name);
        }
        else {
            this.decorators[name] = value;
        }
        return this;
    }
    error(errorHandler) {
        this.errorHandler = errorHandler;
    }
    store(name, value) {
        if (typeof name === 'object') {
            Object.assign(this.stores, name);
        }
        else {
            this.stores[name] = value;
        }
        return this;
    }
    share(name, value) {
        if (typeof name === 'object') {
            Object.assign(this.shared, name);
        }
        else {
            this.shared[name] = value;
        }
        return this;
    }
    use(handler) {
        this.#handlers.push({
            handler,
        });
        if (handler instanceof Exot && handler.prefix) {
            this.all(handler.prefix, handler);
            this.all(handler.prefix + '/*', handler);
        }
        return this;
    }
    group(path, init) {
        const group = new Exot({
            ...init,
            prefix: path,
        });
        this.use(group);
        return group;
    }
    add(method, path, handler, options) {
        this.#handlers.push({
            method,
            path,
            handler,
            options: { ...this.init.handlerOptions, ...options },
        });
        return this;
    }
    all(path, handler, options = {}) {
        this.#handlers.push({
            path,
            handler,
            options: { ...this.init.handlerOptions, ...options },
        });
        return this;
    }
    delete(path, handler, options) {
        return this.add('DELETE', path, handler, options);
    }
    get(path, handler, options) {
        return this.add('GET', path, handler, options);
    }
    options(path, handler, options) {
        return this.add('OPTIONS', path, handler, options);
    }
    patch(path, handler, options) {
        return this.add('PATCH', path, handler, options);
    }
    post(path, handler, options) {
        return this.add('POST', path, handler, options);
    }
    put(path, handler, options) {
        return this.add('PUT', path, handler, options);
    }
    ws(path, handler) {
        this.#ensureAdapter().ws(path, handler);
        return this;
    }
    handle(ctx) {
        if (!this.#composed) {
            this.#compose();
        }
        return awaitMaybePromise(() => awaitMaybePromise(() => chain([
            () => this.events.emit('request', ctx),
            () => chain(this.#stack, ctx),
        ]), (body) => {
            if (body !== void 0) {
                this.#setReponseBody(ctx, body);
                ctx.end();
            }
            return chain([
                () => {
                    if (!ctx.terminated && this.#notFoundFn) {
                        return this.#notFoundFn(ctx);
                    }
                },
                () => this.events.emit('response', ctx),
                () => {
                    if (this.#traceHandler) {
                        return this.#traceHandler(ctx);
                    }
                },
                () => body,
            ], ctx);
        }, (err) => {
            throw err;
        }), (body) => body, (err) => {
            return chain([
                () => this.errorHandler(err, ctx),
                () => this.events.emit('error', ctx),
            ], ctx);
        });
    }
    onRequest(handler) {
        this.events.on('request', handler);
        return this;
    }
    onResponse(handler) {
        this.events.on('response', handler);
        return this;
    }
    onRoute(handler) {
        this.events.on('route', handler);
        return this;
    }
    context(req) {
        const ctx = new Context(req, {}, this.shared, Object.assign({}, this.stores), this.init.tracing);
        ctx.pubsub = this.pubsub;
        Object.assign(ctx, this.decorators);
        return ctx;
    }
    close() {
        return this.#ensureAdapter().close();
    }
    async listen(port = 0) {
        if (!this.#composed) {
            this.#compose();
        }
        this.#ensureNotFoundHandler();
        return this.#ensureAdapter().listen(port);
    }
    #compose(parent) {
        if (this.#composed) {
            throw new Error('Instance has been already composed.');
        }
        if (parent) {
            // forward events from the parent
            parent.events.forwardTo(this.events);
        }
        for (let { method, path, handler, options } of this.#handlers) {
            if (path) {
                path = joinPaths(parent?.init.prefix || '', this.init.prefix || '', path);
                const stack = this.#composeHandler(handler, options, [(ctx) => this.events.emit('route', ctx)], [
                    // always terminate routes
                    (ctx) => {
                        ctx.end();
                    },
                ]);
                if (method) {
                    this.#ensureRouter().add(method, path, stack);
                }
                else {
                    this.#ensureRouter().all(path, stack);
                }
            }
            else {
                // other handlers
                this.#stack.push(...this.#composeHandler(handler));
            }
            if (handler instanceof Exot && !handler.#composed) {
                handler.#compose(this);
            }
        }
        this.#composed = true;
        if (this.init.onComposed) {
            this.init.onComposed(parent);
        }
    }
    #composeHandler(handler, options = {}, before = [], after = []) {
        const stack = [
            ...before,
        ];
        if (options.params) {
            const paramsSchema = compileSchema(options.params);
            stack.push((ctx) => validateSchema(paramsSchema, ctx.params, 'params'));
        }
        if (options.query) {
            const querySchema = compileSchema(options.query);
            stack.push((ctx) => validateSchema(querySchema, ctx.query, 'query'));
        }
        if (options.body) {
            const bodySchema = compileSchema(options.body);
            stack.push((ctx) => {
                ctx.bodySchema = bodySchema;
            });
        }
        if (options.response) {
            const responseSchema = compileSchema(options.response);
            stack.push((ctx) => {
                ctx.responseSchema = responseSchema;
            });
        }
        stack.push(this.#createHandlerFn(handler), ...after);
        return stack;
    }
    #createHandlerFn(handler) {
        if (handler instanceof Exot) {
            return (ctx) => handler.handle(ctx);
        }
        else if (handler instanceof Router) {
            const fn = (ctx) => {
                const route = ctx._trace(() => handler.find(ctx.method, ctx.path), '@router:find', this.init.name);
                if (route?.stack) {
                    Object.assign(ctx.params, route.params);
                    ctx.route = route.route || '/';
                    return chain(route.stack, ctx);
                }
            };
            fn['_router'] = handler;
            return fn;
        }
        return handler;
    }
    #ensureAdapter(defaultAdapter = RUNTIME === 'bun' ? BunAdapter : NodeAdapter) {
        if (!this.#adapter) {
            this.adapter(new defaultAdapter());
        }
        return this.#adapter;
    }
    #ensureNotFoundHandler() {
        if (!this.#notFoundFn) {
            this.#notFoundFn = Exot.throwNotFound;
        }
    }
    #ensureRouter() {
        const last = this.#stack[this.#stack.length - 1];
        if (last?.['_router'] instanceof Router) {
            return last['_router'];
        }
        const router = Exot.createRouter(this.init.router);
        this.#stack.push(...this.#composeHandler(router));
        return router;
    }
    #setReponseBody(ctx, body) {
        const type = typeof body;
        if (body &&
            type === 'object' &&
            !(body instanceof ReadableStream || body instanceof Readable)) {
            ctx.json(body);
        }
        else if (type === 'string') {
            ctx.text(body);
        }
        else if (body !== void 0 && body !== null) {
            ctx.set.body = body;
        }
    }
}
