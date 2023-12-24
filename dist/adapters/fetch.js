import { awaitMaybePromise } from '../helpers';
export const adapter = () => new FetchAdapter();
export default adapter;
export class FetchAdapter {
    exot;
    async close() {
        // noop
    }
    fetch(req) {
        const ctx = this.exot.context(req);
        return awaitMaybePromise(() => this.exot.handle(ctx), () => {
            let response;
            if (ctx.res.body instanceof Response) {
                response = ctx.res.body;
            }
            else {
                response = new Response(ctx.res.body, {
                    headers: ctx.res.headers,
                    status: ctx.res.status || void 0,
                });
            }
            ctx.destroy();
            return response;
        }, (_err) => {
            const response = new Response('Unexpected server error', {
                status: 500,
            });
            ctx.destroy();
            return response;
        });
    }
    async listen(port) {
        throw new Error('Not implemented.');
    }
    mount(exot) {
        this.exot = exot;
        return exot;
    }
    ws(path, handler) {
        throw new Error('Not implemented.');
    }
}
