import { HTTPMethod, HTTPVersion, Instance as RouterInstance } from 'find-my-way';
import type { RouterInit, RouterFindResult } from './types.js';
import type { ChainFn } from './types.js';
export declare function isStaticPath(path: string): boolean;
export declare function normalizePath(path: string, ignoreTrailingSlash?: boolean): string;
export declare function joinPaths(...parts: string[]): string;
export interface RouteStore {
    params: Record<string, string>;
    route: string;
    stack: ChainFn<any>[];
}
export declare class Router {
    readonly init: RouterInit;
    readonly fmw: RouterInstance<HTTPVersion.V1>;
    readonly staticRoutes: Record<string, RouteStore>;
    constructor(init?: RouterInit);
    get ignoreTrailingSlash(): boolean;
    add(method: HTTPMethod, route: string, stack: ChainFn<any>[]): void;
    all(route: string, stack: ChainFn<any>[]): void;
    find(method: HTTPMethod, path: string): RouterFindResult | null;
    has(method: HTTPMethod, route: string): boolean;
}
