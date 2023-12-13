import { IncomingMessage, ServerResponse, createServer } from 'node:http';
import { Exot } from '../exot';
import {
  Adapter,
  WsHandler,
} from '../types';
import { Readable } from 'stream';
import { Context } from '../context';
import {  awaitMaybePromise, parseFormData } from '../helpers';
import { HttpHeaders } from '../headers';
import { HttpRequest } from '../request';

const textDecoder = new TextDecoder();

export default () => new NodeAdapter();

export class NodeAdapter
  implements Adapter
{
  readonly server = createServer();

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
    return exot;
  }

  async fetch(req: Request): Promise<Response> {
    return new Response('');
  }

  ws(
    path: string,
    handler: WsHandler<any>
  ): void {}

  #sendResponse(ctx: Context, res: ServerResponse) {
    res.statusCode = ctx.set.status || 200;
    const headers = ctx.set.headers as HttpHeaders;
    for (let k in headers.map) {
      const v = headers.map[k];
      if (v !== null) {
        res.setHeader(k, v);
      }
    }
    if (ctx.set.body instanceof Readable) {
      ctx.set.body.pipe(res);
    } else {
      res.end(ctx.set.body);
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
