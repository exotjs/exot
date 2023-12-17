import type { ErrorObject } from 'ajv';
export declare class BaseError extends Error {
    message: string;
    statusCode: number;
    constructor(message?: string);
    toJSON(): {
        error: string;
        statusCode: number;
    };
}
export declare class ForbiddenError extends BaseError {
    message: string;
    constructor(message?: string);
}
export declare class NotFoundError extends BaseError {
    message: string;
    constructor(message?: string);
}
export declare class ValidationError extends BaseError {
    message: string;
    details: ErrorObject[];
    location?: string | undefined;
    constructor(message?: string, details?: ErrorObject[], location?: string | undefined);
    toString(): string;
    toJSON(): {
        error: string;
        details: ErrorObject<string, Record<string, any>, unknown>[];
        location: string | undefined;
        statusCode: number;
    };
}
