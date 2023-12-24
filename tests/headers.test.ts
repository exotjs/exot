import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpHeaders } from '../lib/headers.js';

describe('HttpHeaders', () => {
  describe('constructor', () => {
    it('should create a new instance with default headers', () => {
      const headers = new HttpHeaders({
        'x-header-1': 'abc',
        'x-header-2': 'xyz',
      });
      expect(Object.fromEntries(headers)).toEqual({
        'x-header-1': 'abc',
        'x-header-2': 'xyz',
      });
    });
  });

  describe('methods', () => {
    let headers: HttpHeaders;

    beforeEach(() => {
      headers = new HttpHeaders();
    });

    describe('.append()', () => {
      it('should add duplicate headers', () => {
        headers.append('x-header', '1');
        headers.append('x-header', '2');
        headers.append('x-header', '3');
        expect(headers.get('x-header')).toEqual('1, 2, 3');
      });
    });

    describe('.set()', () => {
      it('should set and override existing header', () => {
        headers.set('x-header', '1');
        headers.set('x-header', '2');
        expect(headers.get('x-header')).toEqual('2');
      });
    });

    describe('.get()', () => {
      it('should return existing header', () => {
        headers.set('x-header', 'test');
        expect(headers.get('x-header')).toEqual('test');
      });

      it('should return null if header does not exist', () => {
        expect(headers.get('x-does-not-exist')).toEqual(null);
      });
    });

    describe('.has()', () => {
      it('should return true is header exists', () => {
        headers.set('x-header', 'test');
        expect(headers.has('x-header')).toEqual(true);
      });

      it('should return false is header does not exists', () => {
        expect(headers.has('x-does-not-exist')).toEqual(false);
      });
    });

    describe('.delete()', () => {
      it('should delete header', () => {
        headers.set('x-header', 'test');
        expect(headers.get('x-header')).toEqual('test');
        headers.delete('x-header');
        expect(headers.get('x-header')).toEqual(null);
      });
    });

    describe('.forEach()', () => {
      it('should iterate over all headers', () => {
        headers.set('x-header-1', '1');
        headers.set('x-header-2', '2');
        headers.set('x-header-3', '3');
        const onEach = vi.fn();
        headers.forEach(onEach);
        expect(onEach).toHaveBeenCalledTimes(3);
        expect(onEach).toHaveBeenNthCalledWith(1, '1', 'x-header-1', headers);
        expect(onEach).toHaveBeenNthCalledWith(2, '2', 'x-header-2', headers);
        expect(onEach).toHaveBeenNthCalledWith(3, '3', 'x-header-3', headers);
      });
    });

    describe('.getSetCookie()', () => {
      it('should return all cookies as an array', () => {
        headers.set('set-cookie', 'c1=123');
        headers.append('set-cookie', 'c2=abc');
        expect(headers.getSetCookie()).toEqual(['c1=123', 'c2=abc']);
      });
    });

    describe('.toJSON()', () => {
      it('should return plain object', () => {
        headers.set('x-header-1', 'test');
        headers.append('x-header-2', '1');
        headers.append('x-header-2', '2');
        expect(headers.toJSON()).toEqual({
          'x-header-1': 'test',
          'x-header-2': ['1', '2'],
        });
      });
    });
  });
});