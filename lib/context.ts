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
  // readonly res: ContextResponse<Params, Body, Query, ResponseBody, Shared, Store>;

  public bodySchema?: ValidateFunction<TSchema>;

  public route?: string;

  public terminated: boolean = false;

  public traces: Trace[] = [];

  /*
  public responseBody?: ResponseBody;

  readonly responseHeaders: Headers = process.versions.bun ? new Headers() : new HttpHeaders();

  public responseStatus: number = 0;
  */

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
    // this.res = new ContextResponse<Params, Body, Query, ResponseBody, Shared, Store>(this);
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
    return (value?: any) => {
      if (value !== void 0) {
        this.set.headers.set('content-type', 'application/json');
        this.set.body = JSON.stringify(value) as ResponseBody;
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
    return (value?: string) => {
      if (value !== void 0) {
        this.set.headers.set('content-type', 'text/plain');
        this.set.body = value as ResponseBody;
      } else {
        return this.req.text().then((body: string) => this.#validateBody(body));
        /*
        return chain<string>([
          () => this.req.text(),
          (body: string) => this.#validateBody(body),
        ]);
        */
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
}

/*
export class ContextResponse<
  Params = AnyRecord,
  Body = unknown,
  Query = AnyRecord,
  ResponseBody = unknown,
  Shared = unknown,
  Store = unknown,
> {
  static defaultHeaders = {
    'Content-Type': 'application/octet-stream',
  };

  body: any = void 0;

  bytesWritten: number = 0;

  readonly headers: Headers = process.versions.bun ? new Headers(ContextResponse.defaultHeaders) : new HttpHeaders(ContextResponse.defaultHeaders);

  statusCode: number = 0;

  constructor(
    readonly ctx: Context<Params, Body, Query, ResponseBody, Shared, Store>
  ) {
  }

  get contentType(): string | null {
    return String(this.headers.get('Content-Type') || '');
  }

  set contentType(value: string) {
    this.headers.set('Content-Type', value);
  }

  destroy() {
    this.body = void 0;
    this.bytesWritten = 0;
    this.statusCode = 0;
  }

  get json() {
    return (body: ResponseBody) => {
      this.contentType = 'application/json';
      this.body = JSON.stringify(body);
      return this;
    };
  }

  get text() {
    return (body: ResponseBody) => {
      this.contentType = 'text/plain';
      this.body = String(body);
      return this;
    };
  }

  get stream() {
    return (stream: Readable) => {
      this.body = stream;
    };
  }
}
*/
