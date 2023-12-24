import { compileSchema, validateSchema } from './validation.js';
import { ValidationError } from './errors.js';
export const RUNTIME = detectRuntime();
export let env = process.env;
export function detectRuntime() {
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
export function assertEnv(schema) {
    try {
        env = validateSchema(compileSchema(schema), { ...process.env });
    }
    catch (err) {
        throw new ValidationError('Env: ' + err, err.details);
    }
    return env;
}
