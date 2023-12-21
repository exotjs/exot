import { Exot } from '../exot';
import { Adapter, MaybePromise } from '../types';
declare const _default: () => FetchAdapter;
export default _default;
export declare class FetchAdapter implements Adapter {
    exot: Exot;
    close(): Promise<void>;
    fetch(req: Request): MaybePromise<Response>;
    listen(port: number): Promise<number>;
    mount(exot: Exot): Exot<{}, {}, {}, {}, import("../types").ContextInterface<{}, any, any, any, {}>>;
    ws(path: string, handler: any): void;
}
