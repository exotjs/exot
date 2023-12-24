import { ContextInterface, ExotEvent, EventHandler, MaybePromise } from './types.js';
export declare class Events<LocalContext extends ContextInterface> {
    #private;
    readonly name?: string | undefined;
    private readonly _listeners;
    private readonly _forward;
    constructor(name?: string | undefined);
    forwardTo(events: Events<LocalContext>): void;
    emit(event: 'error', err: unknown): MaybePromise<any>;
    emit(event: 'publish', data: [string, ArrayBuffer | string]): MaybePromise<any>;
    emit(event: 'request' | 'response' | 'route', ctx: LocalContext): MaybePromise<any>;
    emit(event: 'start', port: number): MaybePromise<any>;
    on(event: 'error', handler: EventHandler<unknown>): void;
    on(event: 'publish', handler: EventHandler<[string, ArrayBuffer | string]>): void;
    on(event: 'request' | 'response' | 'route', handler: EventHandler<LocalContext>): void;
    on(event: 'start', handler: EventHandler<number>): void;
    off(event: ExotEvent, handler: EventHandler<any>): void;
}
