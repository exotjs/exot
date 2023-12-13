import { type CookieSerializeOptions } from 'cookie';
import { Context } from './context';
export type CookiesSetOptions = CookieSerializeOptions;
export declare class Cookies {
    readonly ctx: Context;
    private _parsed?;
    constructor(ctx: Context);
    get parsed(): Record<string, string>;
    get: (name: string) => string;
    getAll: () => Record<string, string>;
    set: (name: string, value: string, options?: CookiesSetOptions) => void;
    delete: (name: string, options?: CookiesSetOptions) => void;
    serialize: (name: string, value: string, options?: CookiesSetOptions) => string;
}
