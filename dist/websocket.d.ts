import { Exot } from './exot';
import { PubSubSubscriber } from './pubsub';
export interface WebSocketInterface {
    close: () => void;
    send: (data: ArrayBuffer | Uint8Array | string) => void;
}
export declare class ExotWebSocket<RawWebSocket extends WebSocketInterface, UserData> {
    readonly exot: Exot;
    readonly raw: RawWebSocket;
    readonly userData: UserData;
    readonly subscriber: PubSubSubscriber;
    constructor(exot: Exot, raw: RawWebSocket, userData: UserData);
    close(): void;
    send(data: ArrayBuffer | Uint8Array | string | null): void;
    publish(topic: string, data: ArrayBuffer | Uint8Array | string): number;
    subscribe(topic: string): void;
    unsubscribe(topic: string): void;
    unsubscribeAll(): void;
}
