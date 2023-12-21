/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import internal from 'node:stream';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Exot } from '../exot';
import { Adapter, WebSocketHandler } from '../types';
import { HttpHeaders } from '../headers';
import { HttpRequest } from '../request';
import { ExotWebSocket } from '../websocket';
interface WSServer {
    emit: (event: string, ws: any, req: IncomingMessage) => void;
    handleUpgrade: (req: IncomingMessage, socket: internal.Duplex, head: Buffer, cb: (ws: any) => void) => void;
    on: (event: string, cb: (ws: any, req: IncomingMessage) => void) => void;
}
interface WSSocket {
    close: () => void;
    on: (event: string, fn: () => void) => void;
    send: (data: any) => void;
}
export interface NodeAdapterInit {
    wss?: WSServer;
}
declare const _default: (init?: NodeAdapterInit) => NodeAdapter;
export default _default;
export declare class NodeAdapter implements Adapter {
    #private;
    readonly init: NodeAdapterInit;
    readonly server: import("http").Server<typeof IncomingMessage, typeof ServerResponse>;
    constructor(init?: NodeAdapterInit);
    close(): Promise<void>;
    listen(port: number): Promise<number>;
    mount(exot: Exot): Exot<{}, {}, {}, {}, import("../types").ContextInterface<{}, any, any, any, {}>>;
    fetch(req: Request): Promise<Response>;
    ws(path: string, handler: WebSocketHandler<any>): void;
}
export declare class NodeRequest extends HttpRequest {
    #private;
    readonly raw: IncomingMessage;
    readonly method: string;
    readonly url: string;
    constructor(raw: IncomingMessage);
    get body(): ReadableStream<Uint8Array>;
    get headers(): HttpHeaders;
    arrayBuffer(): Promise<ArrayBuffer>;
    blob(): Promise<Blob>;
    clone(): NodeRequest;
    formData(): Promise<FormData>;
    json(): Promise<any>;
    text(): Promise<string>;
    remoteAddress(): string;
}
export declare class NodeWebSocket<UserData> extends ExotWebSocket<WSSocket, UserData> {
    constructor(exot: Exot, raw: WSSocket, userData: UserData);
}
