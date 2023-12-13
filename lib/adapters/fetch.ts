import { Exot } from '../exot';
import { Adapter, MaybePromise } from '../types';
import { awaitMaybePromise } from '../helpers';

export default () => new FetchAdapter();

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
        if (ctx.set.body instanceof Response) {
          response = ctx.set.body;
        } else {
          response = new Response(ctx.set.body as any, {
            headers: ctx.set.headers,
            status: ctx.set.status || void 0,
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

  ws(path: string, handler: any): void {
    throw new Error('Not implemented.');
  }
}
