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

export const cors =  (options: CORSOptions = {}) => {
  const {
    allowedHeaders = '*',
    credentials = false,
    exposedHeaders = '*',
    maxAge = 600,
    methods = '*',
    origin = true,
    preflight = true,
  } = options;

  function setAllowOrigin(ctx: Context, originHeader: string) {
    if (origin === '*') {
      ctx.set.headers.set('vary', '*');
      ctx.set.headers.set('access-control-allow-origin', '*');
    
    } else if (origin === true) {
      ctx.set.headers.set('vary', originHeader ? 'origin' : '*');
      ctx.set.headers.set('access-control-allow-origin', originHeader || '*');

    } else if (origin.includes(originHeader)) {
      ctx.set.headers.set('vary', 'origin');
      ctx.set.headers.set('access-control-allow-origin', originHeader);
    }
  }

  function setHeader(ctx: Context, name: string, value: string | string[]) {
    if (value?.length) {
      ctx.set.headers.set(name, Array.isArray(value) ? value.join(', ') : value);
    }
  }

  return new Exot({
    name: 'middleware/cors',
  })
    .use((ctx) => {
      const originHeader = ctx.headers.get('origin'); 
      if (originHeader) {
        setAllowOrigin(ctx, originHeader);
        setHeader(ctx, 'access-control-allow-methods', methods);
        setHeader(ctx, 'access-control-allow-headers', allowedHeaders);
        if (credentials) {
          ctx.set.headers.set('access-control-allow-credentials', 'true');
        }
        if (ctx.method === 'OPTIONS' && preflight) {
          ctx.set.status = 204;
          if (maxAge) {
            ctx.set.headers.set('access-control-max-age', String(maxAge));
          }
          return '';
        } else if (ctx.method !== 'OPTIONS') {
          setHeader(ctx, 'access-control-exposed-headers', exposedHeaders);
        } 
      }
    });
};