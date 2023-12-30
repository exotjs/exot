import { Exot } from './exot.js';
import { PubSubSubscriber } from './pubsub.js';
interface WebSocketInterface {
    addEventListener?: (event: any, handler: () => void, options?: any) => void;
    close: () => void;
    send: (data: ArrayBuffer | Uint8Array | string) => void;
}
export declare class ExotWebSocket<RawWebSocket extends WebSocketInterface, UserData = any> {
    readonly exot: Exot;
    readonly raw: RawWebSocket;
    readonly userData: UserData;
    readonly subscriber: PubSubSubscriber;
    constructor(exot: Exot, raw: RawWebSocket, userData?: UserData);
    close(): void;
    send(data: ArrayBuffer | Uint8Array | string | null): void;
    publish(topic: string, data: ArrayBuffer | Uint8Array | string): number;
    subscribe(topic: string): void;
    unsubscribe(topic: string): void;
    unsubscribeAll(): void;
}
export {};
