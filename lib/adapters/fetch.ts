import { Exot } from '../exot.js';
import { Adapter, ContextInterface, MaybePromise, WebSocketHandler } from '../types.js';
import { awaitMaybePromise } from '../helpers.js';

export const adapter = () => new FetchAdapter();

export default adapter;

export class FetchAdapter implements Adapter {
  exot!: Exot;

  async close(): Promise<void> {
    // noop
  }

  fetch(req: Request): MaybePromise<Response> {
    const ctx = this.exot.context(req);
    return awaitMaybePromise(
      () => this.exot.handle(ctx),
      () => {
        let response: Response;
        if (ctx.res.body instanceof Response) {
          response = ctx.res.body;
        } else {
          response = new Response(ctx.res.body as any, {
            headers: ctx.res.headers,
            status: ctx.res.status || void 0,
          });
        }
        ctx.destroy();
        return response;
      },
      (_err) => {
        const response = new Response('Unexpected server error', {
          status: 500,
        });
        ctx.destroy();
        return response;
      },
    )
  }

  async listen(port: number): Promise<number> {
    throw new Error('Not implemented.');
  }

  mount(exot: Exot) {
    this.exot = exot;
    return exot;
  }

  upgradeRequest(ctx: ContextInterface, handler: WebSocketHandler) {
    throw new Error('Not implemented.');
  }
}
