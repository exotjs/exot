import { FetchAdapter } from './fetch.ts';
import { awaitMaybePromise } from '../helpers.ts';
import { ExotWebSocket } from '../websocket.ts';
import type { ContextInterface, MaybePromise, WebSocketHandler } from '../types.ts';

interface BunWebsocketData<UserData> {
  ctx: ContextInterface,
  handler: WebSocketHandler;
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

export const adapter = () => new BunAdapter();

export default adapter;

export class BunAdapter extends FetchAdapter {
  #server?: BunServer;

  get websocket(): BunWebsockets {
    const exot = this.exot;
    return {
      close(ws) {
        if (ws.data.handler && ws.data.ws) {
          ws.data.handler.close?.(ws.data.ws, ws.data.ctx);
          ws.data.ws.unsubscribeAll();
        }
      },
      drain(ws) {
        if (ws.data.handler && ws.data.ws) {
          ws.data.handler.drain?.(ws.data.ws, ws.data.ctx);
        }
      },
      error(ws, err) {
        if (ws.data.handler && ws.data.ws) {
          ws.data.handler.error?.(ws.data.ws, err, ws.data.ctx);
        }
      },
      message(ws, data) {
        if (ws.data.handler && ws.data.ws) {
          ws.data.handler.message?.(ws.data.ws, data, ws.data.ctx);
        }
      },
      open(ws) {
        if (ws.data.handler) {
          ws.data.ws = new ExotWebSocket(exot, ws, ws.data.ctx);
          ws.data.handler.open?.(ws.data.ws, ws.data.ctx);
        }
      },
    };
  }

  fetch(req: Request): MaybePromise<Response>;
  fetch(req: Request, server?: BunServer): MaybePromise<Response | undefined> {
    if (!this.#server && server) {
      this.#server = server;
    }
    return super.fetch(req);
  }

  async listen(port: number): Promise<number> {
    // @ts-expect-error
    this.#server = Bun.serve({
      fetch: this.exot.fetch,
      port,
      websocket: this.websocket,
    });
    return port;
  }

  upgradeRequest(ctx: ContextInterface, handler: WebSocketHandler) {
    const server = this.#server;
    if (!server) {
      throw new Error('Unable to upgrade.');
    }
    return awaitMaybePromise(
      () => {
        if (handler.beforeUpgrade) {
          return handler.beforeUpgrade(ctx);
        }
      },
      () => {
        const ok = server.upgrade(ctx.req, {
          data: {
            ctx,
            handler,
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
}
