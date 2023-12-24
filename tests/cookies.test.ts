import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it } from 'vitest'
import { Cookies } from '../lib/cookies.js';
import { Context } from '../lib/context.js';

describe('Cookies', () => {
  let cookies: Cookies;
  let ctx: Context;

  beforeEach(() => {
    ctx = new Context({
      req: new Request('http://localhost/', {
        headers: {
          cookie: `cookie1=abc;cookie2=123;cookie3=value%20with%20special%20chars%20%40%23%24%3B;cookie4=1`,
        },
        method: 'POST',
      }),
    });
    cookies = new Cookies(ctx);
  });

  describe('.get()', () => {
    it('should return a cookie value', () => {
      expect(cookies.get('cookie1')).toEqual('abc');
      expect(cookies.get('cookie2')).toEqual('123');
      expect(cookies.get('cookie3')).toEqual('value with special chars @#$;');
      expect(cookies.get('cookie4')).toEqual('1');
    });
  });

  describe('.getAll()', () => {
    it('should return all cookies', () => {
      expect(cookies.getAll()).toEqual({
        cookie1: 'abc',
        cookie2: '123',
        cookie3: 'value with special chars @#$;',
        cookie4: '1',
      });
    });
  });

  describe('.set()', () => {
    it('should set set-cookie header', () => {
      cookies.set('testcookie1', 'testvalue1', {
        secure: true,
        sameSite: true,
      });
      cookies.set('testcookie2', 'testvalue2', {
        path: '/test'
      });
      expect(ctx.res.headers.getSetCookie()).toEqual([
        'testcookie1=testvalue1; Secure; SameSite=Strict',
        'testcookie2=testvalue2; Path=/test',
      ]);
    });
  });

  describe('.delete()', () => {
    it('should set set-cookie header with expired cookie', () => {
      cookies.delete('testcookie2', {
        path: '/test'
      });
      expect(ctx.res.headers.getSetCookie()).toEqual(['testcookie2=; Path=/test; Expires=Thu, 01 Jan 1970 00:00:00 GMT']);
    });
  });

  describe('.serialize()', () => {
    it('should serialize a cookie', () => {
      expect(cookies.serialize('name', 'value with special chars @#$;', {
        expires: new Date(0),
        sameSite: true,
        secure: true,
      })).toEqual('name=value%20with%20special%20chars%20%40%23%24%3B; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Secure; SameSite=Strict');
    });
  });
});