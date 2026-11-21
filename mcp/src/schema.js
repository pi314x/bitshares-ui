"use strict";
// The small part of JSON Schema the tools' inputs use, checked before a handler runs:
// type, enum, string length and pattern, number range, items, properties, required and
// `additionalProperties: false`. Anything the schema does not allow is refused; nothing is
// coerced (a number is not a string, "5" is not 5).

function typeOf(value) {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
}

function check(value, schema, path, errors) {
    const type = typeOf(value);
    if (schema.type) {
        const ok =
            schema.type === "integer"
                ? type === "number" && Number.isInteger(value)
                : schema.type === "number"
                ? type === "number" && Number.isFinite(value)
                : type === schema.type;
        if (!ok) {
            errors.push(`${path}: expected ${schema.type}, got ${type}`);
            return;
        }
    }
    if (schema.enum && schema.enum.indexOf(value) === -1) {
        errors.push(`${path}: must be one of ${schema.enum.join(", ")}`);
    }
    if (type === "string") {
        if (schema.minLength !== undefined && value.length < schema.minLength) {
            errors.push(`${path}: shorter than ${schema.minLength}`);
        }
        if (schema.maxLength !== undefined && value.length > schema.maxLength) {
            errors.push(`${path}: longer than ${schema.maxLength}`);
        }
        if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
            errors.push(`${path}: does not match ${schema.pattern}`);
        }
    }
    if (type === "number") {
        if (schema.minimum !== undefined && value < schema.minimum) {
            errors.push(`${path}: below ${schema.minimum}`);
        }
        if (schema.maximum !== undefined && value > schema.maximum) {
            errors.push(`${path}: above ${schema.maximum}`);
        }
    }
    if (type === "array") {
        if (schema.maxItems !== undefined && value.length > schema.maxItems) {
            errors.push(`${path}: more than ${schema.maxItems} items`);
        }
        if (schema.items) {
            value.forEach((item, i) =>
                check(item, schema.items, `${path}[${i}]`, errors)
            );
        }
    }
    if (type === "object") {
        const properties = schema.properties || {};
        (schema.required || []).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(value, key)) {
                errors.push(`${path}.${key}: required`);
            }
        });
        Object.keys(value).forEach(key => {
            if (Object.prototype.hasOwnProperty.call(properties, key)) {
                check(value[key], properties[key], `${path}.${key}`, errors);
            } else if (schema.additionalProperties === false) {
                errors.push(`${path}.${key}: not an argument of this tool`);
            }
        });
    }
}

/** {ok: true} or {ok: false, errors: [...]} for the arguments of a tool call. */
function validate(args, schema) {
    const errors = [];
    check(args === undefined ? {} : args, schema, "arguments", errors);
    return errors.length ? {ok: false, errors} : {ok: true};
}

module.exports = {validate};
