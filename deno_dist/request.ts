export interface ExotRequest {
  parsedUrl?(): { path: string, querystring: string };
  remoteAddress?(): string;
}

export abstract class ExotRequest implements Request {
  abstract method: string;

  abstract arrayBuffer(): Promise<ArrayBuffer>;

  abstract blob(): Promise<Blob>;

  abstract clone(): Request;

  abstract formData(): Promise<FormData>;

  abstract json(): Promise<any>;

  abstract text(): Promise<string>;

  abstract get body(): ReadableStream<Uint8Array> | null;

  abstract get headers(): Headers;

  abstract get url(): string;

  get bodyUsed() {
    return false;
  }

  get cache(): RequestCache {
    return 'default';
  }

  get credentials(): RequestCredentials {
    return 'omit';
  }

  get destination(): RequestDestination {
    return 'document';
  }

  get integrity() {
    return '';
  }

  get mode(): RequestMode {
    return 'same-origin';
  }

  get keepalive() {
    return false;
  }

  get redirect(): RequestRedirect {
    return 'manual';
  }

  get referrer() {
    return '';
  }

  get referrerPolicy(): ReferrerPolicy {
    return 'origin';
  }

  get signal() {
    return new AbortSignal();
  }
}
