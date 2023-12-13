import Ajv, { Options, ValidateFunction } from 'ajv';
import type { TSchema, Static } from '@sinclair/typebox';
export type * from 'ajv';
export declare function setAjv(useAjv: Ajv | Options): void;
export declare function compileSchema<Schema extends TSchema>(schema: Schema): ValidateFunction<Schema>;
export declare function validateSchema<Schema extends TSchema>(check: ValidateFunction<Schema>, data: unknown, location?: string): Static<Schema>;
