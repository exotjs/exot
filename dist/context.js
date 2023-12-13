import { validateSchema } from './validation';
import { Cookies } from './cookies';
import { HttpHeaders } from './headers';
import { parseUrl, parseQueryString, awaitMaybePromise } from './helpers';
export class Context {
    req;
    params;
    shared;
    store;
    tracing;
    // readonly res: ContextResponse<Params, Body, Query, ResponseBody, Shared, Store>;
    bodySchema;
    route;
    terminated = false;
    traces = [];
    /*
    public responseBody?: ResponseBody;
  
    readonly responseHeaders: Headers = process.versions.bun ? new Headers() : new HttpHeaders();
  
    public responseStatus: number = 0;
    */
    #cookies;
    #path;
    #query;
    #querystring;
    #currentTrace;
    #set = {
        body: void 0,
        headers: process.versions.bun ? new Headers() : new HttpHeaders(),
        status: 0,
    };
    constructor(req, params = {}, shared = {}, store = {}, tracing = false) {
        this.req = req;
        this.params = params;
        this.shared = shared;
        this.store = store;
        this.tracing = tracing;
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
            this.#cookies = new Cookies(this);
        }
        return this.#cookies;
    }
    get contentType() {
        return this.headers.get('Content-Type');
    }
    get headers() {
        return this.req.headers;
    }
    get host() {
        return this.headers.get('Host');
    }
    get method() {
        return this.req.method;
    }
    get path() {
        return this.#path;
    }
    get querystring() {
        return this.#querystring;
    }
    get query() {
        if (!this.#query) {
            this.#query = parseQueryString(this.querystring);
        }
        return this.#query;
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
    }
    ;
    get json() {
        return (value) => {
            if (value !== void 0) {
                this.set.headers.set('content-type', 'application/json');
                this.set.body = JSON.stringify(value);
            }
            else {
                return this.req.json().then((body) => this.#validateBody(body));
            }
        };
    }
    get stream() {
        return (value) => {
            if (value) {
                this.set.body = value;
            }
            else {
                const stream = this.req.body;
                // @ts-expect-error
                if (stream?.locked === true || stream?.closed === true) {
                    throw new Error('Stream has been already consumed.');
                }
                return stream;
            }
        };
    }
    get text() {
        return (value) => {
            if (value !== void 0) {
                this.set.headers.set('content-type', 'text/plain');
                this.set.body = value;
            }
            else {
                return this.req.text().then((body) => this.#validateBody(body));
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
        return (name = 'unknown', desc) => {
            const start = performance.now();
            const trace = {
                desc,
                name,
                parent: this.#currentTrace,
                start,
                time: 0,
                traces: [],
            };
            if (this.#currentTrace) {
                this.#currentTrace.traces.push(trace);
            }
            else {
                this.traces.push(trace);
            }
            this.#currentTrace = trace;
            return trace;
        };
    }
    get traceEnd() {
        return (error) => {
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
    _trace(fn, name = fn.name, desc) {
        if (!this.tracing) {
            return fn();
        }
        this.traceStart(name, desc);
        return awaitMaybePromise(fn, (result) => {
            this.traceEnd();
            return result;
        }, (err) => {
            this.traceEnd(err);
            throw err;
        }, this);
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
    #validateBody(body) {
        if (this.bodySchema) {
            return this._trace(() => validateSchema(this.bodySchema, body, 'body'), '@validate:body');
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
