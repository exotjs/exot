export function normalizeHeader(header: string, lazy: boolean = true) {
  if (lazy && header[0].toUpperCase() === header[0]) {
    return header;
  }
  const parts = header.split('-');
  for (let i = 0; i < parts.length; i ++) {
    parts[i] = parts[i][0].toUpperCase() + parts[i].substring(1);
  }
  return parts.join('-');
}

export function lazyLowerCase(str: string) {
  if (str[0].toLowerCase() === str[0]) {
    return str;
  }
  return str.toLowerCase();
}

export class HttpHeaders implements Headers { 
  static proxy() {
    return new Proxy(new HttpHeaders() as HttpHeaders & Record<string, string | string[]>, {
      get(target, prop: string) {
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

  readonly #map: Record<string, string | string[]> = {};

  [Symbol.iterator]() {
    return this.entries();
  }

  constructor(init?: Record<string, string>) {
    if (init) {
      for (let k in init) {
        this.set(k, init[k]);
      }
    }
  }

  get entries() {
    const map = this.#map;
    return function *() {
      for (let k in map) {
        const value = map[k];
        if (Array.isArray(value)) {
          for (let v of value) {
            yield [k, v] as [string, string];
          }
        } else {
          yield [k, value] as [string, string];
        }
      }
    }
  }

  get keys() {
    const map = this.#map;
    return function *() {
      for (let k in map) {
        yield k;
      }
    }
  }

  get map() {
    return this.#map;
  }
  
  get values() {
    const map = this.#map;
    return function *() {
      for (let k in map) {
        const value = map[k];
        if (Array.isArray(value)) {
          for (let v of value) {
            yield v as string;
          }
        } else {
          yield value as string;
        }
      }
    }
  }

  append(name: string, value: string) {
    name = lazyLowerCase(name);
    if (this.#map[name] !== void 0) {
      if (Array.isArray(this.#map[name])) {
        (this.#map[name] as string[]).push(value);
      } else {
        this.#map[name] = [this.#map[name] as string, value];
      }
    } else {
      this.#map[name] = value;
    }
  }

  delete = (name: string) => {
    delete this.#map[lazyLowerCase(name)];
  }

  forEach = (fn: (value: string, key: string, parent: HttpHeaders) => void) => {
    for (let k in this.#map) {
      const value = this.#map[k];
      if (Array.isArray(value)) {
        for (let v of value) {
          fn(v, k, this);
        }
      } else {
        fn(this.#map[k] as string, k, this);
      }
    }
  }

  get = (name: string) => {
    const value = this.#map[lazyLowerCase(name)];
    return value !== void 0 ? (Array.isArray(value) ? value.join(', ') : String(value)) : null;
  }

  getSetCookie = () => {
    const value = this.#map['set-cookie'];
    if (value !== void 0 && !Array.isArray(value)) {
      return [value];
    }
    return value || []; 
  }

  has = (name: string) => {
    return this.get(name) !== null;
  }

  set = (name: string, value: string) => {
    this.#map[lazyLowerCase(name)] = value;
  }
  
  toJSON = () => {
    return this.#map;
  }
}
