import { Static, TSchema } from '@sinclair/typebox';
import { Runtime } from './types.js';
import { compileSchema, validateSchema } from './validation.js';
import { ValidationError } from './errors.js';

export const RUNTIME: Runtime = detectRuntime();

export let env: NodeJS.ProcessEnv = process.env;

export function detectRuntime(): Runtime {
  // @ts-expect-error
  if (globalThis.Netlify) {
    return 'netlify';
  }
  // @ts-expect-error
  if (globalThis.EdgeRuntime) {
    return 'edge-light';
  }
  // @ts-expect-error
  if (globalThis.Deno) {
    return 'deno';
  }
  // @ts-expect-error
  if (globalThis.fastly) {
    return 'fastly';
  }
  // @ts-expect-error
  if (globalThis.__lagon__) {
    return 'lagon';
  }
  // @ts-expect-error
  if (globalThis.Bun) {
    return 'bun';
  }
  if (process.release.name === 'node') {
    return 'node';
  }
  return 'unknown';
}

export function assertEnv<T extends TSchema>(schema: T): Static<T> {
  try {
    env = validateSchema(compileSchema(schema), { ...process.env }) as NodeJS.ProcessEnv;
  } catch (err: any) {
    throw new ValidationError('Env: ' + err, err.details);
  }
  return env;
}
