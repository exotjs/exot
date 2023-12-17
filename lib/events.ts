import { chainAll } from './helpers';
import { ChainFn, ContextInterface, MaybePromise, StackHandler } from './types';

const EVENTS = ['error', 'publish', 'request', 'response', 'route', 'start', 'subscribe'] as const;

type AllowedEvents = (typeof EVENTS)[number];

type EventsHandler<LocalContext extends ContextInterface> = (
  ...args: any[]
) => (Promise<void> | void) | StackHandler<LocalContext>

export class Events<
  LocalContext extends ContextInterface
> {
  private readonly _listeners: Record<AllowedEvents, ChainFn<LocalContext>[]> = {
    error: [],
    publish: [],
    request: [],
    response: [],
    route: [],
    start: [],
    subscribe: [],
  };

  private readonly _forward: Events<LocalContext>[] = [];


  constructor(readonly name?: string) {
  }

  forwardTo(events: Events<LocalContext>) {
    this._forward.push(events);
  }

  emit(event: 'error', ctx: LocalContext): MaybePromise<any>;
  emit(event: 'publish', data: [string, Uint8Array]): MaybePromise<any>;
  emit(event: 'request', ctx: LocalContext): MaybePromise<any>;
  emit(event: 'response', ctx: LocalContext): MaybePromise<any>;
  emit(event: 'route', ctx: LocalContext): MaybePromise<any>;
  emit(event: AllowedEvents, arg: any): MaybePromise<any> {
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
    event: 'request' | 'response' | 'route',
    handler: StackHandler<LocalContext>
  ): void;

  on(event: AllowedEvents, handler: EventsHandler<LocalContext>) {
    const fn = (ctx: LocalContext) => ctx._trace(() => handler(ctx), '@on:' + event, this.name);
    fn['_handler'] = handler;
    this._listeners[event].push(fn);
  }

  off(event: AllowedEvents, handler: EventsHandler<LocalContext>) {
    // @ts-expect-error
    const idx = this._listeners[event].findIndex((fn) => fn['_handler'] === handler);
    if (idx >= 0) {
      this._listeners[event].splice(idx, 1);
    }
  }
}
