import { awaitMaybePromise } from '../helpers';
export default () => new FetchAdapter();
export class FetchAdapter {
    exot;
    async close() {
        // noop
    }
    fetch(req) {
        const ctx = this.exot.context(req);
        return awaitMaybePromise(() => this.exot.handle(ctx), () => {
            let response;
            if (ctx.set.body instanceof Response) {
                response = ctx.set.body;
            }
            else {
                response = new Response(ctx.set.body, {
                    headers: ctx.set.headers,
                    status: ctx.set.status || void 0,
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
