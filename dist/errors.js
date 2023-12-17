export class BaseError extends Error {
    message;
    statusCode = 500;
    constructor(message = 'Error') {
        super(message);
        this.message = message;
    }
    toJSON() {
        return {
            error: this.message,
            statusCode: this.statusCode,
        };
    }
}
export class ForbiddenError extends BaseError {
    message;
    constructor(message = 'Forbidden') {
        super(message);
        this.message = message;
        this.statusCode = 403;
    }
}
export class NotFoundError extends BaseError {
    message;
    constructor(message = 'Not found') {
        super(message);
        this.message = message;
        this.statusCode = 404;
    }
}
export class ValidationError extends BaseError {
    message;
    details;
    location;
    constructor(message = 'Validation error', details = [], location) {
        super(message);
        this.message = message;
        this.details = details;
        this.location = location;
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
