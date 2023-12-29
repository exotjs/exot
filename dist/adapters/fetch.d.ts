import { Exot } from '../exot.js';
import { Adapter, ContextInterface, MaybePromise, WebSocketHandler } from '../types.js';
export declare const adapter: () => FetchAdapter;
export default adapter;
export declare class FetchAdapter implements Adapter {
    exot: Exot;
    close(): Promise<void>;
    fetch(req: Request): MaybePromise<Response>;
    listen(port: number): Promise<number>;
    mount(exot: Exot): Exot<{}, {}, {}, {}, ContextInterface<{}, any, any, any, {}>>;
    upgradeRequest(ctx: ContextInterface, handler: WebSocketHandler): void;
}
