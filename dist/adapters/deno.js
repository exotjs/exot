import { FetchAdapter } from './fetch.js';
import { awaitMaybePromise } from '../helpers.js';
import { ExotWebSocket } from '../websocket.js';
export const adapter = () => new DenoAdapter();
export default adapter;
export class DenoAdapter extends FetchAdapter {
    async listen(port) {
        // @ts-expect-error
        Deno.serve({
            fetch: this.exot.fetch,
            port,
        });
        return port;
    }
    upgradeRequest(ctx, handler) {
        return awaitMaybePromise(() => {
            if (handler.beforeUpgrade) {
                return handler.beforeUpgrade(ctx);
            }
        }, () => {
            // @ts-expect-error
            const { socket, response } = Deno.upgradeWebSocket(ctx.req);
            const ws = new ExotWebSocket(this.exot, socket, {});
            socket.onclose = () => {
                handler.close?.(ws, ctx);
            };
            socket.onopen = () => {
                handler.open?.(ws, ctx);
            };
            socket.onmessage = (ev) => {
                handler.message?.(ws, ev.data, ctx);
            };
            socket.onerror = (err) => {
                handler.error?.(ws, err, ctx);
            };
            return response;
        }, (_err) => {
            return new Response('Request upgrade failed', {
                status: 500,
            });
        });
    }
}
