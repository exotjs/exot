/// <reference types="node" />
import { Readable } from 'node:stream';
import { TSchema } from '@sinclair/typebox';
import { Cookies } from './cookies';
import { HttpHeaders } from './headers';
import type { ValidateFunction } from 'ajv';
import type { AnyRecord, HTTPMethod, MaybePromise, Trace } from './types';
import { HttpRequest } from './request';
export declare class Context<Params = AnyRecord, Body = unknown, Query = AnyRecord, ResponseBody = unknown, Shared = unknown, Store = unknown> {
    #private;
    readonly req: Request & HttpRequest;
    readonly params: Params;
    readonly shared: Shared;
    readonly store: Store;
    tracing: boolean;
    bodySchema?: ValidateFunction<TSchema>;
    responseSchema?: ValidateFunction<TSchema>;
    route?: string;
    terminated: boolean;
    traces: Trace[];
    constructor(req: Request & HttpRequest, params?: Params, shared?: Shared, store?: Store, tracing?: boolean);
    get cookies(): Cookies;
    get contentType(): string | null;
    get headers(): Headers;
    get host(): string | null;
    get method(): HTTPMethod;
    get path(): string;
    get querystring(): string;
    get query(): Query;
    get remoteAddress(): string | null;
    get set(): {
        body: ResponseBody;
        headers: Headers | HttpHeaders;
        status: number;
    };
    get arrayBuffer(): () => Promise<ArrayBuffer>;
    get formData(): () => Promise<FormData>;
    get json(): (value?: any, validate?: boolean) => Promise<Body> | undefined;
    get stream(): <T = ReadableStream<any> | Readable>(value?: T | undefined) => T | undefined;
    get text(): (value?: string, validate?: boolean) => Promise<string> | undefined;
    get traceStart(): (name?: string, desc?: string) => Trace;
    get traceEnd(): (error?: any) => void;
    get trace(): <T>(fn: () => T, name?: string, desc?: string | undefined) => MaybePromise<T>;
    _trace<T>(fn: () => T, name?: string, desc?: string): MaybePromise<T>;
    destroy(): void;
    end(): void;
}
