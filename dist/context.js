import { randomUUID } from 'node:crypto';
import { validateSchema } from './validation.js';
import { Cookies } from './cookies.js';
import { RUNTIME } from './env.js';
import { ExotHeaders } from './headers.js';
import { parseUrl, parseQueryString, awaitMaybePromise } from './helpers.js';
export class Context {
    bodySchema;
    params;
    pubsub;
    req;
    requestId = randomUUID();
    responseSchema;
    route;
    store;
    terminated = false;
    traces = [];
    tracingEnabled;
    #cookies;
    #path;
    #query;
    #querystring;
    #currentTrace;
    #res = {
        body: void 0,
        headers: RUNTIME === 'bun' ? new Headers() : new ExotHeaders(),
        status: 0,
    };
    constructor(init) {
        const { req, params = {}, store = {}, tracingEnabled = false, } = init;
        this.req = req;
        this.params = params;
        this.store = store;
        this.tracingEnabled = tracingEnabled;
        let parsed;
        if (typeof this.req.parsedUrl === 'function') {
            parsed = this.req.parsedUrl();
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
    get res() {
        return this.#res;
    }
    get arrayBuffer() {
        return (value) => {
            if (value !== void 0) {
                this.res.headers.set('Content-Type', 'application/octet-stream');
                this.res.body = value;
            }
            else {
                return this.req.arrayBuffer();
            }
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
                this.res.headers.set('Content-Type', 'application/json');
                this.res.body = JSON.stringify(validate === false ? value : this.#validateResponse(value));
            }
            else {
                return this.req.json().then((body) => this.#validateBody(body));
            }
        };
    }
    get stream() {
        return (value) => {
            if (value) {
                this.res.body = value;
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
                this.res.headers.set('Content-Type', 'text/plain');
                this.res.body = (validate === false ? value : this.#validateResponse(value));
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
        return (fn, name = fn.name, desc) => {
            if (!this.tracingEnabled) {
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
    #validateBody(body) {
        if (this.bodySchema) {
            return this.trace(() => validateSchema(this.bodySchema, body, 'body'), '@validate:body');
        }
        return body;
    }
    #validateResponse(response) {
        if (this.responseSchema) {
            return this.trace(() => validateSchema(this.responseSchema, response, 'response'), '@validate:response');
        }
        return response;
    }
}
