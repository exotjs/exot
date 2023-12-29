import { FetchAdapter } from './fetch.js';
import { awaitMaybePromise } from '../helpers.js';
import { ExotWebSocket } from '../websocket.js';
export const adapter = () => new BunAdapter();
export default adapter;
export class BunAdapter extends FetchAdapter {
    #server;
    get websocket() {
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
    fetch(req, server) {
        if (!this.#server && server) {
            this.#server = server;
        }
        return super.fetch(req);
    }
    async listen(port) {
        // @ts-expect-error
        this.#server = Bun.serve({
            fetch: this.exot.fetch,
            port,
            websocket: this.websocket,
        });
        return port;
    }
    upgradeRequest(ctx, handler) {
        const server = this.#server;
        if (!server) {
            throw new Error('Unable to upgrade.');
        }
        return awaitMaybePromise(() => {
            if (handler.beforeUpgrade) {
                return handler.beforeUpgrade(ctx);
            }
        }, () => {
            const ok = server.upgrade(ctx.req, {
                data: {
                    ctx,
                    handler,
                    ws: null,
                },
            });
            return ok
                ? undefined
                : new Response('Request upgrade failed', {
                    status: 400,
                });
        }, (_err) => {
            return new Response('Request upgrade failed', {
                status: 500,
            });
        });
    }
}
