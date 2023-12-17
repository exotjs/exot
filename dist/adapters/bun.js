import { FetchAdapter } from './fetch';
import { awaitMaybePromise, parseUrl } from '../helpers';
import { ExotWebSocket } from '../websocket';
export default () => new BunAdapter();
export class BunAdapter extends FetchAdapter {
    #wsHandlers = {};
    get websocket() {
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
                    ws.data.ws = new ExotWebSocket(exot, ws, ws.data.userData);
                    ws.data.handler.open?.(ws.data.ws, ws.data.userData);
                }
            },
        };
    }
    fetch(req, server) {
        const { path } = parseUrl(req.url);
        const handler = this.#wsHandlers[path];
        if (server && handler) {
            return awaitMaybePromise(() => {
                if (handler.beforeUpgrade) {
                    return handler.beforeUpgrade(req);
                }
            }, (userData) => {
                const ok = server.upgrade(req, {
                    data: {
                        handler,
                        userData,
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
        return super.fetch(req);
    }
    async listen(port) {
        // @ts-expect-error
        Bun.serve({
            fetch: this.exot.fetch,
            port,
            websocket: this.websocket,
        });
        return port;
    }
    ws(path, handler) {
        this.#wsHandlers[path] = handler;
    }
}
