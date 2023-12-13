import { chainAll } from './helpers';
import { ChainFn, ContextInterface, StackHandler } from './types';

const EVENTS = ['error', 'handler', 'request', 'response', 'route', 'start'] as const;

type AllowedEvents = (typeof EVENTS)[number];

type EventsHandler<LocalContext extends ContextInterface> = (
  ...args: any[]
) => (Promise<void> | void) | StackHandler<LocalContext>

export class Events<
  LocalContext extends ContextInterface
> {
  private readonly _listeners: Record<AllowedEvents, ChainFn<LocalContext>[]> = {
    error: [],
    handler: [],
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

  emit(event: AllowedEvents, ctx: LocalContext): any {
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

  on(
    event: 'handler' | 'request' | 'response' | 'route',
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
