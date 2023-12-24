import type { PubSubHandler } from './types.js';
export declare class PubSub {
    #private;
    createSubscriber(handler?: PubSubHandler): PubSubSubscriber;
    publish(topic: string, data: ArrayBuffer | string): number;
    subscribe(topic: string, subscriber: PubSubSubscriber): void;
    unsubscribe(topic: string, subscriber: PubSubSubscriber): void;
    unsubscribeAll(subscriber: PubSubSubscriber): void;
}
export declare class PubSubSubscriber {
    #private;
    constructor(handler: PubSubHandler);
    publish(topic: string, data: ArrayBuffer | string | null): void;
    stream(): ReadableStream<any>;
}
