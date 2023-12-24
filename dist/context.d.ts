/// <reference types="node" />
import { Readable } from 'node:stream';
import { TSchema } from '@sinclair/typebox';
import { Cookies } from './cookies';
import { HttpHeaders } from './headers';
import type { ValidateFunction } from 'ajv';
import type { AnyRecord, ContextInit, HTTPMethod, MaybePromise, Trace } from './types';
import { HttpRequest } from './request';
import { PubSub } from './pubsub';
export declare class Context<Params = AnyRecord, Body = unknown, Query = AnyRecord, ResponseBody = unknown, Store = unknown> {
    #private;
    bodySchema?: ValidateFunction<TSchema>;
    readonly params: Params;
    pubsub: PubSub;
    readonly req: Request & HttpRequest;
    readonly requestId: string;
    responseSchema?: ValidateFunction<TSchema>;
    route?: string;
    readonly store: Store;
    terminated: boolean;
    traces: Trace[];
    tracingEnabled: boolean;
    constructor(init: ContextInit);
    get cookies(): Cookies;
    get contentType(): string | null;
    get headers(): Headers;
    get host(): string | null;
    get method(): HTTPMethod;
    get path(): string;
    get querystring(): string;
    get query(): Query;
    get remoteAddress(): string | null;
    get res(): {
        body: ResponseBody;
        headers: Headers | HttpHeaders;
        status: number;
    };
    get arrayBuffer(): (value?: ArrayBuffer) => Promise<ArrayBuffer> | undefined;
    get formData(): () => Promise<FormData>;
    get json(): (value?: any, validate?: boolean) => Promise<Body> | undefined;
    get stream(): <T = Readable | ReadableStream<any>>(value?: T | undefined) => T | undefined;
    get text(): (value?: string, validate?: boolean) => Promise<string> | undefined;
    get traceStart(): (name?: string, desc?: string) => Trace;
    get traceEnd(): (error?: any) => void;
    get trace(): <T>(fn: () => T, name?: string, desc?: string) => MaybePromise<T>;
    destroy(): void;
    end(): void;
}
