import { Readable } from 'node:stream';
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '../lib/context';
import { Cookies } from '../lib/cookies';
import { createStream, serializeFormData, streamToBuffer } from './helpers';
import { parseFormData } from '../lib/helpers';

describe('Context', () => {
  let body: string;
  let headers: Headers;
  let ctx: Context;

  beforeEach(() => {
    body = JSON.stringify({
      hello: 'world',
    });
    headers = new Headers({
      'Content-Type': 'application/json; charset=utf-8',
      'Host': 'example.com:8080',
      'X-Forwarded-For': '127.0.0.1',
      'X-Header': 'test',
    });
    ctx = new Context({
      req: new Request('http://localhost/hello/world?search=test', {
        body,
        headers,
        method: 'POST',
      }),
      params: {
        name: 'world',
      },
    });
  });

  describe('.cookies', () => {
    it('should get request cookies', () => {
      expect(ctx.cookies).toBeInstanceOf(Cookies);
    });

    it('setting cookies should throw', () => {
      expect(() => {
        // @ts-expect-error
        ctx.cookies = null;
      }).toThrow();
    });
  });

  describe('.contentType', () => {
    it('should get request contentType', () => {
      expect(ctx.contentType).toEqual('application/json; charset=utf-8');
    });

    it('setting contentType should throw', () => {
      expect(() => {
        // @ts-expect-error
        ctx.contentType = '';
      }).toThrow();
    });
  });

  describe('.getHeader()', () => {
    it('should return a header by its name', () => {
      expect(ctx.headers.get('X-Header')).toEqual('test');
    });

    it('should be case-insensitive', () => {
      expect(ctx.headers.get('X-HEADER')).toEqual('test');
    });

    it('should return null if the header does not exist', () => {
      expect(ctx.headers.get('x-does-not-exist')).toEqual(null);
    });
  });

  describe('.headers', () => {
    it('should get request headers', () => {
      expect(ctx.headers).toEqual(headers);
    });

    it('setting headers should throw', () => {
      expect(() => {
        // @ts-expect-error
        ctx.headers = [];
      }).toThrow();
    });
  });

  describe('.host', () => {
    it('should get request host', () => {
      expect(ctx.host).toEqual('example.com:8080');
    });

    it('setting host should throw', () => {
      expect(() => {
        // @ts-expect-error
        ctx.host = '';
      }).toThrow();
    });
  });

  describe('.method', () => {
    it('should get request method', () => {
      expect(ctx.method).toEqual('POST');
    });

    it('setting method should throw', () => {
      expect(() => {
        // @ts-expect-error
        ctx.method = 'GET';
      }).toThrow();
    });
  });

  describe('.path', () => {
    it('should get request path', () => {
      expect(ctx.path).toEqual('/hello/world');
    });

    it('setting path should throw', () => {
      expect(() => {
        // @ts-expect-error
        ctx.path = '/';
      }).toThrow();
    });
  });

  describe('.querystring', () => {
    it('should get request querystring', () => {
      expect(ctx.querystring).toEqual('?search=test');
    });

    it('setting querystring should throw', () => {
      expect(() => {
        // @ts-expect-error
        ctx.querystring = '?';
      }).toThrow();
    });
  });

  describe('.query', () => {
    it('should get parsed request query', () => {
      expect(ctx.query).toEqual({ search: 'test' });
    });

    it('setting query should throw', () => {
      expect(() => {
        // @ts-expect-error
        ctx.query = new URLSearchParams('');
      }).toThrow();
    });
  });

  describe('.remoteAddress', () => {
    it('should get request remoteAddress from X-Forwarded-For', () => {
      expect(ctx.remoteAddress).toEqual('127.0.0.1');
    });

    it('setting remoteAddress should throw', () => {
      expect(() => {
        // @ts-expect-error
        ctx.remoteAddress = '';
      }).toThrow();
    });
  });

  describe('.buffer()', () => {
    it('should return an ArrayBuffer', async () => {
      const buf = await ctx.arrayBuffer();
      expect(buf).toBeInstanceOf(ArrayBuffer);
      expect(new TextDecoder().decode(buf)).toEqual(body);
    });
  });

  describe('.formData()', () => {
    it('should return parsed form data', async () => {
      const form = new FormData();
      form.set('field1', 'test 1');
      form.set('field2', 'test 2');
      const { body, contentType } = await serializeFormData(form)
      ctx.req.formData = () => Promise.resolve(parseFormData(contentType, body));
      ctx.req.headers.set('content-type', contentType);
      const data = await ctx.formData();
      expect(data).toBeInstanceOf(FormData);
      expect(data.get('field1')).toEqual('test 1');
      expect(data.get('field2')).toEqual('test 2');
    });
  });

  describe('.json()', () => {
    it('should return parsed JSON', async () => {
      const json = await ctx.json();
      expect(json).toEqual({
        hello: 'world',
      });
    });
  });

  describe('.stream()', () => {
    it('should return a Readable stream', async () => {
      const stream = ctx.stream();
      expect(stream).toBeDefined()
      expect((await streamToBuffer(stream!)).toString()).toEqual(body);
    });
  });

  describe('.text()', () => {
    it('should return a string', async () => {
      const text = await ctx.text();
      expect(text).toEqual(body);
    });
  });

  describe('.trace()', () => {
    describe('Tracing disabled', () => {
      it('should not add entry to .traces', async () => {
        expect(ctx.traces.length).toEqual(0);
        await ctx.trace(() => {}, 'test', 'description');
        expect(ctx.traces.length).toEqual(0);
      });
    });

    describe('Tracing enabled', () => {
      it('should add entry to .traces', async () => {
        ctx.tracingEnabled = true;
        expect(ctx.traces.length).toEqual(0);
        await ctx.trace(async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }, 'test', 'description');
        expect(ctx.traces.length).toEqual(1);
        expect(ctx.traces[0].name).toEqual('test');
        expect(ctx.traces[0].desc).toEqual('description');
        expect(ctx.traces[0].start).toBeGreaterThan(0);
        expect(ctx.traces[0].time).toBeGreaterThan(0);
      });

      it('should add error to .traces', async () => {
        const err = new Error('test error');
        ctx.tracingEnabled = true;
        expect(ctx.traces.length).toEqual(0);
        expect(async () => {
          await ctx.trace(() => {
            throw err;
          }, 'test', 'description');
        }).rejects.toThrow();
        expect(ctx.traces.length).toEqual(1);
        expect(ctx.traces[0].name).toEqual('test');
        expect(ctx.traces[0].desc).toEqual('description');
        expect(ctx.traces[0].error).toEqual(err);
        expect(ctx.traces[0].start).toBeGreaterThan(0);
        expect(ctx.traces[0].time).toBeGreaterThan(0);
      });
    });
  });

  /*
  describe('.destroy()', () => {
    it('should destroy the context and call destroy() on ctx.req and ctx.req', async () => {
      const destroyReqFn = vi.fn();
      const ctx = new Context(
        {
          body: null,
          headers: new Headers(),
          method: 'GET',
          url: '/',
          destroy: destroyReqFn,
          arrayBuffer: () => Promise.resolve(Buffer.from(body)),
          formData: () => Promise.resolve(new FormData()),
          json: () => Promise.resolve(JSON.stringify(body)),
          text: () => Promise.resolve(body),
        },
        {},
      );
      const destroyResFn = vi.spyOn(ctx.set, 'destroy');
      await ctx.arrayBuffer();
      expect(await ctx.text()).toEqual(body);
      ctx.destroy();
      expect(destroyReqFn).toHaveBeenCalled();
      expect(destroyResFn).toHaveBeenCalled();
    });
  });
  */

  describe('.set.', () => {
    describe('.headers', () => {
      it('should set response headers', () => {
        ctx.set.headers.set('x-test', 'test')
        expect(Object.fromEntries(ctx.set.headers)).toEqual({
          'x-test': 'test',
        });
      });
    });

    describe('.statusCode', () => {
      it('should set response status code', () => {
        expect(ctx.set.status).toEqual(0);
        ctx.set.status = 301;
        expect(ctx.set.status).toEqual(301);
      });
    });

    describe('.json()', () => {
      it('should set response body and content-type to application/json', async () => {
        const body = {
          hello: 'world',
        };
        ctx.json(body);
        expect(await ctx.set.body).toEqual(JSON.stringify(body));
        expect(ctx.set.headers.get('Content-Type')).toEqual('application/json');
      });
    });

    describe('.text()', () => {
      it('should set response body and content-type to text/plain', async () => {
        ctx.text('test');
        expect(await ctx.set.body).toEqual('test');
        expect(ctx.set.headers.get('Content-Type')).toEqual('text/plain');
      });
    });

    /*
    describe('.destroy()', () => {
      it('should destroy response object', () => {
        ctx.set.status = 200;
        ctx.set.body = 'test';
        ctx.set.destroy();
        expect(ctx.res.statusCode).toEqual(0);
        expect(ctx.res.body).toBeUndefined();
      });    
    });
    */
  });
});
