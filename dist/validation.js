import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { ValidationError } from './errors.js';
let ajv = new Ajv({
    coerceTypes: 'array',
    useDefaults: true,
    removeAdditional: 'all',
});
addFormats(ajv);
export function setAjv(useAjv) {
    if ('compile' in useAjv) {
        ajv = useAjv;
    }
    else {
        ajv = new Ajv(useAjv);
    }
}
export function compileSchema(schema) {
    return ajv.compile(schema);
}
export function validateSchema(check, data, location) {
    if (!check(data)) {
        throw new ValidationError('Validation error', check.errors || [], location);
    }
    return data;
}
