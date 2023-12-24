import { createServer } from 'node:http';
import { Readable } from 'stream';
import { awaitMaybePromise, parseFormData, parseUrl } from '../helpers';
import { HttpHeaders } from '../headers';
import { HttpRequest } from '../request';
import { ExotWebSocket } from '../websocket';
const textDecoder = new TextDecoder();
export const adapter = (init = {}) => new NodeAdapter(init);
export default adapter;
export class NodeAdapter {
    init;
    server = createServer();
    #wsHandlers = {};
    constructor(init = {}) {
        this.init = init;
    }
    async close() {
        return new Promise((resolve) => {
            this.server.close(() => {
                resolve(void 0);
            });
        });
    }
    async listen(port) {
        return new Promise((resolve, reject) => {
            const onError = (err) => reject(err);
            this.server.on('error', onError);
            this.server.listen(port, () => {
                this.server.removeListener('error', onError);
                const addr = this.server.address();
                resolve((typeof addr === 'string' ? +addr : addr?.port) || port);
            });
        });
    }
    mount(exot) {
        this.#mountRequestHandler(exot);
        this.#mountUpgradeHandler(exot);
        return exot;
    }
    async fetch(req) {
        return new Response('');
    }
    ws(path, handler) {
        this.#wsHandlers[path] = handler;
    }
    #mountRequestHandler(exot) {
        this.server.on('request', (req, res) => {
            req.pause();
            const ctx = exot.context(new NodeRequest(req));
            return awaitMaybePromise(() => exot.handle(ctx), () => {
                this.#sendResponse(ctx, res);
                ctx.destroy();
            }, (_err) => {
                if (res.headersSent) {
                    res.end();
                }
                else {
                    res.statusCode = 500;
                    res.end('Unexpected server error');
                }
                ctx.destroy();
            });
        });
    }
    #mountUpgradeHandler(exot) {
        this.server.on('upgrade', (req, socket, head) => {
            const { path } = parseUrl(req.url);
            const handler = this.#wsHandlers[path];
            const wss = this.init.wss;
            if (handler && wss) {
                awaitMaybePromise(() => {
                    if (handler.beforeUpgrade) {
                        return handler.beforeUpgrade(new NodeRequest(req), socket, head);
                    }
                }, (userData) => {
                    wss.handleUpgrade(req, socket, head, (ws) => {
                        const nodeWebSocket = new NodeWebSocket(exot, ws, userData);
                        wss.emit('connection', ws, req);
                        ws.on('close', () => {
                            handler.close?.(nodeWebSocket, userData);
                        });
                        ws.on('error', () => {
                            // TODO:
                        });
                        ws.on('message', (data) => {
                            handler.message?.(nodeWebSocket, data, userData);
                        });
                        awaitMaybePromise(() => handler.open?.(nodeWebSocket, userData), () => { }, (_err) => {
                            socket.destroy();
                        });
                    });
                }, (_err) => {
                    socket.destroy();
                });
            }
            else {
                socket.destroy();
            }
        });
    }
    #sendResponse(ctx, res) {
        res.statusCode = ctx.res.status || 200;
        const headers = ctx.res.headers;
        for (let k in headers.map) {
            const v = headers.map[k];
            if (v !== null) {
                res.setHeader(k, v);
            }
        }
        if (ctx.res.body instanceof Readable) {
            ctx.res.body.pipe(res);
        }
        else if (ctx.res.body instanceof ReadableStream) {
            Readable.fromWeb(ctx.res.body).pipe(res);
        }
        else {
            res.end(ctx.res.body);
        }
    }
}
export class NodeRequest extends HttpRequest {
    raw;
    #buffer;
    #headers;
    method;
    url;
    constructor(raw) {
        super();
        this.raw = raw;
        this.method = raw.method || 'GET';
        this.url = raw.url || '/';
    }
    get body() {
        return Readable.toWeb(this.raw);
    }
    get headers() {
        if (!this.#headers) {
            const rawHeaders = this.raw.rawHeaders;
            const len = rawHeaders.length;
            this.#headers = new HttpHeaders();
            for (let i = 0; i < len; i += 2) {
                const name = rawHeaders[i].toLowerCase();
                const value = rawHeaders[i + 1] || '';
                this.#headers.append(name, value);
            }
        }
        return this.#headers;
    }
    arrayBuffer() {
        if (!this.#buffer) {
            const chunks = [];
            this.#buffer = new Promise((resolve, reject) => {
                this.raw.on('error', reject);
                this.raw.on('data', (chunk) => {
                    chunks.push(chunk);
                });
                this.raw.on('end', () => {
                    resolve(Buffer.concat(chunks));
                });
                this.raw.resume();
            });
        }
        return this.#buffer;
    }
    blob() {
        return Promise.resolve(new Blob([]));
    }
    clone() {
        return new NodeRequest(this.raw);
    }
    formData() {
        return this.arrayBuffer().then((body) => parseFormData(String(this.headers.get('content-type') || ''), body));
    }
    json() {
        return this.text().then(JSON.parse);
    }
    text() {
        return this.arrayBuffer().then((body) => textDecoder.decode(body));
    }
    remoteAddress() {
        return this.raw.socket.remoteAddress || '';
    }
}
export class NodeWebSocket extends ExotWebSocket {
    constructor(exot, raw, userData) {
        super(exot, raw, userData);
        this.raw.on('close', () => {
            this.exot.pubsub.unsubscribeAll(this.subscriber);
        });
    }
}
