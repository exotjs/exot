export interface HttpRequest {
    parsedUrl?(): {
        path: string;
        querystring: string;
    };
    remoteAddress?(): string;
}
export declare abstract class HttpRequest implements Request {
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
    get bodyUsed(): boolean;
    get cache(): RequestCache;
    get credentials(): RequestCredentials;
    get destination(): RequestDestination;
    get integrity(): string;
    get mode(): RequestMode;
    get keepalive(): boolean;
    get redirect(): RequestRedirect;
    get referrer(): string;
    get referrerPolicy(): ReferrerPolicy;
    get signal(): AbortSignal;
}
