import { Readable } from 'node:stream';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { Exot } from '../lib/exot';
import { Context } from '../lib/context';
import { ContextInterface } from '../lib/types';

describe('Exot', () => {
  describe('constructor', () => {
    it('should throw if the prefix is a dynamic route', () => {
      expect(() => new Exot({
        prefix: '/:name'
      })).toThrow();
    });

    it('should create a new instance with defaults', () => {
      const exot = new Exot();
      expect(exot.init.prefix).toBeUndefined();
      expect(exot.init.tracing).toBeUndefined();
    });
  });

  describe('methods', () => {
    let exot: Exot;

    afterEach(async () => {
      if (exot) {
        await exot.close();
      }
    });

    beforeEach(() => {
      exot = new Exot();
    });

    describe('.listen()', () => {
      it('should use default node adapter and start a server on a specified port', async () => {
        const port = await exot.listen(8123);
        expect(port).toEqual(8123);
      });

      it('should use default node adapter and start a server on a random port', async () => {
        const port = await exot.listen(0);
        expect(port).toBeGreaterThan(0);
      });
    });

    describe('.close()', () => {
      beforeEach(async () => {
        await exot.listen(0);
      });

      it('should close server', async () => {
        await exot.close();
      });
    });

    describe('.fetch()', () => {
      it('should return a fetch handler', () => {
        expect(exot.fetch).toBeTypeOf('function');
      });
    });


    describe('.decorate()', () => {
      it('should add decorators', () => {
        const fn = () => {};
        exot.decorate('test', 'test value');
        exot.decorate('fn', fn);
        expect(exot.decorators).toEqual({
          'test': 'test value',
          'fn': fn,
        });
      });
    });

    describe('.store()', () => {
      it('should add stores', () => {
        const fn = () => {};
        exot.store('test', 'test value');
        exot.store('fn', fn);
        expect(exot.stores).toEqual({
          'test': 'test value',
          'fn': fn,
        });
      });
    });

    describe('.use()', () => {
      it('should add a handler to the stack', async () => {
        const fn1 = vi.fn(() => {});
        const fn2 = vi.fn(() => {});
        exot.use(fn1);
        exot.use(fn2);
        await exot.handle(exot.context(new Request('http://localhost/')))
        expect(fn1).toHaveBeenCalledOnce();
        expect(fn2).toHaveBeenCalledOnce();
      });
    });

    describe('.handle()', () => {
      let ctx: ContextInterface<any, any, any, any, any>;

      beforeEach(() => {
        ctx = exot.context(new Request('http://localhost'));
      });

      it('should execute handlers', async () => {
        const fn1 = vi.fn(() => {});
        const fn2 = vi.fn(() => {});
        const notFound = vi.fn(() => {});
        exot.use(fn1);
        exot.use(fn2);
        exot.notFound(notFound);
        await exot.handle(ctx);
        expect(fn1).toHaveBeenCalledOnce();
        expect(fn2).toHaveBeenCalledOnce();
        expect(notFound).toHaveBeenCalledOnce();
      });
    });

    describe('.onError()', () => {
      it('should mount an error handler', async () => {
        const fn = vi.fn(() => {});
        exot.onError(fn);
        exot.use(() => {
          throw new Error('test');
        });
        expect(exot.errorHandler).toEqual(fn);
        await exot.handle(exot.context(new Request('http://localhost/')))
        expect(fn).toHaveBeenCalledOnce();
      });
    });

    describe('.notFound()', () => {
      it('should mount a notFound handler', async () => {
        const fn = vi.fn(() => {});
        exot.notFound(fn);
        await exot.handle(exot.context(new Request('http://localhost/')))
        expect(fn).toHaveBeenCalledOnce();
      });
    });

    describe('.add()', () => {
      it('should add a route', async () => {
        const fn = vi.fn(() => 'test');
        exot.add('GET', '/test', fn);
        const result = await exot.handle(exot.context(new Request('http://localhost/test')));
        expect(fn).toHaveBeenCalledOnce();
        expect(result).toEqual('test');
      });
    });

  });
});