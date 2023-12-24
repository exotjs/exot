import { chainAll } from './helpers.js';
import { ChainFn, ContextInterface, ExotEvent, EventHandler, MaybePromise } from './types.js';

export class Events<
  LocalContext extends ContextInterface
> {
  private readonly _listeners: Record<ExotEvent, ChainFn<LocalContext>[]> = {
    error: [],
    publish: [],
    request: [],
    response: [],
    route: [],
    start: [],
  };

  private readonly _forward: Events<LocalContext>[] = [];


  constructor(readonly name?: string) {
  }

  forwardTo(events: Events<LocalContext>) {
    this._forward.push(events);
  }

  emit(event: 'error', err: unknown): MaybePromise<any>;
  emit(event: 'publish', data: [string, ArrayBuffer | string]): MaybePromise<any>;
  emit(event: 'request' | 'response' | 'route', ctx: LocalContext): MaybePromise<any>;
  emit(event: 'start', port: number): MaybePromise<any>;
  emit(event: ExotEvent, arg?: any): MaybePromise<any> {
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
      () => chainAll(this._forward.map((ev) => () => ev.emit(event as any, arg)), arg),
   ], arg);
  }

  on(
    event: 'error',
    handler: EventHandler<unknown>
  ): void;
  on(
    event: 'publish',
    handler: EventHandler<[string, ArrayBuffer | string]>
  ): void;
  on(
    event: 'request' | 'response' | 'route',
    handler: EventHandler<LocalContext>
  ): void;
  on(
    event: 'start',
    handler: EventHandler<number>
  ): void;
  on(event: ExotEvent, handler: EventHandler<any>) {
    this._listeners[event].push(this.#createHandler(event, handler));
  }

  off(event: ExotEvent, handler: EventHandler<any>) {
    // @ts-expect-error
    const idx = this._listeners[event].findIndex((fn) => fn === handler || fn['_handler'] === handler);
    if (idx >= 0) {
      this._listeners[event].splice(idx, 1);
    }
  }

  #createHandler(event: ExotEvent, handler: EventHandler<any>) {
    if (['start', 'publish'].includes(event)) {
      return handler;
    }
    const fn = (ctx: LocalContext) => ctx.trace(() => handler(ctx), '@on:' + event, this.name);
    fn['_handler'] = handler;
    return fn;
  }
}
