import { Context } from '../context';
import { Exot } from '../exot';
import type { HTTPMethod } from '../types';
export type Origin = string[] | ((ctx: Context) => boolean);
export interface CORSOptions {
    allowedHeaders?: '*' | string[];
    credentials?: boolean;
    exposedHeaders?: '*' | string[];
    maxAge?: number;
    methods?: '*' | HTTPMethod[];
    origin?: '*' | true | string[];
    preflight?: boolean;
}
export declare const cors: (options?: CORSOptions) => Exot<{}, {}, {}, {}, import("../types").ContextInterface<any, any, any, any, {}, {}>>;
