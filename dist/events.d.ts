import { ContextInterface, StackHandler } from './types';
declare const EVENTS: readonly ["error", "handler", "request", "response", "route", "start"];
type AllowedEvents = (typeof EVENTS)[number];
type EventsHandler<LocalContext extends ContextInterface> = (...args: any[]) => (Promise<void> | void) | StackHandler<LocalContext>;
export declare class Events<LocalContext extends ContextInterface> {
    readonly name?: string | undefined;
    private readonly _listeners;
    private readonly _forward;
    constructor(name?: string | undefined);
    forwardTo(events: Events<LocalContext>): void;
    emit(event: AllowedEvents, ctx: LocalContext): any;
    on(event: 'handler' | 'request' | 'response' | 'route', handler: StackHandler<LocalContext>): void;
    off(event: AllowedEvents, handler: EventsHandler<LocalContext>): void;
}
export {};
