import { Readable } from 'node:stream';
import { type TSchema, Static } from '@sinclair/typebox';
import {
  AnyRecord,
  MergeParams,
  ErrorHandler,
  RouterInit,
  ExotInit,
  Adapter,
  StackHandler,
  AnyStackHandlerOptions,
  StackHandlerOptions,
  RouterFindResult,
  TraceHandler,
  ChainFn,
  MaybePromise,
  ContextInterface,
  WebSocketHandler,
  RouteParams,
  EventHandler,
  HandleOptions,
} from './types.js';
import { Context } from './context.js';
import { compileSchema, validateSchema } from './validation.js';
import { BaseError, NotFoundError } from './errors.js';
import { Router, isStaticPath, joinPaths, normalizePath } from './router.js';
import { Events } from './events.js';
import { awaitMaybePromise, chain, printTraces } from './helpers.js';
import { getAutoAdapter } from './adapters/auto.js';
import { FetchAdapter } from './adapters/fetch.js';
import { PubSub } from './pubsub.js';
import type { HTTPMethod } from 'find-my-way';

export class Exot<
  Decorators extends AnyRecord = {},
  Store extends AnyRecord = {},
  HandlerOptions extends AnyRecord = {},
  Params extends AnyRecord = {},
  LocalContext extends ContextInterface = ContextInterface<
    Params,
    any,
    any,
    any,
    Store
  > & Decorators
> {
  static createRouter(init?: RouterInit): Router {
    return new Router(init);
  }

  static defaultErrorHandler(err: any, ctx: ContextInterface) {
    ctx.res.status = err.statusCode || 500;
    ctx.json(err instanceof BaseError ? err : { error: err.message }, false);
  }

  static throwNotFound() {
    throw new NotFoundError();
  }

  readonly decorators: Decorators = {} as Decorators;

  readonly events: Events<LocalContext>;

  readonly stores: Store = {} as Store;

  readonly pubsub = new PubSub();

  prefix?: string;

  #adapter?: Adapter;

  #composed: boolean = false;

  #handlers: {
    method?: HTTPMethod;
    path?: string;
    handler: StackHandler<LocalContext> | WebSocketHandler<any>;
    options?: AnyStackHandlerOptions;
    websocket?: boolean;
  }[] = [];

  #notFoundHandler?: ChainFn<LocalContext>;

  #stack: ChainFn<LocalContext>[] = [];

  #traceHandler?: TraceHandler<LocalContext>;

  errorHandler: ErrorHandler<LocalContext> = Exot.defaultErrorHandler;

  constructor(readonly init: ExotInit<HandlerOptions> = {}) {
    this.prefix = init.prefix;
    this.events = new Events<LocalContext>(this.init.name);
    if (init.tracing) {
      this.trace((ctx) => printTraces(ctx));
    }
    if (init.prefix) {
      if (!isStaticPath(init.prefix)) {
        throw new Error(
          "Parameter 'prefix' must be a static path without named parameters."
        );
      }
      this.init.prefix = normalizePath(init.prefix);
    }
  }

  get fetch() {
    const adapter = this.#ensureAdapter(getAutoAdapter(FetchAdapter));
    if (!this.#composed) {
      this.compose();
    }
    this.#ensureNotFoundHandler();
    return (req: Request, ...args: unknown[]): MaybePromise<Response> => {
      return adapter.fetch(req, ...args);
    };
  }

  get routes() {
    const routes: any[] = [];
    for (let { handler, method, path, options } of this.#handlers) {
      if (path) {
        routes.push({
          method,
          path,
          options,
          instance: this,
        });
      } else if (handler instanceof Exot) {
        routes.push(...handler.routes);
      }
    }
    return routes;
  }

  get websocket() {
    // @ts-expect-error
    return this.#adapter?.websocket;
  }

  adapter<UseAdapter extends Adapter>(
    adapter: UseAdapter
  ): UseAdapter extends Adapter
    ? Exot<Decorators, Store, LocalContext>
    : this;

  adapter<UseAdapter extends Adapter>(adapter: UseAdapter) {
    this.#adapter = adapter;
    this.#adapter.mount(this);
    return this;
  }

  trace(handler: TraceHandler<LocalContext>) {
    this.#traceHandler = handler;
    return this;
  }

  decorate<const Name extends string, const Value>(
    name: Name,
    value: Value
  ): Exot<Decorators & { [name in Name]: Value }, Store>;

  decorate<const Object extends AnyRecord>(
    object: Object
  ): Exot<Decorators & Object, Store>;

  decorate(name: string | AnyRecord, value?: any): Exot<any, Store> {
    if (typeof name === 'object') {
      Object.assign(this.decorators, name);
    } else {
      this.decorators[name as keyof Decorators] = value as any;
    }
    return this;
  }

  store<const Name extends string, const Value>(
    name: Name,
    value: Value
  ): Exot<Decorators, Store & { [name in Name]: Value }>;

  store<const Object extends AnyRecord>(
    object: Object
  ): Exot<Decorators, Store & Object>;

  store(name: string | AnyRecord, value?: any): Exot<any, Store> {
    if (typeof name === 'object') {
      Object.assign(this.stores, name);
    } else {
      this.stores[name as keyof Store] = value as any;
    }
    return this;
  }

  use<
    const Path extends string,
    const LocalParams extends TSchema,
    const Body extends TSchema,
    const Query extends TSchema,
    const Response extends TSchema,
    const NewContext extends ContextInterface = ContextInterface<
      Params & MergeParams<Path, LocalParams>,
      Static<Body>,
      AnyRecord & Static<Query>,
      Static<Response>,
      Store
    > &
      Decorators
  >(
    path: Path,
    handler: StackHandler<NewContext>,
    options?: StackHandlerOptions<LocalParams, Body, Query, Response, Store> & HandlerOptions
  ): this;

  use<
    const Path extends string,
    const LocaleParams extends TSchema,
    const Body extends TSchema,
    const Query extends TSchema,
    const Response extends TSchema,
    const NewContext extends ContextInterface = ContextInterface<
      Params & MergeParams<Path, LocaleParams>,
      Static<Body>,
      AnyRecord & Static<Query>,
      Static<Response>,
      Store
    > &
      Decorators,
    const NewExot extends Exot<any, any> = this
  >(
    path: Path,
    handler: NewExot,
    options?: StackHandlerOptions<LocaleParams, Body, Query, Response, Store> & HandlerOptions
  ): NewExot extends Exot<infer UseDecorators, infer UseStore, infer UseHandlerOptions>
    ? Exot<Decorators & UseDecorators, Store & UseStore, HandlerOptions & UseHandlerOptions>
    : this;

  use<
    const NewExot extends Exot<any, any> = this
  >(
    handler: NewExot
  ): NewExot extends Exot<infer UseDecorators, infer UseStore, infer UseHandlerOptions>
    ? Exot<Decorators & UseDecorators, Store & UseStore, HandlerOptions & UseHandlerOptions>
    : this;

  use(handler: StackHandler<LocalContext>): this;

  use(
    ...args: unknown[]
  ) {
    let path: string | undefined = void 0;
    let handler: StackHandler<LocalContext> = () => {};
    let options: AnyStackHandlerOptions = {};
    if (typeof args[0] === 'string' && args[1]) {
      path = args[0];
      handler = args[1] as StackHandler<LocalContext>;
      options = args[2] as AnyStackHandlerOptions;
    } else {
      handler = args[0] as StackHandler<LocalContext>;
      options = args[1] as AnyStackHandlerOptions;
    }
    this.#handlers.push({
      path,
      handler,
      options: {...this.init.handlerOptions, ...options},
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
        (handler as Exot).prefix = path;
      }
      if ('prefix' in handler) {
        const prefix = handler.prefix as string;
        this.all(prefix, handler);
        this.all(prefix + '/*', handler);
      }
    }
    return this;
  }

  group<
    const Path extends string,
  >(path: Path, init?: ExotInit<HandlerOptions>) {
    const group = new Exot<Decorators, Store, RouteParams<Path>, HandlerOptions>({
      ...init,
      prefix: path,
    });
    this.use(group);
    return group;
  }

  add<
    const Path extends string,
    const LocalParams extends TSchema,
    const Body extends TSchema,
    const Query extends TSchema,
    const Response extends TSchema,
    const NewContext extends ContextInterface = ContextInterface<
      Params & MergeParams<Path, LocalParams>,
      Static<Body>,
      AnyRecord & Static<Query>,
      Static<Response>,
      Store
    > &
      Decorators
  >(
    method: HTTPMethod,
    path: Path,
    handler: StackHandler<NewContext>,
    options?: StackHandlerOptions<LocalParams, Body, Query, Response, Store> & HandlerOptions
  ): this;
  add(
    method: HTTPMethod,
    path: string,
    handler: StackHandler<LocalContext>,
    options?: AnyStackHandlerOptions & HandlerOptions,
  ) {
    this.#handlers.push({
      method,
      path,
      handler,
      options: {...this.init.handlerOptions, ...options},
    });
    return this;
  }

  all<
    const Path extends string,
    const LocalParams extends TSchema,
    const Body extends TSchema,
    const Query extends TSchema,
    const Response extends TSchema,
    const NewContext extends ContextInterface = ContextInterface<
      Params & MergeParams<Path, LocalParams>,
      Static<Body>,
      AnyRecord & Static<Query>,
      Static<Response>,
      Store
    > &
      Decorators
  >(
    path: Path,
    handler: StackHandler<NewContext>,
    options?: StackHandlerOptions<LocalParams, Body, Query, Response, Store> & HandlerOptions
  ): this;
  all(
    path: string,
    handler: StackHandler<LocalContext>,
    options: AnyStackHandlerOptions = {}
  ) {
    this.#handlers.push({
      path,
      handler,
      options: {...this.init.handlerOptions, ...options},
    });
    return this;
  }

  delete<
    const Path extends string,
    const LocalParams extends TSchema,
    const Body extends TSchema,
    const Query extends TSchema,
    const Response extends TSchema,
    const NewContext extends ContextInterface = ContextInterface<
      Params & MergeParams<Path, LocalParams>,
      Static<Body>,
      AnyRecord & Static<Query>,
      Static<Response>,
      Store
    > &
      Decorators
  >(
    path: Path,
    handler: StackHandler<NewContext>,
    options?: StackHandlerOptions<LocalParams, Body, Query, Response, Store> & HandlerOptions
  ): this;
  delete(
    path: string,
    handler: StackHandler<LocalContext>,
    options?: AnyStackHandlerOptions & HandlerOptions,
  ) {
    return this.add('DELETE', path, handler, options);
  }

  get<
    const Path extends string,
    const LocalParams extends TSchema,
    const Body extends TSchema,
    const Query extends TSchema,
    const Response extends TSchema,
    const NewContext extends ContextInterface = ContextInterface<
      Params & MergeParams<Path, LocalParams>,
      Static<Body>,
      AnyRecord & Static<Query>,
      Static<Response>,
      Store
    > &
      Decorators
  >(
    path: Path,
    handler: StackHandler<NewContext>,
    options?: StackHandlerOptions<LocalParams, Body, Query, Response, Store> & HandlerOptions
  ): this;
  get(
    path: string,
    handler: StackHandler<LocalContext>,
    options?: AnyStackHandlerOptions & HandlerOptions
  ) {
    return this.add('GET', path, handler, options);
  }

  patch<
    const Path extends string,
    const LocalParams extends TSchema,
    const Body extends TSchema,
    const Query extends TSchema,
    const Response extends TSchema,
    const NewContext extends ContextInterface = ContextInterface<
      Params & MergeParams<Path, LocalParams>,
      Static<Body>,
      AnyRecord & Static<Query>,
      Static<Response>,
      Store
    > &
      Decorators
  >(
    path: Path,
    handler: StackHandler<NewContext>,
    options?: StackHandlerOptions<LocalParams, Body, Query, Response, Store> & HandlerOptions
  ): this;
  patch(
    path: string,
    handler: StackHandler<LocalContext>,
    options?: AnyStackHandlerOptions & HandlerOptions
  ) {
    return this.add('PATCH', path, handler, options);
  }

  post<
    const Path extends string,
    const LocalParams extends TSchema,
    const Body extends TSchema,
    const Query extends TSchema,
    const Response extends TSchema,
    const NewContext extends ContextInterface = ContextInterface<
      Params & MergeParams<Path, LocalParams>,
      Static<Body>,
      AnyRecord & Static<Query>,
      Static<Response>,
      Store
    > &
      Decorators
  >(
    path: Path,
    handler: StackHandler<NewContext>,
    options?: StackHandlerOptions<LocalParams, Body, Query, Response, Store> & HandlerOptions
  ): this;
  post(
    path: string,
    handler: StackHandler<LocalContext>,
    options?: AnyStackHandlerOptions & HandlerOptions
  ) {
    return this.add('POST', path, handler, options);
  }

  put<
    const Path extends string,
    const LocalParams extends TSchema,
    const Body extends TSchema,
    const Query extends TSchema,
    const Response extends TSchema,
    const NewContext extends ContextInterface = ContextInterface<
      Params & MergeParams<Path, LocalParams>,
      Static<Body>,
      AnyRecord & Static<Query>,
      Static<Response>,
      Store
    > &
      Decorators
  >(
    path: Path,
    handler: StackHandler<NewContext>,
    options?: StackHandlerOptions<LocalParams, Body, Query, Response, Store> & HandlerOptions
  ): this;
  put(
    path: string,
    handler: StackHandler<LocalContext>,
    options?: AnyStackHandlerOptions & HandlerOptions
  ) {
    return this.add('PUT', path, handler, options);
  }

  ws(path: string, handler: WebSocketHandler<LocalContext>) {
    this.#handlers.push({
      path,
      handler,
      websocket: true,
    });
    return this;
  }

  handle(ctx: LocalContext, options: HandleOptions = {}): MaybePromise<unknown> {
    if (!this.#composed) {
      this.compose();
    }
    return awaitMaybePromise(
      () =>
        awaitMaybePromise(
          () =>
            chain([
              () => options.emitEvents ? this.events.emit('request', ctx) : void 0,
              () => chain(this.#stack, ctx),
            ]),
          (body) => {
            if (body !== void 0) {
              this.#setReponseBody(ctx, body);
              ctx.end();
            }
            return chain(
              [
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
              ],
              ctx
            );
          },
          (err) => {
            throw err;
          }
        ),
      (body) => body,
      (err) => {
        return chain(
          [
            () => options.emitEvents ? this.events.emit('error', ctx) : void 0,
            () => options.useErrorHandler === false ? void 0 : this.errorHandler(err, ctx),
          ],
          ctx
        );
      }
    );
  }

  onError(errorHandler: ErrorHandler<LocalContext>) {
    this.errorHandler = errorHandler;
  }

  notFound<NewExot extends Exot<any, any> = this>(
    handler: NewExot
  ): NewExot extends Exot<infer UseDecorators>
    ? Exot<Decorators & UseDecorators>
    : this;
  notFound(handler: StackHandler<LocalContext>): this;
  notFound(handler: StackHandler<LocalContext>) {
    this.#notFoundHandler = this.#createHandlerFn(handler);
    return this;
  }

  onRequest(handler: EventHandler<LocalContext>) {
    this.events.on('request', handler);
    return this;
  }

  onResponse(handler: EventHandler<LocalContext>) {
    this.events.on('response', handler);
    return this;
  }

  onRoute(handler: EventHandler<LocalContext>) {
    this.events.on('route', handler);
    return this;
  }

  onStart(handler: EventHandler<number>) {
    this.events.on('start', handler);
    return this;
  }

  context(req: Request): LocalContext {
    const ctx = new Context({
      pubsub: this.pubsub,
      req,
      store: Object.assign({}, this.stores),
      tracingEnabled: this.init.tracing,
    });
    Object.assign(ctx, this.decorators);
    return ctx as LocalContext;
  }

  close() {
    return this.#ensureAdapter().close();
  }

  async listen(port: number = 0): Promise<number> {
    if (!this.#composed) {
      this.compose();
    }
    this.#ensureNotFoundHandler();
    const boundPort = await this.#ensureAdapter().listen(port);
    await this.events.emit('start', boundPort);
    return boundPort;
  }

  compose(parent?: Exot<any, any, any, any>) {
    if (!this.#composed) {
      if (!parent) {
        this.#ensureAdapter();
      } else {
        this.#adapter = parent.#adapter;
      }
      if (parent) {
        // forward events from the parent
        parent.events.forwardTo(this.events);
      }
      for (let { method, path, handler, options, websocket } of this.#handlers) {
        if (path) {
          path = joinPaths(
            parent?.init.prefix || '',
            this.init.prefix || '',
            path
          );
          const stack = this.#composeHandler(
            handler,
            options,
            [
              (ctx) => this.events.emit('route', ctx),
            ],
            [
              // always terminate routes
              (ctx) => {
                ctx.end();

              },
            ],
            websocket
          );
          let router = this.#ensureRouter();
          if (router.has(method || 'GET', path)) {
            if (websocket) {
              throw new Error(`Route ${path} is already mounted and cannot be used for websockets.`);
            }
            router = this.#ensureRouter(true);
          }
          if (method) {
            router.add(method, path, stack);
          } else {
            router.all(path, stack);
          }
        } else {
          // other handlers
          this.#stack.push(...this.#composeHandler(handler, options, [], [], websocket));
        }
        if (handler instanceof Exot || this.#isExotCompatible(handler)) {
          (handler as Exot<any, any, any, LocalContext>).compose(this);
        }
      }
      this.#composed = true;
      if (this.init.onComposed) {
        this.init.onComposed(parent);
      }
    }
  }

  #composeHandler(
    handler: StackHandler<LocalContext> | WebSocketHandler<any>,
    options: AnyStackHandlerOptions = {},
    before: ChainFn<LocalContext>[] = [],
    after: ChainFn<LocalContext>[] = [],
    websocket?: boolean,
  ) {
    const stack: ChainFn<LocalContext>[] = [
      (ctx) => ctx.terminated ? null : void 0,
      ...before,
    ];
    if (options.transform) {
      stack.push((ctx: LocalContext) => options.transform!(ctx));
    }
    if (options.params) {
      const paramsSchema = compileSchema(options.params);
      stack.push((ctx: LocalContext) =>
        validateSchema(paramsSchema, ctx.params, 'params')
      );
    }
    if (options.query) {
      const querySchema = compileSchema(options.query);
      stack.push((ctx: LocalContext) =>
        validateSchema(querySchema, ctx.query, 'query')
      );
    }
    if (options.body) {
      const bodySchema = compileSchema(options.body);
      stack.push((ctx: LocalContext) => {
        ctx.bodySchema = bodySchema;
      });
    }
    if (options.response) {
      const responseSchema = compileSchema(options.response);
      stack.push((ctx: LocalContext) => {
        ctx.responseSchema = responseSchema;
      });
    }
    if (websocket) {
      stack.push(
        (ctx: LocalContext) => this.#adapter?.upgradeRequest(ctx, handler as WebSocketHandler<any>),
        ...after
      );
    } else {
      stack.push(
        this.#createHandlerFn(handler as StackHandler<LocalContext>),
        ...after
      );
    }
    return stack;
  }

  #createHandlerFn(handler: StackHandler<LocalContext>) {
    if (handler instanceof Exot || this.#isExotCompatible(handler)) {
      return (ctx: LocalContext) => (handler as Exot<any, any, any, LocalContext>).handle(ctx, {
        emitEvents: false,
        useErrorHandler: false,
      });
    } else if (handler instanceof Router) {
      const fn = (ctx: LocalContext) => {
        const route = ctx.trace(
          () => handler.find(ctx.method, ctx.path),
          '@router:find',
          this.init.name
        ) as RouterFindResult | null;
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

  #ensureAdapter(defaultAdapter: new () => Adapter = getAutoAdapter()) {
    if (!this.#adapter) {
      this.adapter(new defaultAdapter());
    }
    return this.#adapter!;
  }

  #ensureNotFoundHandler() {
    if (!this.#notFoundHandler) {
      this.#notFoundHandler = Exot.throwNotFound;
    }
  }

  #ensureRouter(createNew: boolean = false): Router {
    if (!createNew) {
      const last = this.#stack[this.#stack.length - 1] as ChainFn & {
        _router?: Router;
      };
      if (last?.['_router'] instanceof Router) {
        return last['_router'] as Router;
      }
    }
    const router = Exot.createRouter(this.init.router);
    this.#stack.push(...this.#composeHandler(router));
    return router;
  }

  #setReponseBody(ctx: LocalContext, body: any) {
    const type = typeof body;
    if (
      body &&
      type === 'object' &&
      !(body instanceof Response || body instanceof ReadableStream || body instanceof Readable)
    ) {
      ctx.json(body);
    } else if (type === 'string') {
      ctx.text(body);
    } else if (body !== void 0 && body !== null) {
      ctx.res.body = body;
    }
  }

  #isExotCompatible(inst: unknown) {
    // @ts-expect-error
    return inst && 'handle' in inst && typeof inst['handle'] === 'function';
  }
}
