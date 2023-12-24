import { parse as parseCookies, serialize as serializeCookie, type CookieSerializeOptions } from 'npm:cookie@0.6.0';
import { Context } from './context.ts';

export type CookiesSetOptions = CookieSerializeOptions;

export class Cookies {
  private _parsed?: Record<string, string>;

  constructor(readonly ctx: Context) {
  }

  get parsed() {
    if (!this._parsed) {
      const cookies = this.ctx.headers.get('Cookie');
      this._parsed = cookies ? parseCookies(cookies) : {};
    }
    return this._parsed;
  }

  get = (name: string) => {
    return this.parsed[name];
  };

  getAll = () => {
    return this.parsed;
  };

  set = (name: string, value: string, options?: CookiesSetOptions) => {
    this.ctx.res.headers.append('Set-Cookie', this.serialize(name, value, options));
  };

  delete = (name: string, options?: CookiesSetOptions) => {
    this.set(name, '', {
      ...options,
      expires: new Date(0),
    });
  };

  serialize = (name: string, value: string, options?: CookiesSetOptions) => {
    return serializeCookie(name, value, options);
  };
}