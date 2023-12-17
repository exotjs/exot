import qs from 'fast-querystring';
import { Context } from './context';
import type { ChainFn, MaybePromise, Trace } from './types';

export function awaitMaybePromise<T>(
  fn: ChainFn<T>,
  onResolved: (result: any) => MaybePromise<T>,
  onError: (err: any) => MaybePromise<T>,
  input?: T
): MaybePromise<T> {
  let result: MaybePromise<T>;
  try {
    result = fn(input as T) as T;
    if (result instanceof Promise) {
      return result.then(onResolved).catch(onError);
    }
  } catch (err) {
    return onError(err);
  }
  return onResolved(result);
}

export function chain<T>(
  fns: ChainFn<T>[],
  input?: T,
  i: number = 0,
  terminateOnReturn: boolean = true
): MaybePromise<unknown> {
  const fn = fns[i];
  if (!fn) {
    return;
  }
  const result = fn(input as T);
  if (result instanceof Promise) {
    return result.then((resolved) => {
      if (terminateOnReturn && resolved !== void 0) {
        return resolved;
      }
      return chain(fns, input, i + 1, terminateOnReturn);
    });
  }
  if (terminateOnReturn && result !== void 0) {
    return result;
  }
  return chain(fns, input, i + 1, terminateOnReturn);
}

export const chainAll = <T>(fns: ChainFn<T>[], input: T) => {
  return chain(fns, input, 0, false);
}

export function parseQueryString(querystring: string) {
  if (querystring[0] === '?') {
    querystring = querystring.slice(1);
  }
  return qs.parse(querystring);
}

export function printTraces<Ctx extends Context>(
  ctx: Ctx,
  warnAboveTime: number = 200,
  traces: Trace[] = ctx.traces,
  level: number = 0
) {
  if (level === 0) {
    const total = traces.reduce((acc, trace) => acc + trace.time, 0);
    // const contentType = ctx.res.headers['content-type'] || '?';
    const contentType = ctx.set.headers.get('content-type');
    console.log(
      `${ctx.method} ${ctx.path} (${ctx.set.status}, ${contentType}) [${
        Math.floor(total * 1000) / 1000
      }]`
    );
  }
  for (let trace of traces) {
    const str = `${'  '.repeat(level + 1)}${trace.name}${
      trace.desc ? ` (${trace.desc})` : ''
    } [${trace.time}] ${trace.error ?? ''}`;
    if (trace.error) {
      console.log('\x1b[31m%s\x1b[0m', str);
    } else if (warnAboveTime > 0 && trace.time > warnAboveTime) {
      console.log('\x1b[33m%s\x1b[0m', str);
    } else {
      console.log(str);
    }
    if (trace.traces) {
      printTraces(ctx, warnAboveTime, trace.traces, level + 1);
    }
  }
  if (level === 0) {
    console.log('');
  }
}

export function parseUrl(url: string = '/') {
  const slash = url[0] === '/' ? 0 : url.indexOf('/', 11);
  const search = url.indexOf('?', slash + 1);
  return {
    path: search === -1 ? url.substring(slash) : url.substring(slash, search),
    querystring: search === -1 ? '' : url.substring(search),
  };
}

export async function parseFormData(contentType: string, body: ArrayBuffer) {
  const req = new Request('http://localhost/', {
    body,
    headers: {
      'content-type': contentType,
    },
    method: 'POST',
  });
  return req.formData();
}

export function normalizeHeader(header: string) {
  if (header[0].toUpperCase() === header[0]) {
    return header;
  }
  const parts = header.split('-');
  for (let i = 0; i < parts.length; i++) {
    parts[i] = parts[i][0].toUpperCase() + parts[i].substring(1);
  }
  return parts.join('-');
}
