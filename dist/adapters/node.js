import { Readable } from 'node:stream';
import { createServer } from 'node:http';
import { awaitMaybePromise, parseFormData } from '../helpers.js';
import { ExotHeaders } from '../headers.js';
import { ExotRequest } from '../request.js';
import { ExotWebSocket } from '../websocket.js';
const textDecoder = new TextDecoder();
export const adapter = (init = {}) => new NodeAdapter(init);
export default adapter;
export class NodeAdapter {
    init;
    exot;
    heartbeatInterval = setInterval(this.#onHeartbeat, 30000);
    server = createServer();
    constructor(init = {}) {
        this.init = init;
    }
    async close() {
        return new Promise((resolve) => {
            this.server.closeAllConnections();
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
        this.exot = exot;
        this.#mountRequestHandler(exot);
        this.#mountUpgradeHandler(exot);
        return exot;
    }
    async fetch(req) {
        return new Response('');
    }
    upgradeRequest(ctx, handler) {
        const req = ctx.req;
        const wss = this.init.wss;
        if (handler && wss) {
            return awaitMaybePromise(() => {
                if (handler.beforeUpgrade) {
                    return handler.beforeUpgrade(ctx);
                }
            }, () => {
                wss.handleUpgrade(req.raw, req.raw.socket, req.head || Buffer.from(''), (ws) => {
                    const ews = new ExotWebSocket(this.exot, ws, {});
                    wss.emit('connection', ws, req.raw);
                    ws.on('close', () => {
                        handler.close?.(ews, ctx);
                    });
                    ws.on('drain', () => {
                        handler.drain?.(ews, ctx);
                    });
                    ws.on('error', (err) => {
                        handler.error?.(ews, err, ctx);
                    });
                    ws.on('message', (data) => {
                        handler.message?.(ews, data, ctx);
                    });
                    ws.on('pong', () => {
                        // @ts-expect-error
                        ws.isAlive = true;
                    });
                    awaitMaybePromise(() => handler.open?.(ews, ctx), () => { }, (_err) => {
                        req.raw.socket.destroy();
                    });
                });
            }, (_err) => {
                req.raw.socket.destroy();
            });
        }
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
            req.pause();
            const ctx = exot.context(new NodeRequest(req, head));
            return awaitMaybePromise(() => exot.handle(ctx), () => {
                // noop
            }, (_err) => {
                ctx.destroy();
                socket.destroy();
            });
        });
    }
    #onHeartbeat() {
        if (this.init.wss) {
            for (let ws of this.init.wss.clients) {
                // @ts-expect-error
                if (ws.isAlive === false) {
                    ws.terminate();
                }
                else {
                    // @ts-expect-error
                    ws.isAlive = false;
                    ws.ping();
                }
            }
        }
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
export class NodeRequest extends ExotRequest {
    raw;
    head;
    #buffer;
    #headers;
    method;
    url;
    constructor(raw, head) {
        super();
        this.raw = raw;
        this.head = head;
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
            this.#headers = new ExotHeaders();
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
