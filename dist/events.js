import { chainAll } from './helpers';
const EVENTS = ['error', 'handler', 'request', 'response', 'route', 'start'];
export class Events {
    name;
    _listeners = {
        error: [],
        handler: [],
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
    emit(event, ctx) {
        const lenListeners = this._listeners[event]?.length || 0;
        const lenForward = this._forward.length;
        if (!lenListeners && !lenForward) {
            return;
        }
        if (lenListeners && !lenForward) {
            return chainAll(this._listeners[event], ctx);
        }
        return chainAll([
            () => chainAll(this._listeners[event], ctx),
            () => chainAll(this._forward.map((ev) => ev.emit(event, ctx)), ctx),
        ], ctx);
    }
    on(event, handler) {
        const fn = (ctx) => ctx._trace(() => handler(ctx), '@on:' + event, this.name);
        fn['_handler'] = handler;
        this._listeners[event].push(fn);
    }
    off(event, handler) {
        // @ts-expect-error
        const idx = this._listeners[event].findIndex((fn) => fn['_handler'] === handler);
        if (idx >= 0) {
            this._listeners[event].splice(idx, 1);
        }
    }
}
