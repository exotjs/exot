import { Buffer } from "node:buffer";
import { Readable, type Duplex } from 'node:stream';
import { IncomingMessage, ServerResponse, createServer } from 'node:http';
import { Exot } from '../exot.ts';
import {
  Adapter,
  ContextInterface,
  WebSocketHandler,
} from '../types.ts';
import { Context } from '../context.ts';
import { awaitMaybePromise, parseFormData, parseUrl } from '../helpers.ts';
import { ExotHeaders } from '../headers.ts';
import { ExotRequest } from '../request.ts';
import { ExotWebSocket } from '../websocket.ts';

const textDecoder = new TextDecoder();

interface WSServer {
  emit: (event: string, ws: any, req: IncomingMessage) => void;
  handleUpgrade: (req: IncomingMessage, socket: Duplex, head: Buffer, cb: (ws: any) => void) => void;
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
  #exot?: Exot;

  readonly server = createServer();

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
    this.#exot = exot;
    this.#mountRequestHandler(exot);
    this.#mountUpgradeHandler(exot);
    return exot;
  }

  async fetch(req: Request): Promise<Response> {
    return new Response('');
  }

  upgradeRequest(ctx: ContextInterface, handler: WebSocketHandler) {
    const req = ctx.req as NodeRequest;
    const wss = this.init.wss;
    if (handler && wss) {
      return awaitMaybePromise(
        () => {
          if (handler.beforeUpgrade) {
            return handler.beforeUpgrade(ctx)
          }
        },
        (userData) => {
          wss.handleUpgrade(req.raw, req.raw.socket, req.head || Buffer.from(''), (ws) => {
            const nodeWebSocket = new NodeWebSocket(this.#exot!, ws, userData);
            wss.emit('connection', ws, req.raw);
            ws.on('close', () => {
              handler.close?.(nodeWebSocket, userData);
            });
            ws.on('error', (err: any) => {
              // TODO:
            });
            ws.on('message', (data: Buffer) => {
              handler.message?.(nodeWebSocket, data, userData);
            });
            awaitMaybePromise(
              () => handler.open?.(nodeWebSocket, userData),
              () => {},
              (_err) => {
                console.log(_err)
                req.raw.socket.destroy();
              },
            );
          });
        },
        (_err) => {
          console.log(_err)
          req.raw.socket.destroy();
        },
      )
    }
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
      req.pause();
      const ctx = exot.context(new NodeRequest(req, head));
      return awaitMaybePromise(
        () => exot.handle(ctx),
        () => {
          // noop
        },
        (_err) => {
          ctx.destroy();
          socket.destroy();
        },
      );
    });
  }

  #sendResponse(ctx: Context, res: ServerResponse) {
    res.statusCode = ctx.res.status || 200;
    const headers = ctx.res.headers as ExotHeaders;
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

export class NodeRequest extends ExotRequest {
  #buffer?: Promise<ArrayBuffer>;

  #headers?: ExotHeaders;

  readonly method: string;

  readonly url: string;

  constructor(readonly raw: IncomingMessage, readonly head?: Buffer) {
    super();
    this.method = raw.method || 'GET';
    this.url = raw.url || '/';
  }

  get body() {
    return Readable.toWeb(this.raw) as ReadableStream<Uint8Array>;
  }

  get headers(): ExotHeaders {
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
