import type { ChainFn, ContextInterface, MaybePromise, Trace } from './types';
export declare function awaitMaybePromise<T>(fn: ChainFn<T>, onResolved: (result: any) => MaybePromise<T>, onError: (err: any) => MaybePromise<T>, input?: T): MaybePromise<T>;
export declare function chain<T>(fns: ChainFn<T>[], input?: T, i?: number, terminateOnReturn?: boolean): MaybePromise<unknown>;
export declare const chainAll: <T>(fns: ChainFn<T>[], input: T) => unknown;
export declare function parseQueryString(querystring: string): Record<string, any>;
export declare function printTraces<Ctx extends ContextInterface>(ctx: Ctx, warnAboveTime?: number, traces?: Trace[], level?: number): void;
export declare function parseUrl(url?: string): {
    path: string;
    querystring: string;
};
export declare function parseFormData(contentType: string, body: ArrayBuffer): Promise<FormData>;
export declare function normalizeHeader(header: string): string;
