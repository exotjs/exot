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
        ctx.res.status = err.statusCode || 500;
        ctx.json(err instanceof BaseError ? err : { error: err.message }, false);
    }
    static throwNotFound() {
        throw new NotFoundError();
    }
    decorators = {};
    events;
    stores = {};
    pubsub = new PubSub();
    prefix;
    #adapter;
    #composed = false;
    #handlers = [];
    #notFoundHandler;
    #stack = [];
    #traceHandler;
    errorHandler = Exot.defaultErrorHandler;
    constructor(init = {}) {
        this.init = init;
        this.prefix = init.prefix;
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
            this.compose();
        }
        this.#ensureNotFoundHandler();
        return (req, ...args) => {
            return adapter.fetch(req, ...args);
        };
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
    get websocket() {
        return this.#adapter?.websocket;
    }
    adapter(adapter) {
        this.#adapter = adapter;
        this.#adapter.mount(this);
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
    store(name, value) {
        if (typeof name === 'object') {
            Object.assign(this.stores, name);
        }
        else {
            this.stores[name] = value;
        }
        return this;
    }
    use(...args) {
        let path = void 0;
        let handler = () => { };
        let options = {};
        if (typeof args[0] === 'string' && args[1]) {
            path = args[0];
            handler = args[1];
            options = args[2];
        }
        else {
            handler = args[0];
            options = args[1];
        }
        this.#handlers.push({
            path,
            handler,
            options: { ...this.init.handlerOptions, ...options },
        });
        if (handler instanceof Exot || this.#isExotCompatible(handler)) {
            // merge decorators and stores
            if ('decorators' in handler) {
                Object.assign(this.decorators, handler.decorators);
            }
            if ('stores' in handler) {
                Object.assign(this.stores, handler.stores);
            }
            if (path && 'init' in handler) {
                handler.prefix = path;
            }
            if ('prefix' in handler) {
                const prefix = handler.prefix;
                this.all(prefix, handler);
                this.all(prefix + '/*', handler);
            }
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
    handle(ctx, options = {}) {
        if (!this.#composed) {
            this.compose();
        }
        return awaitMaybePromise(() => awaitMaybePromise(() => chain([
            () => options.emitEvents ? this.events.emit('request', ctx) : void 0,
            () => chain(this.#stack, ctx),
        ]), (body) => {
            if (body !== void 0) {
                this.#setReponseBody(ctx, body);
                ctx.end();
            }
            return chain([
                () => {
                    if (!ctx.terminated && this.#notFoundHandler) {
                        return this.#notFoundHandler(ctx);
                    }
                },
                () => options.emitEvents ? this.events.emit('response', ctx) : void 0,
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
                () => options.emitEvents ? this.events.emit('error', ctx) : void 0,
                () => options.useErrorHandler === false ? void 0 : this.errorHandler(err, ctx),
            ], ctx);
        });
    }
    onError(errorHandler) {
        this.errorHandler = errorHandler;
    }
    notFound(handler) {
        this.#notFoundHandler = this.#createHandlerFn(handler);
        return this;
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
    onStart(handler) {
        this.events.on('start', handler);
        return this;
    }
    context(req) {
        const ctx = new Context({
            pubsub: this.pubsub,
            req,
            store: Object.assign({}, this.stores),
            tracingEnabled: this.init.tracing,
        });
        Object.assign(ctx, this.decorators);
        return ctx;
    }
    close() {
        return this.#ensureAdapter().close();
    }
    async listen(port = 0) {
        if (!this.#composed) {
            this.compose();
        }
        this.#ensureNotFoundHandler();
        const boundPort = await this.#ensureAdapter().listen(port);
        await this.events.emit('start', boundPort);
        return boundPort;
    }
    compose(parent) {
        if (!this.#composed) {
            if (parent) {
                // forward events from the parent
                parent.events.forwardTo(this.events);
            }
            for (let { method, path, handler, options } of this.#handlers) {
                if (path) {
                    path = joinPaths(parent?.init.prefix || '', this.init.prefix || '', path);
                    const stack = this.#composeHandler(handler, options, [
                        (ctx) => this.events.emit('route', ctx),
                    ], [
                        // always terminate routes
                        (ctx) => {
                            ctx.end();
                        },
                    ]);
                    let router = this.#ensureRouter();
                    if (router.has(method || 'GET', path)) {
                        router = this.#ensureRouter(true);
                    }
                    if (method) {
                        router.add(method, path, stack);
                    }
                    else {
                        router.all(path, stack);
                    }
                }
                else {
                    // other handlers
                    this.#stack.push(...this.#composeHandler(handler));
                }
                if (handler instanceof Exot || this.#isExotCompatible(handler)) {
                    handler.compose(this);
                }
            }
            this.#composed = true;
            if (this.init.onComposed) {
                this.init.onComposed(parent);
            }
        }
    }
    #composeHandler(handler, options = {}, before = [], after = []) {
        const stack = [
            (ctx) => ctx.terminated ? null : void 0,
            ...before,
        ];
        if (options.transform) {
            stack.push((ctx) => options.transform(ctx));
        }
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
        if (handler instanceof Exot || this.#isExotCompatible(handler)) {
            return (ctx) => handler.handle(ctx, {
                emitEvents: false,
                useErrorHandler: false,
            });
        }
        else if (handler instanceof Router) {
            const fn = (ctx) => {
                const route = ctx.trace(() => handler.find(ctx.method, ctx.path), '@router:find', this.init.name);
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
        if (!this.#notFoundHandler) {
            this.#notFoundHandler = Exot.throwNotFound;
        }
    }
    #ensureRouter(createNew = false) {
        if (!createNew) {
            const last = this.#stack[this.#stack.length - 1];
            if (last?.['_router'] instanceof Router) {
                return last['_router'];
            }
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
            ctx.res.body = body;
        }
    }
    #isExotCompatible(inst) {
        // @ts-expect-error
        return inst && 'handle' in inst && typeof inst['handle'] === 'function';
    }
}
