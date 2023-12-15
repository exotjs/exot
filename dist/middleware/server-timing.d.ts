import { Exot } from '../exot';
export interface ServerTimingOptions {
    includeInternal?: boolean;
}
export declare const serverTiming: (options?: ServerTimingOptions) => Exot<{}, {}, {}, {}, import("../types").ContextInterface<any, any, any, any, {}, {}>>;
