import { chainAll } from './helpers';
const EVENTS = ['error', 'publish', 'request', 'response', 'route', 'start', 'subscribe'];
export class Events {
    name;
    _listeners = {
        error: [],
        publish: [],
        request: [],
        response: [],
        route: [],
        start: [],
        subscribe: [],
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
