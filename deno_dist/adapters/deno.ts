import { FetchAdapter } from './fetch.ts';
import { awaitMaybePromise, parseUrl } from '../helpers.ts';
import { ExotWebSocket } from '../websocket.ts';
import type { ContextInterface, MaybePromise, WebSocketHandler } from '../types.ts';

export const adapter = () => new DenoAdapter();

export default adapter;

export class DenoAdapter extends FetchAdapter {
  async listen(port: number): Promise<number> {
    // @ts-expect-error
    Deno.serve({
      fetch: this.exot.fetch,
      port,
    });
    return port;
  }

  upgradeRequest(ctx: ContextInterface, handler: WebSocketHandler) {
    return awaitMaybePromise(
      () => {
        if (handler.beforeUpgrade) {
          return handler.beforeUpgrade(ctx);
        }
      },
      () => {
        // @ts-expect-error
        const { socket, response } = Deno.upgradeWebSocket(ctx.req) as {
          socket: WebSocket;
          response: Response;
        };
        const ws = new ExotWebSocket(this.exot, socket, {});
        socket.onclose = () => {
          handler.close?.(ws, ctx);
        };
        socket.onopen = () => {
          handler.open?.(ws, ctx);
        };
        socket.onmessage = (ev: MessageEvent) => {
          handler.message?.(ws, ev.data, ctx);
        };
        socket.onerror = (err: any) => {
          handler.error?.(ws, err, ctx);
        };
        return response;
      },
      (_err) => {
        return new Response('Request upgrade failed', {
          status: 500,
        });
      }
    );
  }
}
