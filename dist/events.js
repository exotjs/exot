import { chainAll } from './helpers.js';
export class Events {
    name;
    _listeners = {
        error: [],
        publish: [],
        request: [],
        response: [],
        route: [],
        start: [],
    };
    _forward = [];
    constructor(name) {
        this.name = name;
    }
    forwardTo(events) {
        this._forward.push(events);
    }
    emit(event, arg) {
        const lenListeners = this._listeners[event]?.length || 0;
        const lenForward = this._forward.length;
        if (!lenListeners && !lenForward) {
            return;
        }
        if (lenListeners && !lenForward) {
            return chainAll(this._listeners[event], arg);
        }
        return chainAll([
            () => chainAll(this._listeners[event], arg),
            () => chainAll(this._forward.map((ev) => () => ev.emit(event, arg)), arg),
        ], arg);
    }
    on(event, handler) {
        this._listeners[event].push(this.#createHandler(event, handler));
    }
    off(event, handler) {
        // @ts-expect-error
        const idx = this._listeners[event].findIndex((fn) => fn === handler || fn['_handler'] === handler);
        if (idx >= 0) {
            this._listeners[event].splice(idx, 1);
        }
    }
    #createHandler(event, handler) {
        if (['start', 'publish'].includes(event)) {
            return handler;
        }
        const fn = (ctx) => ctx.trace(() => handler(ctx), '@on:' + event, this.name);
        fn['_handler'] = handler;
        return fn;
    }
}
