import { Readable } from "node:stream";
import { HttpRequest, HttpResponse } from "uWebSockets.js";

const encoder = new TextEncoder();

interface IMockResponseInit {
  body?: Buffer;
  remoteAddress?: string;
}

export function createStream(data: any = '') {
  return new Readable({
    read() {
      this.push(data);
      this.push(null);
    }
  });
}

export async function streamToBuffer(stream: Readable | ReadableStream) {
  let buf = Buffer.from('');
  // @ts-expect-error
  for await (let chunk of stream) {
    buf = Buffer.concat([buf, chunk]);
  }
  return buf;
}

export async function serializeFormData(form: FormData) {
  const source = new Request('http://localhost/', {
    body: form,
    method: 'POST',
  });
  const body = await source.arrayBuffer();
  const contentType = source.headers.get('content-type')!;
  return {
    body,
    contentType,
  };
}