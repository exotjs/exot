import type { ErrorObject } from 'npm:ajv@8.12.0';

export class BaseError extends Error {
  statusCode: number = 500;

  constructor(public message: string = 'Error') {
    super(message);
  }

  toJSON() {
    return {
      error: this.message,
      statusCode: this.statusCode,
    };
  }

}

export class ForbiddenError extends BaseError {
  constructor(public message: string = 'Forbidden') {
    super(message);
    this.statusCode = 403;
  }
}

export class NotFoundError extends BaseError {
  constructor(public message: string = 'Not found') {
    super(message);
    this.statusCode = 404;
  }
}

export class ValidationError extends BaseError {
  constructor(public message: string = 'Validation error', public details: ErrorObject[] = [], public location?: string) {
    super(message);
    this.statusCode = 400;
  }

  toString() {
    return `${this.message}\n${this.details.map((detail) => `  ${detail?.message || detail}`)}`;
  }

  toJSON() {
    return {
      error: this.message,
      details: this.details,
      location: this.location,
      statusCode: this.statusCode,
    };
  }
}