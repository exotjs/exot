import { BunAdapter } from './bun.js';
import { DenoAdapter } from './deno.js';
import type { Adapter } from '../types.js';
export declare const adapter: typeof BunAdapter | typeof DenoAdapter | (new () => Adapter);
export default adapter;
export declare function getAutoAdapter(fallback?: new () => Adapter): typeof BunAdapter | typeof DenoAdapter | (new () => Adapter);
