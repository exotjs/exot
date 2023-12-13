export declare function normalizeHeader(header: string, lazy?: boolean): string;
export declare function lazyLowerCase(str: string): string;
export declare class HttpHeaders implements Headers {
    #private;
    static proxy(): HttpHeaders & Record<string, string | string[]>;
    [Symbol.iterator](): Generator<[string, string], void, unknown>;
    constructor(init?: Record<string, string>);
    get entries(): () => Generator<[string, string], void, unknown>;
    get keys(): () => Generator<string, void, unknown>;
    get map(): Record<string, string | string[]>;
    get values(): () => Generator<string, void, unknown>;
    append(name: string, value: string): void;
    delete: (name: string) => void;
    forEach: (fn: (value: string, key: string, parent: HttpHeaders) => void) => void;
    get: (name: string) => string | null;
    getSetCookie: () => string[];
    has: (name: string) => boolean;
    set: (name: string, value: string) => void;
    toJSON: () => Record<string, string | string[]>;
}
