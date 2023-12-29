import { FetchAdapter } from './fetch.js';
import type { ContextInterface, MaybePromise, WebSocketHandler } from '../types.js';
export declare const adapter: () => DenoAdapter;
export default adapter;
export declare class DenoAdapter extends FetchAdapter {
    listen(port: number): Promise<number>;
    upgradeRequest(ctx: ContextInterface, handler: WebSocketHandler): MaybePromise<Response>;
}
