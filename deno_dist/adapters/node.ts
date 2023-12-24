import { Buffer } from "node:buffer";
import internal from 'node:stream';
import { IncomingMessage, ServerResponse, createServer } from 'node:http';
import { Exot } from '../exot.ts';
import {
  Adapter,
  WebSocketHandler,
} from '../types.ts';
import { Readable } from 'node:stream';
import { Context } from '../context.ts';
import { awaitMaybePromise, parseFormData, parseUrl } from '../helpers.ts';
import { HttpHeaders } from '../headers.ts';
import { HttpRequest } from '../request.ts';
import { ExotWebSocket } from '../websocket.ts';

const textDecoder = new TextDecoder();

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

export const adapter = (init: NodeAdapterInit = {}) => new NodeAdapter(init);

export default adapter;

export class NodeAdapter
  implements Adapter
{
  readonly server = createServer();

  #wsHandlers: Record<string, WebSocketHandler<any>> = {};

  constructor(readonly init: NodeAdapterInit = {}) {
  }

  async close(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        resolve(void 0);
      });
    });
  }

  async listen(port: number): Promise<number> {
    return new Promise((resolve, reject) => {
      const onError = (err: any) => reject(err);
      this.server.on('error', onError);
      this.server.listen(port, () => {
        this.server.removeListener('error', onError);
        const addr = this.server.address();
        resolve((typeof addr === 'string' ? +addr : addr?.port) || port);
      });
    });
  }

  mount(exot: Exot) {
    this.#mountRequestHandler(exot);
    this.#mountUpgradeHandler(exot);
    return exot;
  }

  async fetch(req: Request): Promise<Response> {
    return new Response('');
  }

  ws(
    path: string,
    handler: WebSocketHandler<any>
  ): void {
    this.#wsHandlers[path] = handler;
  }

  #mountRequestHandler(exot: Exot) {
    this.server.on('request', (req, res) => {
      req.pause();
      const ctx = exot.context(new NodeRequest(req));
      return awaitMaybePromise(
        () => exot.handle(ctx),
        () => {
          this.#sendResponse(ctx, res);
          ctx.destroy();
        },
        (_err) => {
          if (res.headersSent) {
            res.end();
          } else {
            res.statusCode = 500;
            res.end('Unexpected server error');
          }
          ctx.destroy();
        },
      );
    });
  }

  #mountUpgradeHandler(exot: Exot) {
    this.server.on('upgrade', (req, socket, head) => {
      const { path } = parseUrl(req.url);
      const handler = this.#wsHandlers[path];
      const wss = this.init.wss;
      if (handler && wss) {
        awaitMaybePromise(
          () => {
            if (handler.beforeUpgrade) {
              return handler.beforeUpgrade(new NodeRequest(req), socket, head)
            }
          },
          (userData) => {
            wss.handleUpgrade(req, socket, head, (ws) => {
              const nodeWebSocket = new NodeWebSocket(exot, ws, userData);
              wss.emit('connection', ws, req);
              ws.on('close', () => {
                handler.close?.(nodeWebSocket, userData);
              });
              ws.on('error', () => {
                // TODO:
              });
              ws.on('message', (data: Buffer) => {
                handler.message?.(nodeWebSocket, data, userData);
              });
              awaitMaybePromise(
                () => handler.open?.(nodeWebSocket, userData),
                () => {},
                (_err) => {
                  socket.destroy();
                },
              );
            });
          },
          (_err) => {
            socket.destroy();
          },
        )
      } else {
        socket.destroy();
      }
    });
  }

  #sendResponse(ctx: Context, res: ServerResponse) {
    res.statusCode = ctx.res.status || 200;
    const headers = ctx.res.headers as HttpHeaders;
    for (let k in headers.map) {
      const v = headers.map[k];
      if (v !== null) {
        res.setHeader(k, v);
      }
    }
    if (ctx.res.body instanceof Readable) {
      ctx.res.body.pipe(res);
    }else if (ctx.res.body instanceof ReadableStream) {
      Readable.fromWeb(ctx.res.body as any).pipe(res);
    } else {
      res.end(ctx.res.body);
    }
  }
}

export class NodeRequest extends HttpRequest {
  #buffer?: Promise<ArrayBuffer>;

  #headers?: HttpHeaders;

  readonly method: string;

  readonly url: string;

  constructor(readonly raw: IncomingMessage) {
    super();
    this.method = raw.method || 'GET';
    this.url = raw.url || '/';
  }

  get body() {
    return Readable.toWeb(this.raw) as ReadableStream<Uint8Array>;
  }

  get headers(): HttpHeaders {
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

  arrayBuffer(): Promise<ArrayBuffer> {
    if (!this.#buffer) {
      const chunks: Buffer[] = [];
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

export class NodeWebSocket<UserData> extends ExotWebSocket<WSSocket, UserData> {
  constructor(exot: Exot, raw: WSSocket, userData: UserData) {
    super(exot, raw, userData);
    this.raw.on('close', () => {
      this.exot.pubsub.unsubscribeAll(this.subscriber);
    });
  }
}
