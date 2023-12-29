import { beforeEach, describe, expect, it, vi } from 'vitest'
import { awaitMaybePromise, chain, chainAll} from '../lib/helpers.js';

describe('Helpers', () => {
  describe('awaitMaybePromise', () => {
    it('should await sync function', () => {
      const fn = vi.fn(() => 1);
      const onResult = vi.fn();
      const onError = vi.fn();
      awaitMaybePromise(
        fn,
        onResult,
        onError,
      );
      expect(fn).toHaveBeenCalled();
      expect(onResult).toHaveBeenCalled();
      expect(onResult).toHaveBeenCalledWith(1);
      expect(onError).not.toHaveBeenCalled();
    });

    it('should await async function', async () => {
      const fn = vi.fn(() => new Promise((resolve) => setTimeout(() => resolve(1), 100)));
      const onResult = vi.fn();
      const onError = vi.fn();
      await awaitMaybePromise(
        fn,
        onResult,
        onError,
      );
      expect(fn).toHaveBeenCalled();
      expect(onResult).toHaveBeenCalled();
      expect(onResult).toHaveBeenCalledWith(1);
      expect(onError).not.toHaveBeenCalled();
    });

    it('should catch sync error', () => {
      const err = new Error('test');
      const fn = vi.fn(() => {
        throw err;
      });
      const onResult = vi.fn();
      const onError = vi.fn();
      awaitMaybePromise(
        fn,
        onResult,
        onError,
      );
      expect(fn).toHaveBeenCalled();
      expect(onResult).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(err);
    });

    it('should catch async error', async () => {
      const err = new Error('test');
      const fn = vi.fn(() => new Promise((_, reject) => setTimeout(() => reject(err), 100)));
      const onResult = vi.fn();
      const onError = vi.fn();
      await awaitMaybePromise(
        fn,
        onResult,
        onError,
      );
      expect(fn).toHaveBeenCalled();
      expect(onResult).not.toHaveBeenCalled();
      expect(onError).toHaveBeenCalled();
      expect(onError).toHaveBeenCalledWith(err);
    });
  });

  describe('chain()', () => {
    it('should chain sync functions', () => {
      const input = 'abc';
      const fn1 = vi.fn(() => {});
      const fn2 = vi.fn(() => {});
      const fn3 = vi.fn(() => {});
      const result = chain([fn1, fn2, fn3], input);
      expect(fn1).toHaveBeenCalled();
      expect(fn2).toHaveBeenCalled();
      expect(fn3).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
    
    it('should chain async functions', async () => {
      const input = 'abc';
      const fn1 = vi.fn(async () => {});
      const fn2 = vi.fn(async () => {});
      const fn3 = vi.fn(async () => {});
      const result = await chain([fn1, fn2, fn3], input);
      expect(fn1).toHaveBeenCalled();
      expect(fn2).toHaveBeenCalled();
      expect(fn3).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should await async function before continuing and pass previous result', async () => {
      const input = 'abc';
      const fn1 = vi.fn(async () => {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve(void 0);
          }, 100);
        });
      });
      const fn2 = vi.fn((prev) => {});
      const result = await chain([fn1, fn2], input);
      expect(fn1).toHaveBeenCalled();
      expect(fn2).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });

    it('should terminate on the first return', () => {
      const input = 'abc';
      const fn1 = vi.fn(() => {});
      const fn2 = vi.fn(() => 1);
      const fn3 = vi.fn(() => {});
      const result = chain([fn1, fn2, fn3], input);
      expect(fn1).toHaveBeenCalled();
      expect(fn2).toHaveBeenCalled();
      expect(fn3).not.toHaveBeenCalled();
      expect(result).toEqual(1);
    });

    it('should chain all functions if terminateOnReturn = false', () => {
      const input = 'abc';
      const fn1 = vi.fn(() => {});
      const fn2 = vi.fn(() => 1);
      const fn3 = vi.fn(() => {});
      const result = chain([fn1, fn2, fn3], input, 0, false);
      expect(fn1).toHaveBeenCalled();
      expect(fn2).toHaveBeenCalled();
      expect(fn3).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });

  describe('chainAll()', () => {
    it('should chain functions with return ', () => {
      const input = 'abc';
      const fn1 = vi.fn(() => {});
      const fn2 = vi.fn(() => 1);
      const fn3 = vi.fn(() => 2);
      const result = chainAll([fn1, fn2, fn3], input);
      expect(fn1).toHaveBeenCalled();
      expect(fn2).toHaveBeenCalled();
      expect(fn3).toHaveBeenCalled();
      expect(result).toBeUndefined();
    });
  });
});