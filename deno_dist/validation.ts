import Ajv, { Options, ValidateFunction } from 'npm:ajv@8.12.0';
import addFormats from 'npm:ajv-formats@2.1.1';
import { ValidationError } from './errors.ts';
import type { TSchema, Static } from 'npm:@sinclair/typebox@0.31.23';
export type { ValidateFunction } from 'npm:ajv@8.12.0';

let ajv = new Ajv({
  coerceTypes: 'array',
  useDefaults: true,
  removeAdditional: 'all',
});

addFormats(ajv);

export function setAjv(useAjv: Ajv | Options) {
  if ('compile' in useAjv) {
    ajv = useAjv as Ajv;
  } else {
    ajv = new Ajv(useAjv as Options);
  }
}

export function compileSchema<Schema extends TSchema>(
  schema: Schema,
): ValidateFunction<Schema> {
  return ajv.compile(schema);
}

export function validateSchema<Schema extends TSchema>(
  check: ValidateFunction<Schema>,
  data: unknown,
  location?: string
): Static<Schema> {
  if (!check(data)) {
    throw new ValidationError('Validation error', check.errors || [], location);
  }
  return data;
}
