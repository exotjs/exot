import { FetchAdapter } from './fetch';
import { awaitMaybePromise, parseUrl } from '../helpers';
import { ExotWebSocket } from '../websocket';
import type { MaybePromise, WebSocketHandler } from '../types';

interface BunWebsocketData<UserData> {
  handler: WebSocketHandler<UserData>;
  userData: UserData;
  ws: ExotWebSocket<BunServerWebSocket, UserData>;
}

interface BunServer {
  upgrade: <UserData>(
    req: Request,
    options: { data: BunWebsocketData<UserData> }
  ) => boolean;
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
  message: (
    ws: BunServerWebSocket,
    message: string | ArrayBuffer | Uint8Array
  ) => void;
  open?: (ws: BunServerWebSocket) => void;
  close?: (ws: BunServerWebSocket) => void;
  error?: (ws: BunServerWebSocket, error: Error) => void;
  drain?: (ws: BunServerWebSocket) => void;
  perMessageDeflate?:
    | boolean
    | {
        compress?: boolean | string;
        decompress?: boolean | string;
      };
}

export default () => new BunAdapter();

export class BunAdapter extends FetchAdapter {
  #wsHandlers: Record<string, WebSocketHandler<any>> = {};

  get websocket(): BunWebsockets {
    const exot = this.exot;
    return {
      close(ws) {
        if (ws.data.handler && ws.data.ws) {
          ws.data.handler.close?.(ws.data.ws, ws.data.userData);
          ws.data.ws.unsubscribeAll();
        }
      },
      drain(ws) {
        if (ws.data.handler && ws.data.ws) {
          ws.data.handler.drain?.(ws.data.ws, ws.data.userData);
        }
      },
      error(ws, err) {
        if (ws.data.handler && ws.data.ws) {
          ws.data.handler.error?.(ws.data.ws, err, ws.data.userData);
        }
      },
      message(ws, data) {
        if (ws.data.handler && ws.data.ws) {
          ws.data.handler.message?.(ws.data.ws, data, ws.data.userData);
        }
      },
      open(ws) {
        if (ws.data.handler) {
          ws.data.ws = new ExotWebSocket(exot, ws, ws.data.userData)
          ws.data.handler.open?.(ws.data.ws, ws.data.userData);
        }
      },
    };
  }

  fetch(req: Request): MaybePromise<Response>;
  fetch(req: Request, server?: BunServer): MaybePromise<Response | undefined> {
    const { path } = parseUrl(req.url);
    const handler = this.#wsHandlers[path];
    if (server && handler) {
      return awaitMaybePromise(
        () => {
          if (handler.beforeUpgrade) {
            return handler.beforeUpgrade(req);
          }
        },
        (userData) => {
          const ok = server.upgrade(req, {
            data: {
              handler,
              userData,
              ws: null as any,
            },
          });
          return ok
            ? undefined
            : new Response('Request upgrade failed', {
                status: 400,
              });
        },
        (_err) => {
          return new Response('Request upgrade failed', {
            status: 500,
          });
        }
      );
    }
    return super.fetch(req);
  }

  async listen(port: number): Promise<number> {
    // @ts-expect-error
    Bun.serve({
      fetch: this.exot.fetch,
      port,
      websocket: this.websocket,
    });
    return port;
  }

  ws(path: string, handler: WebSocketHandler<any>): void {
    this.#wsHandlers[path] = handler;
  }
}
