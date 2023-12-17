import { ContextInterface, MaybePromise, StackHandler } from './types';
declare const EVENTS: readonly ["error", "publish", "request", "response", "route", "start", "subscribe"];
type AllowedEvents = (typeof EVENTS)[number];
type EventsHandler<LocalContext extends ContextInterface> = (...args: any[]) => (Promise<void> | void) | StackHandler<LocalContext>;
export declare class Events<LocalContext extends ContextInterface> {
    readonly name?: string | undefined;
    private readonly _listeners;
    private readonly _forward;
    constructor(name?: string | undefined);
    forwardTo(events: Events<LocalContext>): void;
    emit(event: 'error', ctx: LocalContext): MaybePromise<any>;
    emit(event: 'publish', data: [string, Uint8Array]): MaybePromise<any>;
    emit(event: 'request', ctx: LocalContext): MaybePromise<any>;
    emit(event: 'response', ctx: LocalContext): MaybePromise<any>;
    emit(event: 'route', ctx: LocalContext): MaybePromise<any>;
    on(event: 'request' | 'response' | 'route', handler: StackHandler<LocalContext>): void;
    off(event: AllowedEvents, handler: EventsHandler<LocalContext>): void;
}
export {};
