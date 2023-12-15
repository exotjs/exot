import { Readable } from 'node:stream';
import { TSchema } from '@sinclair/typebox';
import { validateSchema } from './validation';
import { Cookies } from './cookies';
import { HttpHeaders } from './headers';
import { chain, parseUrl, parseQueryString, awaitMaybePromise } from './helpers';
import type { ValidateFunction } from 'ajv';
import type { AnyRecord, HTTPMethod, MaybePromise, Trace } from './types';
import { HttpRequest } from './request';

export class Context<
  Params = AnyRecord,
  Body = unknown,
  Query = AnyRecord,
  ResponseBody = unknown,
  Shared = unknown,
  Store = unknown,
> {
  public bodySchema?: ValidateFunction<TSchema>;

  public responseSchema?: ValidateFunction<TSchema>;

  public route?: string;

  public terminated: boolean = false;

  public traces: Trace[] = [];

  #cookies?: Cookies;

  #path: string;

  #query?: Record<string, string>;

  #querystring: string;

  #currentTrace?: Trace;

  #set = {
    body: void 0 as ResponseBody,
    headers: process.versions.bun ? new Headers() : new HttpHeaders(),
    status: 0,
  };

  constructor(
    readonly req: Request & HttpRequest,
    readonly params: Params = {} as Params,
    readonly shared: Shared = {} as Shared,
    readonly store: Store = {} as Store,
    public tracing: boolean = false,
  ) {
    /*
    if (typeof req.parsedUrl === 'function') {
      const { path, querystring } = req.parsedUrl();
      this.#path = path;
      this.#querystring = querystring;
    } else {
    */
      const { path, querystring } = parseUrl(this.req.url);
      this.#path = path;
      this.#querystring = querystring;
    // }
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

  get set() {
    return this.#set;
  }

  get arrayBuffer() {
    return () => {
     return this.req.arrayBuffer();
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
        if (!this.set.headers.has('content-type')) {
          this.set.headers.set('content-type', 'application/json');
        }
        this.set.body = JSON.stringify(validate === false ? value : this.#validateResponse(value)) as ResponseBody;
      } else {
        return this.req.json().then((body: Body) => this.#validateBody(body));
      }
    };
  }

  get stream() {
    return <T = ReadableStream | Readable>(value?: T) => {
      if (value) {
        this.set.body = value as ResponseBody;
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
        if (!this.set.headers.has('content-type')) {
          this.set.headers.set('content-type', 'text/plain');
        }
        this.set.body = (validate === false ? value : this.#validateResponse(value)) as ResponseBody;
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
    return this._trace;
  }

  _trace<T>(fn: () => T, name: string = fn.name, desc?: string): MaybePromise<T> {
    if (!this.tracing) {
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
  }

  destroy() {
    this.bodySchema = void 0;
    this.route = void 0;
    this.#cookies = void 0;
    this.#query = void 0;
    this.#currentTrace = void 0;
    //this.req.destroy?.();
    // this.res.destroy();
  }

  end() {
    this.terminated = true;
  }

  #validateBody<T = Body>(body: T): T {
    if (this.bodySchema) {
      return this._trace<T>(() => validateSchema(this.bodySchema!, body, 'body') as T, '@validate:body') as T;
    }
    return body;
  }

  #validateResponse<T = ResponseBody>(response: T): T {
    if (this.responseSchema) {
      return this._trace<T>(() => validateSchema(this.responseSchema!, response, 'response') as T, '@validate:response') as T;
    }
    return response;
  }
}
