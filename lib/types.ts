import type { Readable } from 'node:stream';
import type { TSchema, Static } from '@sinclair/typebox';
import type { Context } from './context.js';
import type { Exot } from './exot.js';
import type { ExotWebSocket } from './websocket.js';
import type { Router } from './router.js';
import type { Config, HTTPMethod, HTTPVersion } from 'find-my-way';
import type { ExotRequest } from './request.js';
import type { PubSub } from './pubsub.js';

const EVENTS = ['error', 'publish', 'request', 'response', 'route', 'start'] as const;

export type { HTTPMethod } from 'find-my-way';

export type Runtime =
  | 'bun'
  | 'deno'
  | 'edge-light'
  | 'fastly'
  | 'lagon'
  | 'netlify'
  | 'node'
  | 'unknown'
  | 'workerd';


export type ExotEvent = (typeof EVENTS)[number];

export type EventHandler<T = undefined> = (arg: T) => Promise<void> | void;

type PickUndefined<T> = {
  [P in keyof T as undefined extends T[P] ? P : never]: T[P];
};

type PickDefined<T> = {
  [P in keyof T as undefined extends T[P] ? never : P]: T[P];
};

type OptionalDefined<T> = {
  [K in keyof PickUndefined<T>]?: Exclude<T[K], null>;
} & {
  [K in keyof PickDefined<T>]: T[K];
};

export interface ExotInit<UseStackHandlerOptions extends AnyRecord = {}> {
  handlerOptions?: UseStackHandlerOptions;
  name?: string;
  prefix?: string;
  router?: RouterInit;
  tracing?: boolean;
  onComposed?: (parent?: Exot<any, any, any>) => void;
}

export type AnyRecord = Record<string, any>;

export type AnyExot<T extends ContextInterface = ContextInterface> = Exot<any, any, any, T>;

export type AnyStackHandlerOptions = StackHandlerOptions<any, any, any, any, any>;

export interface ContextInit<
  Params = AnyRecord,
  Store = unknown,
> {
  req: Request & ExotRequest;
  params?: Params;
  pubsub?: PubSub;
  store?: Store;
  tracingEnabled?: boolean;
}

export interface ContextInterface<
  Params = AnyRecord,
  Body = unknown,
  Query = AnyRecord,
  ResponseBody = unknown,
  Store = unknown,
> extends Context<
  Params,
  Body,
  Query,
  ResponseBody,
  Store
> {
  json<T = Body>(value: T, validate?: boolean): void;
  json<T = ResponseBody>(): Promise<T>;
  stream<T = ReadableStream | Readable>(value: T): void;
  stream<T = ReadableStream | Readable>(): T;
  text<T = Body>(value: T): void;
  text<T = ResponseBody>(): Promise<T>;
}

export type StackHandler<T extends ContextInterface> =
  | ((ctx: T) => unknown)
  | AnyExot<T>
  | Router;

export interface StackHandlerOptions<
  Params extends TSchema,
  Body extends TSchema,
  Query extends TSchema,
  Response extends TSchema,
  Store extends AnyRecord
> {
  transform?: (
    ctx: Context<any, Body, Query, Response, Store>
  ) => MaybePromise<void>;
  body?: Body;
  params?: Params;
  query?: Query;
  response?: Response;
  store?: OptionalDefined<Store>;
};

export type ErrorHandler<LocalContext extends ContextInterface> = (err: any, ctx: LocalContext) => Promise<void> | void;

export type TraceHandler<LocalContext extends ContextInterface> = (ctx: LocalContext) => Promise<void> | void;

export type MaybePromise<T = unknown> = Promise<T> | T;

export type ChainFnOld<Input = any, Result = unknown> = (input: Input) => MaybePromise<Result>;

export type ChainFn<Input = unknown> = (input: Input) => MaybePromise<unknown>;

export type MergeParams<Path extends string, Params extends TSchema> = Omit<
  RouteParams<Path>,
  keyof Static<Params>
> &
  Static<Params>;

export type WsHandler<WsSocket> = {
  close?: (ws: WsSocket) => Promise<void> | void;
  message?: (ws: WsSocket, message: ArrayBuffer) => Promise<void> | void;
  open?: (ws: WsSocket) => Promise<void> | void;
  upgrade?: (req: Request, res: Response) => Promise<void> | void;
};

export interface WebSocketHandler<Ctx extends ContextInterface = ContextInterface> {
  beforeUpgrade?: (ctx: Ctx) => MaybePromise<void>;
  close?: (ws: ExotWebSocket<any, any>, ctx: Ctx) => MaybePromise<void>;
  drain?: (ws: ExotWebSocket<any, any>, ctx: Ctx) => MaybePromise<void>;
  error?: (ws: ExotWebSocket<any, any>, err: any, ctx: Ctx) => MaybePromise<void>;
  message?: (ws: ExotWebSocket<any, any>, message: ArrayBuffer | Uint8Array | string, ctx: Ctx) => MaybePromise<void>;
  open?: (ws: ExotWebSocket<any, any>, ctx: Ctx) => MaybePromise<void>;
};

// https://lihautan.com/extract-parameters-type-from-string-literal-types-with-typescript/
type IsOptionalParameter<Part> = Part extends `:${infer ParamName}?` ? ParamName : never;
type IsParameter<Part> = Part extends `:${string}?` ? never : Part extends `:${infer ParamName}` ? ParamName : never;
type FilteredParts<Path> = Path extends `${infer PartA}/${infer PartB}`
  ? IsParameter<PartA> | FilteredParts<PartB>
  : IsParameter<Path>;
type FilteredOptionalParts<Path> = Path extends `${infer PartA}/${infer PartB}`
  ? IsOptionalParameter<PartA> | FilteredOptionalParts<PartB>
  : IsOptionalParameter<Path>;
export type RouteParams<Path> = {
  [Key in FilteredParts<Path> as Key]: string;
} & {
  [Key in FilteredOptionalParts<Path> as Key]: string | undefined;
};

export type ContentType =
  | 'application/json'
  | 'application/x-www-form-urlencoded'
  | 'multipart/form-data'
  | 'text/plain'
  | string;

export interface Route {
  method: HTTPMethod;
  path: string;
}

export interface RouterInit {
  config?: Config<HTTPVersion.V1>;
  disableStaticMapping?: boolean;
}

export type RouterFindResult = {
  params: Record<string, string | undefined>;
  route: string;
  stack: ChainFn<ContextInterface>[];
} | null;

export interface Trace {
  desc?: string;
  error?: any;
  name: string;
  parent?: Trace;
  start: number;
  time: number;
  traces: Trace[];
}

export interface Adapter {
  close(): Promise<void>;

  fetch(req: Request, ...args: unknown[]): MaybePromise<Response>;

  listen(port: number): Promise<number>;

  mount(exot: Exot<any, any, any>): void;

  upgradeRequest(ctx: ContextInterface, handler: WebSocketHandler): MaybePromise<any>;
}

export type PubSubHandler = (topic: string, data: ArrayBuffer | string | null) => void;

export interface HandleOptions {
  emitEvents?: boolean;
  useErrorHandler?: boolean;
}