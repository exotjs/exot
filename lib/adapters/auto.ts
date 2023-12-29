import { RUNTIME } from '../env.js';
import { BunAdapter } from './bun.js';
import { DenoAdapter } from './deno.js';
import { NodeAdapter } from './node.js';
import type { Adapter } from '../types.js';

export const adapter = getAutoAdapter();

export default adapter;

export function getAutoAdapter(fallback: new () => Adapter = NodeAdapter) {
  switch (RUNTIME) {
    case 'bun':
      return BunAdapter;
    case 'deno':
      return DenoAdapter;
    default:
      return fallback;
  }
}