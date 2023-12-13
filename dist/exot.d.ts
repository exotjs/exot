import { type TSchema, Static } from '@sinclair/typebox';
import { AnyRecord, MergeParams, ErrorHandler, RouterInit, ExotInit, Adapter, WsHandler, StackHandler, StackHandlerOptions, TraceHandler, MaybePromise, ContextInterface } from './types';
import { Context } from './context';
import { Router } from './router';
import { Events } from './events';
import type { HTTPMethod } from 'find-my-way';
export declare class Exot<Decorators extends AnyRecord = {}, Shared extends AnyRecord = {}, Store extends AnyRecord = {}, LocalContext extends ContextInterface = ContextInterface<any, any, any, any, Shared, Store> & Decorators> {
    #private;
    readonly init: ExotInit;
    static createRouter(init?: RouterInit): Router;
    static defaultErrorHandler(err: any, ctx: Context): void;
    static throwNotFound(): void;
    readonly events: Events<LocalContext>;
    readonly decorators: Decorators;
    readonly shared: Shared;
    readonly stores: Store;
    errorHandler: ErrorHandler<LocalContext>;
    constructor(init?: ExotInit);
    get fetch(): (req: Request) => MaybePromise<Response>;
    get prefix(): string | undefined;
    adapter<UseAdapter extends Adapter>(adapter: UseAdapter): UseAdapter extends Adapter ? Exot<Decorators, Shared, Store, LocalContext> : this;
    notFound<NewExot extends Exot<any, any, any, any> = this>(handler: NewExot): NewExot extends Exot<infer UseDecorators, infer UseShared> ? Exot<Decorators & UseDecorators, Shared & UseShared> : this;
    notFound(handler: StackHandler<LocalContext>): this;
    notFound<const Params extends TSchema, const Body extends TSchema, const Query extends TSchema, const Response extends TSchema>(plugin: StackHandler<LocalContext>, options: StackHandlerOptions<Params, Body, Query, Response, Store>): this;
    trace(handler: TraceHandler<LocalContext>): this;
    decorate<const Name extends string, const Value>(name: Name, value: Value): Exot<Decorators & {
        [name in Name]: Value;
    }, Shared, Store>;
    decorate<const Object extends AnyRecord>(object: Object): Exot<Decorators & Object, Shared, Store>;
    error(errorHandler: ErrorHandler<LocalContext>): void;
    store<const Name extends string, const Value>(name: Name, value: Value): Exot<Decorators, Shared, Store & {
        [name in Name]: Value;
    }, LocalContext>;
    store<const Object extends AnyRecord>(object: Object): Exot<Decorators, Shared, Store & Object, LocalContext>;
    share<const Name extends string, const Value>(name: Name, value: Value): Exot<Decorators, Shared & {
        [name in Name]: Value;
    }, Store, LocalContext>;
    share<const Object extends AnyRecord>(object: Object): Exot<Decorators, Shared & Object, Store, LocalContext>;
    use<NewExot extends Exot<any, any, any, any> = this>(handler: NewExot): NewExot extends Exot<infer UseDecorators, infer UseShared, infer UseStore> ? Exot<Decorators & UseDecorators, Shared & UseShared, Store & UseStore> : this;
    use(handler: StackHandler<LocalContext>): this;
    group<const Path extends string>(path: Path, init?: ExotInit): Exot<Decorators, Shared, Store, LocalContext>;
    add<const Path extends string, const Params extends TSchema, const Body extends TSchema, const Query extends TSchema, const Response extends TSchema, const NewContext extends ContextInterface = ContextInterface<MergeParams<Path, Params>, Static<Body>, AnyRecord & Static<Query>, Static<Response>, Shared, Store> & Decorators>(method: HTTPMethod, path: Path, handler: StackHandler<NewContext>, options?: StackHandlerOptions<Params, Body, Query, Response, Store>): this;
    all<const Path extends string, const Params extends TSchema, const Body extends TSchema, const Query extends TSchema, const Response extends TSchema, const NewContext extends ContextInterface = ContextInterface<MergeParams<Path, Params>, Static<Body>, AnyRecord & Static<Query>, Static<Response>, Shared, Store> & Decorators>(path: Path, handler: StackHandler<NewContext>, options?: StackHandlerOptions<Params, Body, Query, Response, Store>): this;
    delete<const Path extends string, const Params extends TSchema, const Body extends TSchema, const Query extends TSchema, const Response extends TSchema, const NewContext extends ContextInterface = ContextInterface<MergeParams<Path, Params>, Static<Body>, AnyRecord & Static<Query>, Static<Response>, Shared, Store> & Decorators>(path: Path, handler: StackHandler<NewContext>, options?: StackHandlerOptions<Params, Body, Query, Response, Store>): this;
    get<const Path extends string, const Params extends TSchema, const Body extends TSchema, const Query extends TSchema, const Response extends TSchema, const NewContext extends ContextInterface = ContextInterface<MergeParams<Path, Params>, Static<Body>, AnyRecord & Static<Query>, Static<Response>, Shared, Store> & Decorators>(path: Path, handler: StackHandler<NewContext>, options?: StackHandlerOptions<Params, Body, Query, Response, Store>): this;
    options<const Path extends string, const Params extends TSchema, const Body extends TSchema, const Query extends TSchema, const Response extends TSchema, const NewContext extends ContextInterface = ContextInterface<MergeParams<Path, Params>, Static<Body>, AnyRecord & Static<Query>, Static<Response>, Shared, Store> & Decorators>(path: Path, handler: StackHandler<NewContext>, options?: StackHandlerOptions<Params, Body, Query, Response, Store>): this;
    patch<const Path extends string, const Params extends TSchema, const Body extends TSchema, const Query extends TSchema, const Response extends TSchema, const NewContext extends ContextInterface = ContextInterface<MergeParams<Path, Params>, Static<Body>, AnyRecord & Static<Query>, Static<Response>, Shared, Store> & Decorators>(path: Path, handler: StackHandler<NewContext>, options?: StackHandlerOptions<Params, Body, Query, Response, Store>): this;
    post<const Path extends string, const Params extends TSchema, const Body extends TSchema, const Query extends TSchema, const Response extends TSchema, const NewContext extends ContextInterface = ContextInterface<MergeParams<Path, Params>, Static<Body>, AnyRecord & Static<Query>, Static<Response>, Shared, Store> & Decorators>(path: Path, handler: StackHandler<NewContext>, options?: StackHandlerOptions<Params, Body, Query, Response, Store>): this;
    put<const Path extends string, const Params extends TSchema, const Body extends TSchema, const Query extends TSchema, const Response extends TSchema, const NewContext extends ContextInterface = ContextInterface<MergeParams<Path, Params>, Static<Body>, AnyRecord & Static<Query>, Static<Response>, Shared, Store> & Decorators>(path: Path, handler: StackHandler<NewContext>, options?: StackHandlerOptions<Params, Body, Query, Response, Store>): this;
    ws(path: string, handler: WsHandler<any>): this;
    handle(ctx: LocalContext): MaybePromise<unknown>;
    onHandler(handler: StackHandler<LocalContext>): this;
    onRequest(handler: StackHandler<LocalContext>): this;
    onResponse(handler: StackHandler<LocalContext>): this;
    onRoute(handler: StackHandler<LocalContext>): this;
    context(req: Request): LocalContext;
    close(): Promise<void>;
    listen(port?: number): Promise<number>;
}
