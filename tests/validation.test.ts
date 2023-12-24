import { beforeEach, describe, expect, it } from 'vitest';
import { TSchema, t } from '../lib.js';
import {
  ValidateFunction,
  compileSchema,
  validateSchema,
} from '../lib/validation.js';
import { ValidationError } from '../lib/errors.js';

describe('Validation', () => {
  let schema: TSchema;

  beforeEach(() => {
    schema = t.Object({
      arr: t.Optional(t.Array(t.String())),
      message: t.String({
        minLength: 1,
      }),
      number: t.Optional(t.Number()),
      nullable: t.Optional(t.Union([t.Null(), t.String()])),
      defaultValue: t.String({
        default: 'test',
      }),
    });
  });

  describe('compileSchema()', () => {
    it('should compile validation schema and return a function', () => {
      const result = compileSchema(schema);
      expect(result).toBeTypeOf('function');
    });
  });

  describe('validateSchema()', () => {
    let compiled: ValidateFunction<TSchema>;

    beforeEach(() => {
      compiled = compileSchema(schema);
    });

    it('should pass and return data', () => {
      const data = {
        message: 'hello',
      };
      const result = validateSchema(compiled, data);
      expect(result).toEqual(data);
    });

    it('should pass and set default value', () => {
      const data = {
        message: 'hello',
      };
      const result = validateSchema<any>(compiled, data);
      expect(result).toEqual(data);
      expect(result.defaultValue).toEqual('test');
    });

    it('should pass and remove additional properties', () => {
      const data = {
        message: 'hello',
        extra: 'test',
      };
      const result = validateSchema<any>(compiled, data);
      expect(result).toEqual(data);
      expect(result.extra).toBeUndefined();
      expect(data.extra).toBeUndefined();
    });

    it('should pass and coerce data', () => {
      const data = {
        arr: 'abc',
        message: 'hello',
        nullable: '',
        number: '123',
      };
      const result = validateSchema<any>(compiled, data);
      expect(result).toEqual(data);
      expect(result.arr).toEqual(['abc']);
      expect(result.number).toEqual(123);
      expect(result.nullable).toEqual(null);
      expect(data.arr).toEqual(['abc']);
      expect(data.number).toEqual(123);
      expect(data.nullable).toEqual(null);
    });

    it('should fail and throw', () => {
      const data = {
        message: '',
      };
      expect(() => validateSchema(compiled, data)).toThrow(ValidationError);
    });

    it('should fail and report deatils in the error object', () => {
      const data = {
        message: '',
      };
      try {
        validateSchema(compiled, data, 'test');
      } catch (err) {
        expect(err).toBeInstanceOf(ValidationError);
        expect(err.message).toEqual('Validation error');
        expect(err.statusCode).toEqual(400);
        expect(err.location).toEqual('test');
        expect(err.details).toEqual([
          {
            instancePath: '/message',
            keyword: 'minLength',
            message: 'must NOT have fewer than 1 characters',
            params: {
              limit: 1,
            },
            schemaPath: '#/properties/message/minLength',
          },
        ]);
      }
    });
  });
});
