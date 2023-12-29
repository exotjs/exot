import { RUNTIME } from '../env.ts';
import { BunAdapter } from './bun.ts';
import { DenoAdapter } from './deno.ts';
import { NodeAdapter } from './node.ts';
import type { Adapter } from '../types.ts';

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