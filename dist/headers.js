export function normalizeHeader(header, lazy = true) {
    if (lazy && header[0].toUpperCase() === header[0]) {
        return header;
    }
    const parts = header.split('-');
    for (let i = 0; i < parts.length; i++) {
        parts[i] = parts[i][0].toUpperCase() + parts[i].substring(1);
    }
    return parts.join('-');
}
export function lazyLowerCase(str) {
    if (str[0].toLowerCase() === str[0]) {
        return str;
    }
    return str.toLowerCase();
}
export class HttpHeaders {
    static proxy() {
        return new Proxy(new HttpHeaders(), {
            get(target, prop) {
                if (typeof target[prop] === 'function') {
                    return target[prop];
                }
                return target.get(String(prop));
            },
            getOwnPropertyDescriptor() {
                return {
                    enumerable: true,
                    configurable: true,
                };
            },
            ownKeys(target) {
                return Object.keys(target.record);
            },
            set(target, prop, value) {
                target.set(String(prop), value);
                return true;
            }
        });
    }
    #map = {};
    [Symbol.iterator]() {
        return this.entries();
    }
    constructor(init) {
        if (init) {
            for (let k in init) {
                this.set(k, init[k]);
            }
        }
    }
    get entries() {
        const map = this.#map;
        return function* () {
            for (let k in map) {
                const value = map[k];
                if (Array.isArray(value)) {
                    for (let v of value) {
                        yield [k, v];
                    }
                }
                else {
                    yield [k, value];
                }
            }
        };
    }
    get keys() {
        const map = this.#map;
        return function* () {
            for (let k in map) {
                yield k;
            }
        };
    }
    get map() {
        return this.#map;
    }
    get values() {
        const map = this.#map;
        return function* () {
            for (let k in map) {
                const value = map[k];
                if (Array.isArray(value)) {
                    for (let v of value) {
                        yield v;
                    }
                }
                else {
                    yield value;
                }
            }
        };
    }
    append(name, value) {
        name = lazyLowerCase(name);
        if (this.#map[name] !== void 0) {
            if (Array.isArray(this.#map[name])) {
                this.#map[name].push(value);
            }
            else {
                this.#map[name] = [this.#map[name], value];
            }
        }
        else {
            this.#map[name] = value;
        }
    }
    delete = (name) => {
        delete this.#map[lazyLowerCase(name)];
    };
    forEach = (fn) => {
        for (let k in this.#map) {
            const value = this.#map[k];
            if (Array.isArray(value)) {
                for (let v of value) {
                    fn(v, k, this);
                }
            }
            else {
                fn(this.#map[k], k, this);
            }
        }
    };
    get = (name) => {
        const value = this.#map[lazyLowerCase(name)];
        return value !== void 0 ? (Array.isArray(value) ? value.join(', ') : String(value)) : null;
    };
    getSetCookie = () => {
        const value = this.#map['set-cookie'];
        if (value !== void 0 && !Array.isArray(value)) {
            return [value];
        }
        return value || [];
    };
    has = (name) => {
        return this.get(name) !== null;
    };
    set = (name, value) => {
        this.#map[lazyLowerCase(name)] = value;
    };
    toJSON = () => {
        return this.#map;
    };
}
