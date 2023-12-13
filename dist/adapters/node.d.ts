/// <reference types="node" />
import { IncomingMessage, ServerResponse } from 'node:http';
import { Exot } from '../exot';
import { Adapter, WsHandler } from '../types';
import { HttpHeaders } from '../headers';
import { HttpRequest } from '../request';
declare const _default: () => NodeAdapter;
export default _default;
export declare class NodeAdapter implements Adapter {
    #private;
    readonly server: import("http").Server<typeof IncomingMessage, typeof ServerResponse>;
    close(): Promise<void>;
    listen(port: number): Promise<number>;
    mount(exot: Exot): Exot<{}, {}, {}, import("../types").ContextInterface<any, any, any, any, {}, {}>>;
    fetch(req: Request): Promise<Response>;
    ws(path: string, handler: WsHandler<any>): void;
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
