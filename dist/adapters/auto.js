import { RUNTIME } from '../env.js';
import { BunAdapter } from './bun.js';
import { DenoAdapter } from './deno.js';
import { NodeAdapter } from './node.js';
export const adapter = getAutoAdapter();
export default adapter;
export function getAutoAdapter(fallback = NodeAdapter) {
    switch (RUNTIME) {
        case 'bun':
            return BunAdapter;
        case 'deno':
            return DenoAdapter;
        default:
            return fallback;
    }
}
