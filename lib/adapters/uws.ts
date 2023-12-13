import { Readable } from 'node:stream';
import {
  App as uWebSockets,
  HttpResponse,
  SHARED_COMPRESSOR,
  us_socket_local_port,
  us_listen_socket_close,
  us_listen_socket as Socket,
  type WebSocketBehavior,
  type WebSocket,
  HttpRequest as UWSRequest,
} from 'uWebSockets.js';
import { Context } from '../context';
import { Exot } from '../exot';
import { Adapter, WsHandler } from '../types';
import { awaitMaybePromise, parseFormData } from '../helpers';
import { HttpHeaders } from 'lib/headers';
import { HttpRequest } from 'lib/request';

const textDecoder = new TextDecoder();

export default () => new UwsAdapter();

export class UwsAdapter implements Adapter {
  static defaultWebSocketOptions<UserData = unknown>(): WebSocketBehavior<UserData> {
    return {
      compression: SHARED_COMPRESSOR,
      idleTimeout: 120,
      maxBackpressure: 1024,
      maxPayloadLength: 16 * 1024 * 1024, // 16MB
    };
  }

  readonly #uws = uWebSockets();

  #socket?: Socket;

  async close() {
    if (this.#socket) {
      us_listen_socket_close(this.#socket);
      this.#socket = void 0;
    } else {
      this.#uws.close();
    }
  }

  async fetch(req: Request) {
    return new Response('uWebSockets adapter does not support fetch interface.', {
      status: 500,
    });
  }

  async listen(port: number = 0, host?: string): Promise<number> {
    return new Promise((resolve, reject) => {
      this.#uws.listen(port, (socket) => {
        if (socket) {
          this.#socket = socket;
          const localPort = us_socket_local_port(socket);
          resolve(localPort);
        } else {
          reject(new Error(`Failed to listen to port ${port}`));
        }
      });
    });
  }

  ws<UserData = unknown>(path: string, handler: WsHandler<WebSocket<UserData>>) {
    this.#uws.ws(path, {
      ...UwsAdapter.defaultWebSocketOptions<UserData>(),
      open: handler.open,
      close: handler.close,
      message: handler.message,
      upgrade: async (res, req, context) => {
        if (handler.upgrade) {
          // await handler.upgrade(new UwsRequest(req, res), res);
        }
        res.upgrade(
          {},
          req.getHeader('sec-websocket-key'),
          req.getHeader('sec-websocket-protocol'),
          req.getHeader('sec-websocket-extensions'),
          context,
        );
      },
    });
  }
  mount(exot: Exot) {
    this.#uws.any('/*', (res, req) => {
      res.pause();
      res.onAborted(() => {
        res.aborted = true;
      });
      const ctx = exot.context(new UwsRequest(req, res));
      return awaitMaybePromise(
        () => exot.handle(ctx),
        () => {
          res.resume();
          if (!res.aborted) {
            this.#writeHead(ctx, res, ctx.set.body);
            if (ctx.set.body instanceof Readable) {
              this.#pipeStreamToResponse(ctx, ctx.set.body, res);
            } else {
              ctx.destroy();
            }
          }
        },
        (_err) => {
          if (!res.aborted) {
            res.cork(() => {
              if (res.headersWritten) {
                res.end();
              } else {
                res.writeStatus('500');
                res.end('Unexpected server error');
              }
            });
            ctx.destroy();
          }
        },
      );
    });
  }

  #writeHead(ctx: Context, res: HttpResponse, body?: any) {
    res.cork(() => {
      res.writeStatus(String(ctx.set.status || 200));
      const headers = ctx.set.headers as HttpHeaders;
      for (let k in headers.map) {
        const v = headers.map[k];
        if (v !== null) {
          if (Array.isArray(v)) {
            for (let _v of v) {
              res.writeHeader(k, _v);
            }
          } else {
            res.writeHeader(k, v);
          }
        }
      }
      res.headersWritten = true;
      if (body !== void 0) {
        if (typeof body === 'string') {
          //ctx.res.bytesWritten = Buffer.byteLength(body);
          res.end(body);
        } else {
          const buf = Buffer.from(body);
          //ctx.res.bytesWritten = buf.byteLength;
          res.end(buf);
        }
      }
    });
  }

  async #pipeStreamToResponse(
    ctx: Context,
    stream: Readable,
    res: HttpResponse
  ): Promise<number> {
    let bytesWritten = 0;
    res.onAborted(() => {
      res.aborted = true;
      stream.destroy();
    });
    return new Promise((resolve, reject) => {
      stream.on('error', (err) => {
        reject(err);
      });
      stream.on('end', () => {
        if (!res.aborted) {
          res.cork(() => {
            res.end();
          });
        }
        //ctx.res.bytesWritten = bytesWritten;
        ctx.destroy();
        resolve(bytesWritten);
      });
      stream.on('data', (chunk: Buffer) => {
        const lastOffset = res.getWriteOffset();
        /*
        let ab = Buffer.from(chunk).subarray(
          chunk.byteOffset,
          chunk.byteOffset + chunk.byteLength
        );
        */
        let ab = Buffer.from(chunk);
        res.cork(() => {
          const ok = res.write(ab);
          bytesWritten += ab.byteLength;
          if (!ok) {
            // backpressure applied -> pause
            stream.pause();
            res.onWritable((offset) => {
              let _ok = false;
              res.cork(() => {
                ab = ab.subarray(offset - lastOffset);
                if ((_ok = res.write(ab))) {
                  stream.resume();
                }
                bytesWritten += ab.byteLength;
              });
              return _ok;
            });
          }
        });
      });
    });
  }
}

export class UwsRequest extends HttpRequest {
  #buffer?: Promise<Buffer>;

  #headers?: HttpHeaders;

  readonly method: string;

  readonly #path: string;

  readonly #querystring: string;

  #remoteAddress?: string;

  #stream?: ReadableStream<Uint8Array>;

  constructor(readonly raw: UWSRequest, readonly res: HttpResponse) {
    super();
    this.method = this.raw.getCaseSensitiveMethod();
    this.#path = this.raw.getUrl();
    this.#querystring = this.raw.getQuery();
  }

  arrayBuffer(): Promise<ArrayBuffer> {
    if (!this.#buffer) {
      let chunks: Buffer[] = []
      // force-read headers before the stream is read
      this.headers;
      const res = this.res;
      this.#buffer = new Promise((resolve) => {
        res.onAborted(() => {
          res.aborted = true;
        });
        res.onData((chunk, isLast) => {
          // chunk must be copied using slice
          chunks.push(Buffer.from(chunk.slice(0)));
          if (isLast) {
            resolve(Buffer.concat(chunks)); 
          }
        });
      });
    } 
    return this.#buffer;
  }

  get body(): ReadableStream<Uint8Array> {
    if (!this.#stream) {
      // force-read headers before the stream is read
      this.headers;
      let ctrl: ReadableStreamDefaultController<Uint8Array>;
      this.#stream = new ReadableStream({
        start(_ctrl) {
          ctrl = _ctrl;
        },
      });
      this.res.onAborted(() => {
        this.res.aborted = true;
        ctrl.error(new Error('Request stream aborted.'));
      });
      this.res.onData((chunk, isLast) => {
        // chunk must be copied using slice
        ctrl.enqueue(new Uint8Array(chunk.slice(0)));
        if (isLast) {
          ctrl.close();
        }
      });
    }
    return this.#stream;
  }

  /*
  get _body(): Readable {
    if (!this.#stream) {
      // force-read headers before the stream is read
      this.headers;

      const res = this.res;
      const stream = new Readable({
        destroy(err: any, cb: (err?: any) => void) {
          cb(err);
        },
        read() {
          res.resume();
        },
        emitClose: true,
      });
      res.onAborted(() => {
        res.aborted = true;
        stream.emit('error', new Error('Request stream aborted.'));
      });
      res.onData((chunk, isLast) => {
        // chunk must be copied using slice
        stream.push(Buffer.from(chunk.slice(0)));
        if (isLast) {
          stream.push(null);
        }
      });
      this.#stream = stream;
    }
    if (this.#stream.closed) {
      throw new Error('Stream is closed.');
    }
    return this.#stream;
  }
  */

  get headers(): HttpHeaders {
    if (!this.#headers) {
      this.#headers = new HttpHeaders();
      this.raw.forEach((k, v) => {
        this.#headers?.append(k, v);
      });
    }
    return this.#headers;
  }

  get url(): string {
    return this.#path + '?' + this.#querystring;
  }

  blob() {
    return Promise.resolve(new Blob([]));
  }

  clone() {
    return new UwsRequest(this.raw, this.res);
  }

  formData() {
    return this.arrayBuffer()
      .then((body) => parseFormData(String(this.headers.get('content-type') || ''), body));
  }

  json() {
    return this.text()
      .then(JSON.parse);
  }

  text() {
    return this.arrayBuffer()
      .then((buf) => textDecoder.decode(buf));
  }

  remoteAddress(): string {
    if (!this.#remoteAddress) {
      this.#remoteAddress = textDecoder.decode(this.res.getRemoteAddressAsText());
    }
    return this.#remoteAddress;
  }

  parsedUrl() {
    return {
      path: this.#path,
      querystring: this.#querystring,
    };
  }
}
