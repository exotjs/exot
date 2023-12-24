import { parse as parseCookies, serialize as serializeCookie } from 'cookie';
export class Cookies {
    ctx;
    _parsed;
    constructor(ctx) {
        this.ctx = ctx;
    }
    get parsed() {
        if (!this._parsed) {
            const cookies = this.ctx.headers.get('Cookie');
            this._parsed = cookies ? parseCookies(cookies) : {};
        }
        return this._parsed;
    }
    get = (name) => {
        return this.parsed[name];
    };
    getAll = () => {
        return this.parsed;
    };
    set = (name, value, options) => {
        this.ctx.res.headers.append('Set-Cookie', this.serialize(name, value, options));
    };
    delete = (name, options) => {
        this.set(name, '', {
            ...options,
            expires: new Date(0),
        });
    };
    serialize = (name, value, options) => {
        return serializeCookie(name, value, options);
    };
}
