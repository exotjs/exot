/// <reference types="node" />
import type { Readable } from 'node:stream';
import type { TSchema, Static } from '@sinclair/typebox';
import type { Context } from './context';
import type { Exot } from './exot';
import type { Router } from './router';
import type { Config, HTTPMethod, HTTPVersion } from 'find-my-way';
export type { HTTPMethod } from 'find-my-way';
type PickUndefined<T> = {
    [P in keyof T as undefined extends T[P] ? P : never]: T[P];
};
type PickDefined<T> = {
    [P in keyof T as undefined extends T[P] ? never : P]: T[P];
};
type OptionalDefined<T> = {
    [K in keyof PickUndefined<T>]?: Exclude<T[K], null>;
} & {
    [K in keyof PickDefined<T>]: T[K];
};
export interface ExotInit<UseHandlerOptions extends AnyRecord = {}> {
    handlerOptions?: UseHandlerOptions;
    name?: string;
    prefix?: string;
    router?: RouterInit;
    tracing?: boolean;
    onComposed?: (parent?: Exot<any, any, any>) => void;
}
export type AnyRecord = Record<string, any>;
export type AnyExot<T extends ContextInterface = ContextInterface> = Exot<any, any, any, T>;
export type AnyStackHandlerOptions = StackHandlerOptions<any, any, any, any, any>;
export interface ContextInterface<Params = AnyRecord, Body = unknown, Query = AnyRecord, ResponseBody = unknown, Shared = unknown, Store = unknown> extends Context<Params, Body, Query, ResponseBody, Shared, Store> {
    json(value: any): void;
    json(): Promise<any>;
}
export type StackHandler<T extends ContextInterface> = ((ctx: T) => unknown) | AnyExot<T> | Router;
export interface StackHandlerOptions<Params extends TSchema, Body extends TSchema, Query extends TSchema, Response extends TSchema, Store extends AnyRecord> {
    transform?: (ctx: Context<any, Body, Query, Response, any, Store>) => Promise<TrasformResult<Static<Params>, Static<Query>>> | TrasformResult<Static<Params>, Static<Query>>;
    body?: Body;
    params?: Params;
    query?: Query;
    response?: Response;
    store?: OptionalDefined<Store>;
}
export type ErrorHandler<LocalContext extends Context> = (err: any, ctx: LocalContext) => Promise<void> | void;
export type TraceHandler<LocalContext extends Context> = (ctx: LocalContext) => Promise<void> | void;
export type MaybePromise<T = unknown> = Promise<T> | T;
export type ChainFnOld<Input = any, Result = unknown> = (input: Input) => MaybePromise<Result>;
export type ChainFn<Input = unknown> = (input: Input) => MaybePromise<unknown>;
export type MergeParams<Path extends string, Params extends TSchema> = Omit<RouteParams<Path>, keyof Static<Params>> & Static<Params>;
export type WsHandler<WsSocket> = {
    close?: (ws: WsSocket) => Promise<void> | void;
    message?: (ws: WsSocket, message: ArrayBuffer) => Promise<void> | void;
    open?: (ws: WsSocket) => Promise<void> | void;
    upgrade?: (req: Request, res: Response) => Promise<void> | void;
};
export type TrasformResult<Params, Query> = {
    params?: Params;
    query?: Query;
};
type IsOptionalParameter<Part> = Part extends `:${infer ParamName}?` ? ParamName : never;
type IsParameter<Part> = Part extends `:${infer ParamName}?` ? never : Part extends `:${infer ParamName}` ? ParamName : never;
type FilteredParts<Path> = Path extends `${infer PartA}/${infer PartB}` ? IsParameter<PartA> | FilteredParts<PartB> : IsParameter<Path>;
type FilteredOptionalParts<Path> = Path extends `${infer PartA}/${infer PartB}` ? IsOptionalParameter<PartA> | FilteredOptionalParts<PartB> : IsOptionalParameter<Path>;
export type RouteParams<Path> = {
    [Key in FilteredParts<Path> as Key]: string;
} & {
    [Key in FilteredOptionalParts<Path> as Key]: string | undefined;
};
export interface HandlerOptions<Params extends TSchema, Body extends TSchema, Query extends TSchema, Response extends TSchema, Store extends AnyRecord> {
    transform?: (ctx: Context<any, Body, Query, Response, any, Store>) => Promise<TrasformResult<Static<Params>, Static<Query>>> | TrasformResult<Static<Params>, Static<Query>>;
    body?: Body;
    params?: Params;
    query?: Query;
    response?: Response;
    scope?: OptionalDefined<Store>;
}
export type ContentType = 'application/json' | 'application/x-www-form-urlencoded' | 'multipart/form-data' | 'text/plain' | string;
export interface Route {
    method: HTTPMethod;
    path: string;
}
export interface RouterInit {
    config?: Config<HTTPVersion.V1>;
    disableStaticMapping?: boolean;
}
export type RouterFindResult = {
    params: Record<string, string | undefined>;
    route: string;
    stack: ChainFn<ContextInterface>[];
} | null;
export interface Trace {
    desc?: string;
    error?: any;
    name: string;
    parent?: Trace;
    start: number;
    time: number;
    traces: Trace[];
}
export interface Adapter<WsHandler = any> {
    close(): Promise<void>;
    fetch(req: Request): MaybePromise<Response>;
    listen(port: number): Promise<number>;
    mount(exot: Exot<any, any, any>): void;
    ws(path: string, handler: WsHandler): void;
}
/** @deprecated */
export interface AdapterRequest {
    arrayBuffer(): MaybePromise<ArrayBuffer>;
    body: Readable | ReadableStream | null;
    formData(): MaybePromise<FormData>;
    headers: Headers;
    json(): MaybePromise<any>;
    method: string;
    text(): MaybePromise<string>;
    url: string;
    destroy?: () => void;
    parsedUrl?: () => {
        path: string;
        querystring: string;
    };
    remoteAddress?: () => string;
}
