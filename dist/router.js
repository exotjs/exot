import router from 'find-my-way';
export function isStaticPath(path) {
    return !/[:\*\(]/.test(path);
}
export function normalizePath(path, ignoreTrailingSlash = true) {
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
export function joinPaths(...parts) {
    return normalizePath(parts.filter((p) => !!p).map((p) => normalizePath(p)).join(''));
}
export class Router {
    init;
    fmw;
    staticRoutes = {};
    constructor(init = {}) {
        this.init = init;
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
    add(method, route, stack) {
        if (this.init.disableStaticMapping !== true && isStaticPath(route)) {
            this.staticRoutes[method + normalizePath(route, this.ignoreTrailingSlash)] = { params: {}, route, stack };
        }
        else {
            this.fmw.on(method, route, () => { }, { params: {}, route, stack });
        }
    }
    all(route, stack) {
        this.fmw.all(route, () => { }, { params: {}, route, stack });
    }
    find(method, path) {
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
