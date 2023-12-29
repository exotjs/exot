import { randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { TSchema } from 'npm:@sinclair/typebox@0.31.23';
import { validateSchema } from './validation.ts';
import { Cookies } from './cookies.ts';
import { RUNTIME } from './env.ts';
import { ExotHeaders } from './headers.ts';
import { parseUrl, parseQueryString, awaitMaybePromise } from './helpers.ts';
import type { ValidateFunction } from 'npm:ajv@8.12.0';
import type { AnyRecord, ContextInit, HTTPMethod, MaybePromise, Trace } from './types.ts';
import { ExotRequest } from './request.ts';
import { PubSub } from './pubsub.ts';

export class Context<
  Params = AnyRecord,
  Body = unknown,
  Query = AnyRecord,
  ResponseBody = unknown,
  Store = unknown,
> {
  public bodySchema?: ValidateFunction<TSchema>;

  readonly params: Params;

  public pubsub!: PubSub;

  readonly req: Request & ExotRequest;

  readonly requestId: string = randomUUID();

  public responseSchema?: ValidateFunction<TSchema>;

  public route?: string;

  readonly store: Store;

  public terminated: boolean = false;

  public traces: Trace[] = [];

  public tracingEnabled: boolean;

  #cookies?: Cookies;

  #path: string;

  #query?: Record<string, string>;

  #querystring: string;

  #currentTrace?: Trace;

  #res = {
    body: void 0 as ResponseBody,
    headers: RUNTIME === 'bun' ? new Headers() : new ExotHeaders(),
    status: 0,
  };

  constructor(
    init: ContextInit
  ) {
    const {
      req,
      params = {},
      store = {},
      tracingEnabled = false,
    } = init;
    this.req = req;
    this.params = params as Params;
    this.store = store as Store;
    this.tracingEnabled = tracingEnabled;
    let parsed: { path: string, querystring: string };
    if (typeof this.req.parsedUrl === 'function') {
      parsed = this.req.parsedUrl();
    } else {
      parsed = parseUrl(this.req.url);
    }
    this.#path = parsed.path;
    this.#querystring = parsed.querystring;
  }

  get cookies() {
    if (!this.#cookies) {
      this.#cookies = new Cookies(this as Context);
    }
    return this.#cookies;
  }

  get contentType(): string | null {
    return this.headers.get('Content-Type');
  }

  get headers() {
    return this.req.headers;
  }

  get host(): string | null {
    return this.headers.get('Host');
  }

  get method(): HTTPMethod {
    return this.req.method as HTTPMethod;
  }

  get path() {
    return this.#path;
  }

  get querystring() {
    return this.#querystring;
  }

  get query(): Query {
    if (!this.#query) {
      this.#query = parseQueryString(this.querystring);
    }
    return this.#query as Query;
  }

  get remoteAddress() {
    if (this.req.remoteAddress) {
      return this.req.remoteAddress();
    }
    const value = this.headers.get('X-Forwarded-For');
    if (Array.isArray(value)) {
      return value.join(',');
    }
    return value;
  }

  get res() {
    return this.#res;
  }

  get arrayBuffer() {
    return (value?: ArrayBuffer) => {
      if (value !== void 0) {
        if (!this.res.headers.has('content-type')) {
          this.res.headers.set('content-type', 'application/octet-stream');
        }
        this.res.body = value as ResponseBody;
      } else {
        return this.req.arrayBuffer();
      }
    };
  }

  get formData() {
    return () => {
      return this.req.formData();
    };
  };

  get json() {
    return (value?: any, validate?: boolean) => {
      if (value !== void 0) {
        if (!this.res.headers.has('content-type')) {
          this.res.headers.set('content-type', 'application/json');
        }
        this.res.body = JSON.stringify(validate === false ? value : this.#validateResponse(value)) as ResponseBody;
      } else {
        return this.req.json().then((body: Body) => this.#validateBody(body));
      }
    };
  }

  get stream() {
    return <T = ReadableStream | Readable>(value?: T) => {
      if (value) {
        this.res.body = value as ResponseBody;
      } else {
        const stream = this.req.body;
        // @ts-expect-error
        if (stream?.locked === true || stream?.closed === true) {
          throw new Error('Stream has been already consumed.');
        }
        return stream as T;
      }
    };
  }

  get text() {
    return (value?: string, validate?: boolean) => {
      if (value !== void 0) {
        if (!this.res.headers.has('content-type')) {
          this.res.headers.set('content-type', 'text/plain');
        }
        this.res.body = (validate === false ? value : this.#validateResponse(value)) as ResponseBody;
      } else {
        return this.req.text().then((body: string) => this.#validateBody(body));
      }
    };
  }

  get traceStart() {
    return (name: string = 'unknown', desc?: string) => {
      const start = performance.now(); 
      const trace: Trace = {
        desc,
        name,
        parent: this.#currentTrace,
        start,
        time: 0,
        traces: [],
      };
      if (this.#currentTrace) {
        this.#currentTrace.traces.push(trace);
      } else {
        this.traces.push(trace);
      }
      this.#currentTrace = trace;
      return trace;
    };
  }

  get traceEnd() {
    return (error?: any) => {
      if (this.#currentTrace) {
        this.#currentTrace.time = Math.floor((performance.now() - this.#currentTrace.start) * 1000) / 1000;
        this.#currentTrace.error = error;
        this.#currentTrace = this.#currentTrace.parent;
      }
    };
  }

  get trace() {
    return <T>(fn: () => T, name: string = fn.name, desc?: string): MaybePromise<T> => {
      if (!this.tracingEnabled) {
        return fn();
      }
      this.traceStart(name, desc);
      return awaitMaybePromise(
        fn,
        (result) => {
          this.traceEnd()
          return result;
        },
        (err) => {
          this.traceEnd(err)
          throw err;
        },
        this,
      );
    };
  }

  destroy() {
    this.bodySchema = void 0;
    this.route = void 0;
    this.#cookies = void 0;
    this.#query = void 0;
    this.#currentTrace = void 0;
  }

  end() {
    this.terminated = true;
  }

  #validateBody<T = Body>(body: T): T {
    if (this.bodySchema) {
      return this.trace<T>(() => validateSchema(this.bodySchema!, body, 'body') as T, '@validate:body') as T;
    }
    return body;
  }

  #validateResponse<T = ResponseBody>(response: T): T {
    if (this.responseSchema) {
      return this.trace<T>(() => validateSchema(this.responseSchema!, response, 'response') as T, '@validate:response') as T;
    }
    return response;
  }
}
