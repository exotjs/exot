import router, { HTTPMethod, HTTPVersion, Instance as RouterInstance } from 'find-my-way';
import type { RouterInit, RouterFindResult, ContextInterface } from './types';
import type { ChainFn } from './types';

export function isStaticPath(path: string) {
  return !/[:\*\(]/.test(path);
}

export function normalizePath(path: string, ignoreTrailingSlash: boolean = true) {
  if (path[0] !== '/') {
    path = '/' + path;
  }
  if (ignoreTrailingSlash) {
    const len = path.length;
    if (len > 1 && path[len - 1] === '/') {
      return path.slice(0, len - 1); 
    }
  }
  return path;
}

export function joinPaths(...parts: string[]) {
  return normalizePath(parts.filter((p) => !!p).map((p) => normalizePath(p)).join(''));
}

export interface RouteStore {
  params: Record<string, string>;
  route: string;
  stack: ChainFn<any>[];
}

export class Router {
  readonly fmw: RouterInstance<HTTPVersion.V1>;

  readonly staticRoutes: Record<string, RouteStore> = {};

  constructor(readonly init: RouterInit = {}) {
    this.fmw = router(this.init.config || {
      allowUnsafeRegex: false,
      caseSensitive: true,
      ignoreDuplicateSlashes: true,
      ignoreTrailingSlash: true,
      maxParamLength: 100,
    });
  }

  get ignoreTrailingSlash() {
    // @ts-expect-error
    return !!this.fmw.ignoreTrailingSlash;
  }

  add(method: HTTPMethod, route: string, stack: ChainFn<any>[]) {
    if (this.init.disableStaticMapping !== true && isStaticPath(route)) {
      this.staticRoutes[method + normalizePath(route, this.ignoreTrailingSlash)] = { params: {}, route, stack };
    } else {
      this.fmw.on(method, route, () => {}, { params: {}, route, stack } satisfies RouteStore);
    }
  }

  all(route: string, stack: ChainFn<any>[]) {
    this.fmw.all(route, () => {}, { params: {}, route, stack } satisfies RouteStore);
  }

  find(method: HTTPMethod, path: string): RouterFindResult | null {
    const key = method + normalizePath(path, this.ignoreTrailingSlash);
    const staticRoute = this.staticRoutes[key];
    if (staticRoute) {
      return staticRoute;
    }
    const route = this.fmw.find(method, path);
    if (route) {
      return {
        params: route.params,
        route: route.store.route,
        stack: route.store.stack,
      };
    }
    return null;
  }
}
