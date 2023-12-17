import { validateSchema } from './validation';
import { Cookies } from './cookies';
import { RUNTIME } from './env';
import { HttpHeaders } from './headers';
import { parseUrl, parseQueryString, awaitMaybePromise } from './helpers';
export class Context {
    req;
    params;
    shared;
    store;
    tracing;
    bodySchema;
    pubsub;
    responseSchema;
    route;
    terminated = false;
    traces = [];
    #cookies;
    #path;
    #query;
    #querystring;
    #currentTrace;
    #set = {
        body: void 0,
        headers: RUNTIME === 'bun' ? new Headers() : new HttpHeaders(),
        status: 0,
    };
    constructor(req, params = {}, shared = {}, store = {}, tracing = false) {
        this.req = req;
        this.params = params;
        this.shared = shared;
        this.store = store;
        this.tracing = tracing;
        let parsed;
        if (typeof req.parsedUrl === 'function') {
            parsed = req.parsedUrl();
        }
        else {
            parsed = parseUrl(this.req.url);
        }
        this.#path = parsed.path;
        this.#querystring = parsed.querystring;
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
        return (value, validate) => {
            if (value !== void 0) {
                if (!this.set.headers.has('content-type')) {
                    this.set.headers.set('content-type', 'application/json');
                }
                this.set.body = JSON.stringify(validate === false ? value : this.#validateResponse(value));
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
        return (value, validate) => {
            if (value !== void 0) {
                if (!this.set.headers.has('content-type')) {
                    this.set.headers.set('content-type', 'text/plain');
                }
                this.set.body = (validate === false ? value : this.#validateResponse(value));
            }
            else {
                return this.req.text().then((body) => this.#validateBody(body));
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
    #validateResponse(response) {
        if (this.responseSchema) {
            return this._trace(() => validateSchema(this.responseSchema, response, 'response'), '@validate:response');
        }
        return response;
    }
}
