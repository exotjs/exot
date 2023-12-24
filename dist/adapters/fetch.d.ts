import { Exot } from '../exot.js';
import { Adapter, MaybePromise } from '../types.js';
export declare const adapter: () => FetchAdapter;
export default adapter;
export declare class FetchAdapter implements Adapter {
    exot: Exot;
    close(): Promise<void>;
    fetch(req: Request): MaybePromise<Response>;
    listen(port: number): Promise<number>;
    mount(exot: Exot): Exot<{}, {}, {}, {}, import("../types.js").ContextInterface<{}, any, any, any, {}>>;
    ws(path: string, handler: any): void;
}
