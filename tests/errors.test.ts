import { describe, expect, it } from 'vitest'
import { BaseError, ForbiddenError, NotFoundError, ValidationError } from '../lib/errors';

describe('Errors', () => {
  describe('BaseError', () => {
    it('should have statusCode property', () => {
      expect(new BaseError().statusCode).toEqual(500);
    });

    it('should implement toJSON', () => {
      expect(new BaseError('test').toJSON()).toEqual({
        error: 'test',
        statusCode: 500,
      });
    });
  });

  describe('ForbiddenError', () => {
    it('should have statusCode = 403', () => {
      expect(new ForbiddenError().statusCode).toEqual(403);
    });

    it('should have message = Forbidden', () => {
      expect(new ForbiddenError().message).toEqual('Forbidden');
    });
  });

  describe('NotFoundError', () => {
    it('should have statusCode = 404', () => {
      expect(new NotFoundError().statusCode).toEqual(404);
    });

    it('should have message = Not found', () => {
      expect(new NotFoundError().message).toEqual('Not found');
    });
  });

  describe('ValidationError', () => {
    it('should have statusCode = 400', () => {
      expect(new ValidationError().statusCode).toEqual(400);
    });

    it('should have message = ValidationError', () => {
      expect(new ValidationError().message).toEqual('Validation error');
    });

    it('should have detail property', () => {
      expect(new ValidationError().details).toEqual([]);
    });

    it('should have location property', () => {
      expect(new ValidationError('', [], 'test').location).toEqual('test');
    });
  });
});