import { NodeAdapter } from './adapters/node';
import { Context } from './context';
import { compileSchema, validateSchema } from './validation';
import { BaseError, NotFoundError } from './errors';
import { Router, isStaticPath, joinPaths, normalizePath } from './router';
import { Events } from './events';
import { awaitMaybePromise, chain, printTraces, } from './helpers';
import { FetchAdapter } from './adapters/fetch';
import { Readable } from 'node:stream';
export class Exot {
    init;
    static createRouter(init) {
        return new Router(init);
    }
    static defaultErrorHandler(err, ctx) {
        console.error(err);
        ctx.set.status = err.statusCode || 500;
        ctx.json(err instanceof BaseError ? err : { error: err.message });
    }
    static throwNotFound() {
        throw new NotFoundError();
    }
    events;
    #adapter;
    decorators = {};
    shared = {};
    stores = {};
    #stack = [];
    #notFoundFn;
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
        const adapter = new FetchAdapter();
        adapter.mount(this);
        this.#ensureNotFoundHandler();
        return (req) => {
            return adapter.fetch(req);
        };
    }
    get prefix() {
        return this.init.prefix;
    }
    adapter(adapter) {
        this.#adapter = adapter;
        this.#adapter.mount(this);
        return this;
    }
    notFound(handler) {
        this.#notFoundFn = this.#handlerToChainFn(handler);
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
        this.#stack.push(...this.#createStack(handler));
        if (handler instanceof Exot) {
            this.events.forwardTo(handler.events);
            if (handler.prefix) {
                this.all(handler.prefix, handler);
                this.all(handler.prefix + '/*', handler);
            }
        }
        return this;
    }
    group(path, init) {
        const group = new Exot({
            ...init,
            prefix: joinPaths(this.init.prefix || '', path),
        });
        this.use(group);
        return group;
    }
    add(method, path, handler, options = {}) {
        this.#ensureRouter().add(method, joinPaths(this.init.prefix || '', path), this.#createStack(handler, options, [
            (ctx) => this.events.emit('route', ctx),
        ], [
            // always terminate routes
            (ctx) => {
                ctx.end();
            },
        ]));
        return this;
    }
    all(path, handler, options = {}) {
        this.#ensureRouter().all(
        //normalizePath([this.init.prefix, path].filter((p) => !!p).join('/')),
        joinPaths(this.init.prefix || '', path), this.#createStack(handler, options));
        return this;
    }
    delete(path, handler, options = {}) {
        return this.add('DELETE', path, handler, options);
    }
    get(path, handler, options = {}) {
        return this.add('GET', path, handler, options);
    }
    options(path, handler, options = {}) {
        return this.add('OPTIONS', path, handler, options);
    }
    patch(path, handler, options = {}) {
        return this.add('PATCH', path, handler, options);
    }
    post(path, handler, options = {}) {
        return this.add('POST', path, handler, options);
    }
    put(path, handler, options = {}) {
        return this.add('PUT', path, handler, options);
    }
    ws(path, handler) {
        if (!this.#adapter) {
            throw new Error('Adapter not set.');
        }
        this.#adapter.ws(path, handler);
        return this;
    }
    handle(ctx) {
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
        }, (err) => { throw err; }), (body) => body, (err) => {
            return chain([
                () => this.errorHandler(err, ctx),
                () => this.events.emit('error', ctx),
            ], ctx);
        });
    }
    onHandler(handler) {
        this.events.on('handler', handler);
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
    context(req) {
        const ctx = new Context(req, {}, this.shared, Object.assign({}, this.stores), this.init.tracing);
        Object.assign(ctx, this.decorators);
        return ctx;
    }
    close() {
        return this.#ensureAdapter().close();
    }
    async listen(port = 0) {
        this.#ensureNotFoundHandler();
        return this.#ensureAdapter().listen(port);
    }
    #ensureNotFoundHandler() {
        if (!this.#notFoundFn) {
            this.#notFoundFn = Exot.throwNotFound;
        }
    }
    #ensureAdapter(defaultAdapter = NodeAdapter) {
        if (!this.#adapter) {
            this.adapter(new defaultAdapter());
        }
        return this.#adapter;
    }
    #ensureRouter() {
        const last = this.#stack[this.#stack.length - 1];
        if (last?.['_router'] instanceof Router) {
            return last['_router'];
        }
        const router = Exot.createRouter(this.init.router);
        this.#stack.push(...this.#createStack(router));
        return router;
    }
    #createStack(handler, options = {}, before = [], after = []) {
        const stack = [
            (ctx) => this.events.emit('handler', ctx),
            ...before,
        ];
        const responseSchema = options.response ? compileSchema(options.response) : void 0;
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
        stack.push(this.#handlerToChainFn(handler), (ctx) => {
            if (responseSchema) {
                validateSchema(responseSchema, ctx.set.body, 'response');
            }
        }, ...after);
        return stack;
    }
    #handlerToChainFn(handler) {
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
    #setReponseBody(ctx, body) {
        const type = typeof body;
        if (body && type === 'object' && !(body instanceof ReadableStream || body instanceof Readable)) {
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
