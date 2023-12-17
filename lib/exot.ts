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
} from './types';
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
import type { HTTPMethod } from 'find-my-way';

export class Exot<
  Decorators extends AnyRecord = {},
  Shared extends AnyRecord = {},
  Store extends AnyRecord = {},
  HandlerOptions extends AnyRecord = {},
  LocalContext extends ContextInterface = ContextInterface<
    any,
    any,
    any,
    any,
    Shared,
    Store
  > &
    Decorators
> {
  static createRouter(init?: RouterInit): Router {
    return new Router(init);
  }

  static defaultErrorHandler(err: any, ctx: Context) {
    ctx.set.status = err.statusCode || 500;
    ctx.json(err instanceof BaseError ? err : { error: err.message }, false);
  }

  static throwNotFound() {
    throw new NotFoundError();
  }

  readonly decorators: Decorators = {} as Decorators;

  readonly events: Events<LocalContext>;

  readonly shared: Shared = {} as Shared;

  readonly stores: Store = {} as Store;

  readonly pubsub = new PubSub();

  #adapter?: Adapter;

  #composed: boolean = false;

  #handlers: {
    method?: HTTPMethod;
    path?: string;
    handler: StackHandler<LocalContext>;
    options?: AnyStackHandlerOptions;
  }[] = [];

  #notFoundFn?: ChainFn<LocalContext>;

  #stack: ChainFn<LocalContext>[] = [];

  #traceHandler?: TraceHandler<LocalContext>;

  errorHandler: ErrorHandler<LocalContext> = Exot.defaultErrorHandler;

  constructor(readonly init: ExotInit<HandlerOptions> = {}) {
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
    const adapter = this.#ensureAdapter(RUNTIME === 'bun' ? BunAdapter : FetchAdapter);
    if (!this.#composed) {
      this.#compose();
    }
    this.#ensureNotFoundHandler();
    return (req: Request, ...args: unknown[]): MaybePromise<Response> => {
      return adapter.fetch(req, ...args);
    };
  }

  get prefix() {
    return this.init.prefix;
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
    this.#notFoundFn = this.#createHandlerFn(handler);
    return this;
  }

  trace(handler: TraceHandler<LocalContext>) {
    this.#traceHandler = handler;
    return this;
  }

  decorate<const Name extends string, const Value>(
    name: Name,
    value: Value
  ): Exot<Decorators & { [name in Name]: Value }, Shared, Store>;

  decorate<const Object extends AnyRecord>(
    object: Object
  ): Exot<Decorators & Object, Shared, Store>;

  decorate(name: string | AnyRecord, value?: any): Exot<any, Shared, Store> {
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
  ): Exot<Decorators, Shared, Store & { [name in Name]: Value }>;

  store<const Object extends AnyRecord>(
    object: Object
  ): Exot<Decorators, Shared, Store & Object>;

  store(name: string | AnyRecord, value?: any): Exot<any, Shared, Store> {
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
  ): Exot<Decorators, Shared & { [name in Name]: Value }, Store>;

  share<const Object extends AnyRecord>(
    object: Object
  ): Exot<Decorators, Shared & Object, Store>;

  share(name: string | AnyRecord, value?: any): Exot<any, Shared, Store> {
    if (typeof name === 'object') {
      Object.assign(this.shared, name);
    } else {
      this.shared[name as keyof Shared] = value as any;
    }
    return this;
  }

  use<NewExot extends Exot<any, any, any, any> = this>(
    handler: NewExot
  ): NewExot extends Exot<infer UseDecorators, infer UseShared, infer UseStore, infer UseHandlerOptions>
    ? Exot<Decorators & UseDecorators, Shared & UseShared, Store & UseStore, HandlerOptions & UseHandlerOptions>
    : this;

  use(handler: StackHandler<LocalContext>): this;

  use(handler: StackHandler<LocalContext>) {
    this.#handlers.push({
      handler,
    });
    if (handler instanceof Exot && handler.prefix) {
      this.all(handler.prefix, handler);
      this.all(handler.prefix + '/*', handler);
    }
    return this;
  }

  group<const Path extends string>(path: Path, init?: ExotInit<HandlerOptions>) {
    const group = new Exot<Decorators, Shared, Store, HandlerOptions, LocalContext>({
      ...init,
      prefix: path,
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
    options?: StackHandlerOptions<Params, Body, Query, Response, Store> & HandlerOptions
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
    options?: StackHandlerOptions<Params, Body, Query, Response, Store> & HandlerOptions
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
    options?: StackHandlerOptions<Params, Body, Query, Response, Store> & HandlerOptions
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
    options?: StackHandlerOptions<Params, Body, Query, Response, Store> & HandlerOptions
  ): this;
  get(
    path: string,
    handler: StackHandler<LocalContext>,
    options?: AnyStackHandlerOptions & HandlerOptions
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
    options?: StackHandlerOptions<Params, Body, Query, Response, Store> & HandlerOptions
  ): this;
  options(
    path: string,
    handler: StackHandler<LocalContext>,
    options?: AnyStackHandlerOptions & HandlerOptions
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
    options?: StackHandlerOptions<Params, Body, Query, Response, Store> & HandlerOptions
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
    options?: StackHandlerOptions<Params, Body, Query, Response, Store> & HandlerOptions
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
    options?: StackHandlerOptions<Params, Body, Query, Response, Store> & HandlerOptions
  ): this;
  put(
    path: string,
    handler: StackHandler<LocalContext>,
    options?: AnyStackHandlerOptions & HandlerOptions
  ) {
    return this.add('PUT', path, handler, options);
  }

  ws<UserData = any>(path: string, handler: WebSocketHandler<UserData>) {
    this.#ensureAdapter().ws(path, handler);
    return this;
  }

  handle(ctx: LocalContext): MaybePromise<unknown> {
    if (!this.#composed) {
      this.#compose();
    }
    return awaitMaybePromise(
      () =>
        awaitMaybePromise(
          () =>
            chain([
              () => this.events.emit('request', ctx),
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
            () => this.errorHandler(err, ctx),
            () => this.events.emit('error', ctx),
          ],
          ctx
        );
      }
    );
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
    ctx.pubsub = this.pubsub;
    Object.assign(ctx, this.decorators);
    return ctx as LocalContext;
  }

  close() {
    return this.#ensureAdapter().close();
  }

  async listen(port: number = 0): Promise<number> {
    if (!this.#composed) {
      this.#compose();
    }
    this.#ensureNotFoundHandler();
    return this.#ensureAdapter().listen(port);
  }

  #compose(parent?: Exot<any, any, any, any>) {
    if (this.#composed) {
      throw new Error('Instance has been already composed.');
    }
    if (parent) {
      // forward events from the parent
      parent.events.forwardTo(this.events);
    }
    for (let { method, path, handler, options } of this.#handlers) {
      if (path) {
        path = joinPaths(
          parent?.init.prefix || '',
          this.init.prefix || '',
          path
        );
        const stack = this.#composeHandler(
          handler,
          options,
          [(ctx) => this.events.emit('route', ctx)],
          [
            // always terminate routes
            (ctx) => {
              ctx.end();
            },
          ]
        );
        if (method) {
          this.#ensureRouter().add(method, path, stack);
        } else {
          this.#ensureRouter().all(path, stack);
        }
      } else {
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

  #composeHandler(
    handler: StackHandler<LocalContext>,
    options: AnyStackHandlerOptions = {},
    before: ChainFn<LocalContext>[] = [],
    after: ChainFn<LocalContext>[] = []
  ) {
    const stack: ChainFn<LocalContext>[] = [
      ...before,
    ];
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
    stack.push(
      this.#createHandlerFn(handler),
      ...after
    );
    return stack;
  }

  #createHandlerFn(handler: StackHandler<LocalContext>) {
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

  #ensureAdapter(defaultAdapter: new () => Adapter = RUNTIME === 'bun' ? BunAdapter : NodeAdapter) {
    if (!this.#adapter) {
      this.adapter(new defaultAdapter());
    }
    return this.#adapter!;
  }

  #ensureNotFoundHandler() {
    if (!this.#notFoundFn) {
      this.#notFoundFn = Exot.throwNotFound;
    }
  }

  #ensureRouter(): Router {
    const last = this.#stack[this.#stack.length - 1] as ChainFn & {
      _router?: Router;
    };
    if (last?.['_router'] instanceof Router) {
      return last['_router'] as Router;
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
      !(body instanceof ReadableStream || body instanceof Readable)
    ) {
      ctx.json(body);
    } else if (type === 'string') {
      ctx.text(body);
    } else if (body !== void 0 && body !== null) {
      ctx.set.body = body;
    }
  }
}
