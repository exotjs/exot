/// <reference types="node" />
import { Static, TSchema } from '@sinclair/typebox';
import { Runtime } from './types';
export declare const RUNTIME: Runtime;
export declare let env: NodeJS.ProcessEnv;
export declare function detectRuntime(): Runtime;
export declare function assertEnv<T extends TSchema>(schema: T): Static<T>;
