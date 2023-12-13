import { type TSchema, Static } from '@sinclair/typebox';
import {
  AnyRecord,
  MergeParams,
  ErrorHandler,
  RouterInit,
  ExotInit,
  Adapter,
  WsHandler,
  StackHandler,
  AnyStackHandlerOptions,
  StackHandlerOptions,
  RouterFindResult,
  TraceHandler,
  ChainFn,
  MaybePromise,
  ContextInterface,
} from './types';
import { NodeAdapter } from './adapters/node';
import { Context } from './context';
import { compileSchema, validateSchema } from './validation';
import { BaseError, NotFoundError } from './errors';
import { Router, isStaticPath, joinPaths, normalizePath } from './router';
import { Events } from './events';
import {
  awaitMaybePromise,
  chain,
  printTraces,
} from './helpers';
import { FetchAdapter } from './adapters/fetch';
import type { HTTPMethod } from 'find-my-way';
import { Readable } from 'node:stream';

export class Exot<
  Decorators extends AnyRecord = {},
  Shared extends AnyRecord = {},
  Store extends AnyRecord = {},
  LocalContext extends ContextInterface = ContextInterface<
    any,
    any,
    any,
    any,
    Shared,
    Store
    > & Decorators,
> {
  static createRouter(init?: RouterInit): Router {
    return new Router(init);
  }

  static defaultErrorHandler(err: any, ctx: Context) {
    console.error(err)
    ctx.set.status = err.statusCode || 500;
    ctx.json(err instanceof BaseError ? err : { error: err.message });
  }

  static throwNotFound() {
    throw new NotFoundError();
  }

  readonly events: Events<LocalContext>;

  #adapter?: Adapter;

  readonly decorators: Decorators = {} as Decorators;

  readonly shared: Shared = {} as Shared;

  readonly stores: Store = {} as Store;

  readonly #stack: ChainFn<LocalContext>[] = [];

  #notFoundFn?: ChainFn<LocalContext>;

  #traceHandler?: TraceHandler<LocalContext>;

  errorHandler: ErrorHandler<LocalContext> = Exot.defaultErrorHandler;

  constructor(readonly init: ExotInit = {}) {
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
    const adapter = new FetchAdapter();
    adapter.mount(this as Exot<any, any, any, any>);
    this.#ensureNotFoundHandler();
    return (req: Request): MaybePromise<Response> => {
      return adapter.fetch(req);
    };
  }

  get prefix() {
    return this.init.prefix;
  }

  adapter<UseAdapter extends Adapter>(
    adapter: UseAdapter
  ): UseAdapter extends Adapter
    ? Exot<Decorators, Shared, Store, LocalContext>
    : this;

  adapter<UseAdapter extends Adapter>(adapter: UseAdapter) {
    this.#adapter = adapter;
    this.#adapter.mount(this);
    return this;
  }

  notFound<NewExot extends Exot<any, any, any, any> = this>(
    handler: NewExot
  ): NewExot extends Exot<infer UseDecorators, infer UseShared>
    ? Exot<Decorators & UseDecorators, Shared & UseShared>
    : this;

  notFound(handler: StackHandler<LocalContext>): this;

  notFound<
    const Params extends TSchema,
    const Body extends TSchema,
    const Query extends TSchema,
    const Response extends TSchema
  >(
    plugin: StackHandler<LocalContext>,
    options: StackHandlerOptions<Params, Body, Query, Response, Store>
  ): this;

  notFound(handler: StackHandler<LocalContext>) {
    this.#notFoundFn = this.#handlerToChainFn(handler);
    return this;
  }

  trace(handler: TraceHandler<LocalContext>) {
    this.#traceHandler = handler;
    return this;
  }

  decorate<const Name extends string, const Value>(
    name: Name,
    value: Value
  ): Exot<
    Decorators & { [name in Name]: Value },
    Shared,
    Store
  >;

  decorate<const Object extends AnyRecord>(
    object: Object
  ): Exot<Decorators & Object, Shared, Store>;

  decorate(
    name: string | AnyRecord,
    value?: any
  ): Exot<any, Shared, Store> {
    if (typeof name === 'object') {
      Object.assign(this.decorators, name);
    } else {
      this.decorators[name as keyof Decorators] = value as any;
    }
    return this;
  }

  error(errorHandler: ErrorHandler<LocalContext>) {
    this.errorHandler = errorHandler;
  }

  store<const Name extends string, const Value>(
    name: Name,
    value: Value
  ): Exot<
    Decorators,
    Shared,
    Store & { [name in Name]: Value },
    LocalContext
  >;

  store<const Object extends AnyRecord>(
    object: Object
  ): Exot<Decorators, Shared, Store & Object, LocalContext>;

  store(name: string | AnyRecord, value?: any) {
    if (typeof name === 'object') {
      Object.assign(this.stores, name);
    } else {
      this.stores[name as keyof Store] = value as any;
    }
    return this;
  }

  share<const Name extends string, const Value>(
    name: Name,
    value: Value
  ): Exot<
    Decorators,
    Shared & { [name in Name]: Value },
    Store,
    LocalContext
  >;

  share<const Object extends AnyRecord>(
    object: Object
  ): Exot<Decorators, Shared & Object, Store, LocalContext>;

  share(name: string | AnyRecord, value?: any) {
    if (typeof name === 'object') {
      Object.assign(this.shared, name);
    } else {
      this.shared[name as keyof Shared] = value as any;
    }
    return this;
  }

  use<NewExot extends Exot<any, any, any, any> = this>(
    handler: NewExot
  ): NewExot extends Exot<infer UseDecorators, infer UseShared, infer UseStore>
    ? Exot<
        Decorators & UseDecorators,
        Shared & UseShared,
        Store & UseStore
      >
    : this;

  use(handler: StackHandler<LocalContext>): this;

  use(handler: StackHandler<LocalContext>) {
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

  group<const Path extends string>(path: Path, init?: ExotInit) {
    const group = new Exot<
      Decorators,
      Shared,
      Store,
      LocalContext
    >({
      ...init,
      prefix: joinPaths(this.init.prefix || '', path),
    });
    this.use(group);
    return group;
  }

  add<
    const Path extends string,
    const Params extends TSchema,
    const Body extends TSchema,
    const Query extends TSchema,
    const Response extends TSchema,
    const NewContext extends ContextInterface = ContextInterface<
      MergeParams<Path, Params>,
      Static<Body>,
      AnyRecord & Static<Query>,
      Static<Response>,
      Shared,
      Store
    > &
      Decorators
  >(
    method: HTTPMethod,
    path: Path,
    handler: StackHandler<NewContext>,
    options?: StackHandlerOptions<Params, Body, Query, Response, Store>
  ): this;
  add(
    method: HTTPMethod,
    path: string,
    handler: StackHandler<LocalContext>,
    options: AnyStackHandlerOptions = {}
  ) {
    this.#ensureRouter().add(
      method,
      joinPaths(this.init.prefix || '', path),
      this.#createStack(
        handler,
        options,
        [
          (ctx) => this.events.emit('route', ctx),
        ],
        [
          // always terminate routes
          (ctx) => {
            ctx.end()
          },
        ]
      )
    );
    return this;
  }

  all<
    const Path extends string,
    const Params extends TSchema,
    const Body extends TSchema,
    const Query extends TSchema,
    const Response extends TSchema,
    const NewContext extends ContextInterface = ContextInterface<
      MergeParams<Path, Params>,
      Static<Body>,
      AnyRecord & Static<Query>,
      Static<Response>,
      Shared,
      Store
    > &
      Decorators
  >(
    path: Path,
    handler: StackHandler<NewContext>,
    options?: StackHandlerOptions<Params, Body, Query, Response, Store>
  ): this;
  all(
    path: string,
    handler: StackHandler<LocalContext>,
    options: AnyStackHandlerOptions = {}
  ) {
    this.#ensureRouter().all(
      //normalizePath([this.init.prefix, path].filter((p) => !!p).join('/')),
      joinPaths(this.init.prefix || '', path),
      this.#createStack(handler, options)
    );
    return this;
  }

  delete<
    const Path extends string,
    const Params extends TSchema,
    const Body extends TSchema,
    const Query extends TSchema,
    const Response extends TSchema,
    const NewContext extends ContextInterface = ContextInterface<
      MergeParams<Path, Params>,
      Static<Body>,
      AnyRecord & Static<Query>,
      Static<Response>,
      Shared,
      Store
    > &
      Decorators
  >(
    path: Path,
    handler: StackHandler<NewContext>,
    options?: StackHandlerOptions<Params, Body, Query, Response, Store>
  ): this;
  delete(
    path: string,
    handler: StackHandler<LocalContext>,
    options: AnyStackHandlerOptions = {}
  ) {
    return this.add('DELETE', path, handler, options);
  }

  get<
    const Path extends string,
    const Params extends TSchema,
    const Body extends TSchema,
    const Query extends TSchema,
    const Response extends TSchema,
    const NewContext extends ContextInterface = ContextInterface<
      MergeParams<Path, Params>,
      Static<Body>,
      AnyRecord & Static<Query>,
      Static<Response>,
      Shared,
      Store
    > &
      Decorators
  >(
    path: Path,
    handler: StackHandler<NewContext>,
    options?: StackHandlerOptions<Params, Body, Query, Response, Store>
  ): this;
  get(
    path: string,
    handler: StackHandler<LocalContext>,
    options: AnyStackHandlerOptions = {}
  ) {
    return this.add('GET', path, handler, options);
  }

  options<
    const Path extends string,
    const Params extends TSchema,
    const Body extends TSchema,
    const Query extends TSchema,
    const Response extends TSchema,
    const NewContext extends ContextInterface = ContextInterface<
      MergeParams<Path, Params>,
      Static<Body>,
      AnyRecord & Static<Query>,
      Static<Response>,
      Shared,
      Store
    > &
      Decorators
  >(
    path: Path,
    handler: StackHandler<NewContext>,
    options?: StackHandlerOptions<Params, Body, Query, Response, Store>
  ): this;
  options(
    path: string,
    handler: StackHandler<LocalContext>,
    options: AnyStackHandlerOptions = {}
  ) {
    return this.add('OPTIONS', path, handler, options);
  }

  patch<
    const Path extends string,
    const Params extends TSchema,
    const Body extends TSchema,
    const Query extends TSchema,
    const Response extends TSchema,
    const NewContext extends ContextInterface = ContextInterface<
      MergeParams<Path, Params>,
      Static<Body>,
      AnyRecord & Static<Query>,
      Static<Response>,
      Shared,
      Store
    > &
      Decorators
  >(
    path: Path,
    handler: StackHandler<NewContext>,
    options?: StackHandlerOptions<Params, Body, Query, Response, Store>
  ): this;
  patch(
    path: string,
    handler: StackHandler<LocalContext>,
    options: AnyStackHandlerOptions = {}
  ) {
    return this.add('PATCH', path, handler, options);
  }

  post<
    const Path extends string,
    const Params extends TSchema,
    const Body extends TSchema,
    const Query extends TSchema,
    const Response extends TSchema,
    const NewContext extends ContextInterface = ContextInterface<
      MergeParams<Path, Params>,
      Static<Body>,
      AnyRecord & Static<Query>,
      Static<Response>,
      Shared,
      Store
    > &
      Decorators
  >(
    path: Path,
    handler: StackHandler<NewContext>,
    options?: StackHandlerOptions<Params, Body, Query, Response, Store>
  ): this;
  post(
    path: string,
    handler: StackHandler<LocalContext>,
    options: AnyStackHandlerOptions = {}
  ) {
    return this.add('POST', path, handler, options);
  }

  put<
    const Path extends string,
    const Params extends TSchema,
    const Body extends TSchema,
    const Query extends TSchema,
    const Response extends TSchema,
    const NewContext extends ContextInterface = ContextInterface<
      MergeParams<Path, Params>,
      Static<Body>,
      AnyRecord & Static<Query>,
      Static<Response>,
      Shared,
      Store
    > &
      Decorators
  >(
    path: Path,
    handler: StackHandler<NewContext>,
    options?: StackHandlerOptions<Params, Body, Query, Response, Store>
  ): this;
  put(
    path: string,
    handler: StackHandler<LocalContext>,
    options: AnyStackHandlerOptions = {}
  ) {
    return this.add('PUT', path, handler, options);
  }

  ws(path: string, handler: WsHandler<any>) {
    if (!this.#adapter) {
      throw new Error('Adapter not set.');
    }
    this.#adapter.ws(path, handler);
    return this;
  }
  
  handle(ctx: LocalContext): MaybePromise<unknown> {
    return awaitMaybePromise(
      () => awaitMaybePromise(
        () => chain([
          () => this.events.emit('request', ctx),
          () =>
            chain(
              this.#stack,
              ctx,
            ),
        ]),
        (body) => {
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
        },
        (err) => { throw err },
      ), 
      (body) => body,
      (err) => {
        return chain([
          () => this.errorHandler(err, ctx),
          () => this.events.emit('error', ctx),
        ], ctx)
      },
    );
  }

  onHandler(handler: StackHandler<LocalContext>) {
    this.events.on('handler', handler);
    return this;
  }

  onRequest(handler: StackHandler<LocalContext>) {
    this.events.on('request', handler);
    return this;
  }

  onResponse(handler: StackHandler<LocalContext>) {
    this.events.on('response', handler);
    return this;
  }

  onRoute(handler: StackHandler<LocalContext>) {
    this.events.on('route', handler);
    return this;
  }

  context(req: Request): LocalContext {
    const ctx = new Context(
      req,
      {},
      this.shared,
      Object.assign({}, this.stores),
      this.init.tracing
    );
    Object.assign(ctx, this.decorators);
    return ctx as LocalContext;
  }

  close() {
    return this.#ensureAdapter().close();
  }

  async listen(port: number = 0): Promise<number> {
    this.#ensureNotFoundHandler();
    return this.#ensureAdapter().listen(port);
  }

  #ensureNotFoundHandler() {
    if (!this.#notFoundFn) {
      this.#notFoundFn = Exot.throwNotFound;
    }
  }

  #ensureAdapter(
    defaultAdapter: new () => Adapter = NodeAdapter
  ) {
    if (!this.#adapter) {
      this.adapter(new defaultAdapter());
    }
    return this.#adapter!;
  }

  #ensureRouter(): Router {
    const last = this.#stack[this.#stack.length - 1] as ChainFn & {
      _router?: Router;
    };
    if (last?.['_router'] instanceof Router) {
      return last['_router'] as Router;
    }
    const router = Exot.createRouter(this.init.router);
    this.#stack.push(...this.#createStack(router));
    return router;
  }

  #createStack(
    handler: StackHandler<LocalContext>,
    options: AnyStackHandlerOptions = {},
    before: ChainFn<LocalContext>[] = [],
    after: ChainFn<LocalContext>[] = []
  ) {
    const stack: ChainFn<LocalContext>[] = [
      (ctx: LocalContext) => this.events.emit('handler', ctx),
      ...before,
    ];
    const responseSchema = options.response ? compileSchema(options.response) : void 0;
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
    stack.push(
      this.#handlerToChainFn(handler),
      (ctx) => {
        if (responseSchema) {
          validateSchema(responseSchema, ctx.set.body, 'response');
        }
      },
      ...after,
    );
    return stack;
  }

  #handlerToChainFn(handler: StackHandler<LocalContext>) {
    if (handler instanceof Exot) {
      return (ctx: LocalContext) => handler.handle(ctx);
    } else if (handler instanceof Router) {
      const fn = (ctx: LocalContext) => {
        const route = ctx._trace(
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

  #setReponseBody(ctx: LocalContext, body: any) {
    const type = typeof body;
    if (body && type === 'object' && !(body instanceof ReadableStream || body instanceof Readable)) {
      ctx.json(body);
    } else if (type === 'string') {
      ctx.text(body);
    } else if (body !== void 0 && body !== null) {
      ctx.set.body = body;
    }
  }
}
