import { type TSchema, Static } from '@sinclair/typebox';
import { AnyRecord, MergeParams, ErrorHandler, RouterInit, ExotInit, Adapter, StackHandler, StackHandlerOptions, TraceHandler, MaybePromise, ContextInterface, WebSocketHandler, RouteParams, EventHandler, HandleOptions } from './types.js';
import { Router } from './router.js';
import { Events } from './events.js';
import { PubSub } from './pubsub.js';
import type { HTTPMethod } from 'find-my-way';
export declare class Exot<Decorators extends AnyRecord = {}, Store extends AnyRecord = {}, HandlerOptions extends AnyRecord = {}, Params extends AnyRecord = {}, LocalContext extends ContextInterface = ContextInterface<Params, any, any, any, Store> & Decorators> {
    #private;
    readonly init: ExotInit<HandlerOptions>;
    static createRouter(init?: RouterInit): Router;
    static defaultErrorHandler(err: any, ctx: ContextInterface): void;
    static throwNotFound(): void;
    readonly decorators: Decorators;
    readonly events: Events<LocalContext>;
    readonly stores: Store;
    readonly pubsub: PubSub;
    prefix?: string;
    errorHandler: ErrorHandler<LocalContext>;
    constructor(init?: ExotInit<HandlerOptions>);
    get fetch(): (req: Request, ...args: unknown[]) => MaybePromise<Response>;
    get routes(): any[];
    get websocket(): any;
    adapter<UseAdapter extends Adapter>(adapter: UseAdapter): UseAdapter extends Adapter ? Exot<Decorators, Store, LocalContext> : this;
    trace(handler: TraceHandler<LocalContext>): this;
    decorate<const Name extends string, const Value>(name: Name, value: Value): Exot<Decorators & {
        [name in Name]: Value;
    }, Store>;
    decorate<const Object extends AnyRecord>(object: Object): Exot<Decorators & Object, Store>;
    store<const Name extends string, const Value>(name: Name, value: Value): Exot<Decorators, Store & {
        [name in Name]: Value;
    }>;
    store<const Object extends AnyRecord>(object: Object): Exot<Decorators, Store & Object>;
    use<const Path extends string, const LocalParams extends TSchema, const Body extends TSchema, const Query extends TSchema, const Response extends TSchema, const NewContext extends ContextInterface = ContextInterface<Params & MergeParams<Path, LocalParams>, Static<Body>, AnyRecord & Static<Query>, Static<Response>, Store> & Decorators>(path: Path, handler: StackHandler<NewContext>, options?: StackHandlerOptions<LocalParams, Body, Query, Response, Store> & HandlerOptions): this;
    use<const Path extends string, const LocaleParams extends TSchema, const Body extends TSchema, const Query extends TSchema, const Response extends TSchema, const NewContext extends ContextInterface = ContextInterface<Params & MergeParams<Path, LocaleParams>, Static<Body>, AnyRecord & Static<Query>, Static<Response>, Store> & Decorators, const NewExot extends Exot<any, any> = this>(path: Path, handler: NewExot, options?: StackHandlerOptions<LocaleParams, Body, Query, Response, Store> & HandlerOptions): NewExot extends Exot<infer UseDecorators, infer UseStore, infer UseHandlerOptions> ? Exot<Decorators & UseDecorators, Store & UseStore, HandlerOptions & UseHandlerOptions> : this;
    use<const NewExot extends Exot<any, any> = this>(handler: NewExot): NewExot extends Exot<infer UseDecorators, infer UseStore, infer UseHandlerOptions> ? Exot<Decorators & UseDecorators, Store & UseStore, HandlerOptions & UseHandlerOptions> : this;
    use(handler: StackHandler<LocalContext>): this;
    group<const Path extends string>(path: Path, init?: ExotInit<HandlerOptions>): Exot<Decorators, Store, RouteParams<Path>, HandlerOptions, ContextInterface<HandlerOptions, any, any, any, Store> & Decorators>;
    add<const Path extends string, const LocalParams extends TSchema, const Body extends TSchema, const Query extends TSchema, const Response extends TSchema, const NewContext extends ContextInterface = ContextInterface<Params & MergeParams<Path, LocalParams>, Static<Body>, AnyRecord & Static<Query>, Static<Response>, Store> & Decorators>(method: HTTPMethod, path: Path, handler: StackHandler<NewContext>, options?: StackHandlerOptions<LocalParams, Body, Query, Response, Store> & HandlerOptions): this;
    all<const Path extends string, const LocalParams extends TSchema, const Body extends TSchema, const Query extends TSchema, const Response extends TSchema, const NewContext extends ContextInterface = ContextInterface<Params & MergeParams<Path, LocalParams>, Static<Body>, AnyRecord & Static<Query>, Static<Response>, Store> & Decorators>(path: Path, handler: StackHandler<NewContext>, options?: StackHandlerOptions<LocalParams, Body, Query, Response, Store> & HandlerOptions): this;
    delete<const Path extends string, const LocalParams extends TSchema, const Body extends TSchema, const Query extends TSchema, const Response extends TSchema, const NewContext extends ContextInterface = ContextInterface<Params & MergeParams<Path, LocalParams>, Static<Body>, AnyRecord & Static<Query>, Static<Response>, Store> & Decorators>(path: Path, handler: StackHandler<NewContext>, options?: StackHandlerOptions<LocalParams, Body, Query, Response, Store> & HandlerOptions): this;
    get<const Path extends string, const LocalParams extends TSchema, const Body extends TSchema, const Query extends TSchema, const Response extends TSchema, const NewContext extends ContextInterface = ContextInterface<Params & MergeParams<Path, LocalParams>, Static<Body>, AnyRecord & Static<Query>, Static<Response>, Store> & Decorators>(path: Path, handler: StackHandler<NewContext>, options?: StackHandlerOptions<LocalParams, Body, Query, Response, Store> & HandlerOptions): this;
    patch<const Path extends string, const LocalParams extends TSchema, const Body extends TSchema, const Query extends TSchema, const Response extends TSchema, const NewContext extends ContextInterface = ContextInterface<Params & MergeParams<Path, LocalParams>, Static<Body>, AnyRecord & Static<Query>, Static<Response>, Store> & Decorators>(path: Path, handler: StackHandler<NewContext>, options?: StackHandlerOptions<LocalParams, Body, Query, Response, Store> & HandlerOptions): this;
    post<const Path extends string, const LocalParams extends TSchema, const Body extends TSchema, const Query extends TSchema, const Response extends TSchema, const NewContext extends ContextInterface = ContextInterface<Params & MergeParams<Path, LocalParams>, Static<Body>, AnyRecord & Static<Query>, Static<Response>, Store> & Decorators>(path: Path, handler: StackHandler<NewContext>, options?: StackHandlerOptions<LocalParams, Body, Query, Response, Store> & HandlerOptions): this;
    put<const Path extends string, const LocalParams extends TSchema, const Body extends TSchema, const Query extends TSchema, const Response extends TSchema, const NewContext extends ContextInterface = ContextInterface<Params & MergeParams<Path, LocalParams>, Static<Body>, AnyRecord & Static<Query>, Static<Response>, Store> & Decorators>(path: Path, handler: StackHandler<NewContext>, options?: StackHandlerOptions<LocalParams, Body, Query, Response, Store> & HandlerOptions): this;
    ws<UserData = any>(path: string, handler: WebSocketHandler<UserData>): this;
    handle(ctx: LocalContext, options?: HandleOptions): MaybePromise<unknown>;
    onError(errorHandler: ErrorHandler<LocalContext>): void;
    notFound<NewExot extends Exot<any, any> = this>(handler: NewExot): NewExot extends Exot<infer UseDecorators> ? Exot<Decorators & UseDecorators> : this;
    notFound(handler: StackHandler<LocalContext>): this;
    onRequest(handler: EventHandler<LocalContext>): this;
    onResponse(handler: EventHandler<LocalContext>): this;
    onRoute(handler: EventHandler<LocalContext>): this;
    onStart(handler: EventHandler<number>): this;
    context(req: Request): LocalContext;
    close(): Promise<void>;
    listen(port?: number): Promise<number>;
    compose(parent?: Exot<any, any, any, any>): void;
}
