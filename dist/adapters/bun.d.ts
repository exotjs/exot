import { FetchAdapter } from './fetch.js';
import { ExotWebSocket } from '../websocket.js';
import type { ContextInterface, MaybePromise, WebSocketHandler } from '../types.js';
interface BunWebsocketData<UserData> {
    ctx: ContextInterface;
    handler: WebSocketHandler;
    ws: ExotWebSocket<BunServerWebSocket, UserData>;
}
interface BunServerWebSocket<UserData = any> {
    readonly data: BunWebsocketData<UserData>;
    readonly readyState: number;
    readonly remoteAddress: string;
    send(message: string | ArrayBuffer | Uint8Array, compress?: boolean): number;
    close(code?: number, reason?: string): void;
    subscribe(topic: string): void;
    unsubscribe(topic: string): void;
    publish(topic: string, message: string | ArrayBuffer | Uint8Array): void;
    isSubscribed(topic: string): boolean;
    cork(cb: (ws: BunServerWebSocket<UserData>) => void): void;
}
export interface BunWebsockets {
    message: (ws: BunServerWebSocket, message: string | ArrayBuffer | Uint8Array) => void;
    open?: (ws: BunServerWebSocket) => void;
    close?: (ws: BunServerWebSocket) => void;
    error?: (ws: BunServerWebSocket, error: Error) => void;
    drain?: (ws: BunServerWebSocket) => void;
    perMessageDeflate?: boolean | {
        compress?: boolean | string;
        decompress?: boolean | string;
    };
}
export declare const adapter: () => BunAdapter;
export default adapter;
export declare class BunAdapter extends FetchAdapter {
    #private;
    get websocket(): BunWebsockets;
    fetch(req: Request): MaybePromise<Response>;
    listen(port: number): Promise<number>;
    upgradeRequest(ctx: ContextInterface, handler: WebSocketHandler): MaybePromise<Response | undefined>;
}
