import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Router, isStaticPath, normalizePath } from '../lib/router.js';

describe('Router', () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
  });

  describe('static isStaticPath()', () => {
    it('should return true if the path does not contain named params', () => {
      expect(isStaticPath('/')).toBeTruthy();
      expect(isStaticPath('/test')).toBeTruthy();
      expect(isStaticPath('/test/test')).toBeTruthy();
    });

    it('should return false if the path contains named params', () => {
      expect(isStaticPath('/:param')).toBeFalsy();
      expect(isStaticPath('/test/:param')).toBeFalsy();
      expect(isStaticPath('/test/:param/test')).toBeFalsy();
    });

    it('should return false if the path contains wildcards', () => {
      expect(isStaticPath('/*')).toBeFalsy();
      expect(isStaticPath('/test/*')).toBeFalsy();
      expect(isStaticPath('/test/*/test')).toBeFalsy();
    });

    it('should return false if the path contains regexp', () => {
      expect(isStaticPath('/file/(^\\d+).png')).toBeFalsy();
    });
  });

  describe('static normalizePath()', () => {
    it('should add missing slash', () => {
      expect(normalizePath('')).toEqual('/');
      expect(normalizePath('test')).toEqual('/test');
    });
    it('should remove trailing slash', () => {
      expect(normalizePath('/')).toEqual('/');
      expect(normalizePath('//')).toEqual('/');
      expect(normalizePath('////')).toEqual('///');
      expect(normalizePath('/test/')).toEqual('/test');
    });
  });

  describe('.add()', () => {
    it('should add a route', () => {
      const route = '/test';
      const stack = [];
      router.add('GET', route, stack);
      expect(router.find('GET', '/test')).toEqual({
        params: {},
        route,
        stack,
      });
    });
  });

  describe('.find()', () => {
    it('should find a route and return one param', () => {
      const route = '/hello/:name';
      const stack = [];
      router.add('GET', route, stack);
      expect(router.find('GET', '/hello/john')).toEqual({
        params: {
          name: 'john'
        },
        route,
        stack,
      });
    });

    it('should find a route and return multiple params', () => {
      const route = '/:param1/:param2/test/:param3';
      const stack = [];
      router.add('GET', route, stack);
      expect(router.find('GET', '/abc/def/test/ghi')).toEqual({
        params: {
          param1: 'abc',
          param2: 'def',
          param3: 'ghi',
        },
        route,
        stack,
      });
    });

    it('should find a route with a wildcard', () => {
      const route = '/*';
      const stack = [];
      router.add('GET', route, stack);
      expect(router.find('GET', '/test/test')).toEqual({
        params: {
          '*': 'test/test'
        },
        route,
        stack,
      });
    });

    it('should find a route with a regexp', () => {
      const route = '/time/:hour(^\\d{2})h:minute(^\\d{2})m';
      const stack = [];
      router.add('GET', route, stack);
      expect(router.find('GET', '/time/13h35m')).toEqual({
        params: {
          hour: '13',
          minute: '35',
        },
        route,
        stack,
      });
    });
  });
});