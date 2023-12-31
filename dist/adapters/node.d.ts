/// <reference types="node" />
/// <reference types="node" />
/// <reference types="node" />
import { IncomingMessage, ServerResponse } from 'node:http';
import { Exot } from '../exot.js';
import { Adapter, ContextInterface, WebSocketHandler } from '../types.js';
import { ExotHeaders } from '../headers.js';
import { ExotRequest } from '../request.js';
import type { WebSocketServer } from 'ws';
export interface NodeAdapterInit {
    wss?: WebSocketServer;
}
export declare const adapter: (init?: NodeAdapterInit) => NodeAdapter;
export default adapter;
export declare class NodeAdapter implements Adapter {
    #private;
    readonly init: NodeAdapterInit;
    exot?: Exot;
    readonly heartbeatInterval: NodeJS.Timeout;
    readonly server: import("http").Server<typeof IncomingMessage, typeof ServerResponse>;
    constructor(init?: NodeAdapterInit);
    close(): Promise<void>;
    listen(port: number): Promise<number>;
    mount(exot: Exot): Exot<{}, {}, {}, {}, ContextInterface<{}, any, any, any, {}>>;
    fetch(req: Request): Promise<Response>;
    upgradeRequest(ctx: ContextInterface, handler: WebSocketHandler): import("../types.js").MaybePromise<void>;
}
export declare class NodeRequest extends ExotRequest {
    #private;
    readonly raw: IncomingMessage;
    readonly head?: Buffer | undefined;
    readonly method: string;
    readonly url: string;
    constructor(raw: IncomingMessage, head?: Buffer | undefined);
    get body(): ReadableStream<Uint8Array>;
    get headers(): ExotHeaders;
    arrayBuffer(): Promise<ArrayBuffer>;
    blob(): Promise<Blob>;
    clone(): NodeRequest;
    formData(): Promise<FormData>;
    json(): Promise<any>;
    text(): Promise<string>;
    remoteAddress(): string;
}
