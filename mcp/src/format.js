"use strict";
// Amounts, names and text, for what the tools take and what they give back.
//
// Amounts are decimal strings in and out and BigInt in between: a floating point number
// never holds an amount of money here (only the price guard compares prices as numbers).

/** An error whose message is for the caller (the model, and through it the person). */
class UserError extends Error {
    constructor(message, code) {
        super(message);
        this.name = "UserError";
        this.code = code || "invalid";
    }
}

const DECIMAL = /^(0|[1-9]\d*)(\.\d+)?$/;
const ACCOUNT_NAME = /^[a-z][a-z0-9-]*(\.[a-z0-9-]+)*$/;
const ACCOUNT_ID = /^1\.2\.\d{1,12}$/;
const ASSET_ID = /^1\.3\.\d{1,12}$/;
const ORDER_ID = /^1\.7\.\d{1,12}$/;
const POOL_ID = /^1\.19\.\d{1,12}$/;
const SYMBOL = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;

const ZERO = BigInt(0);
const TEN = BigInt(10);

/** "12.5" and 4 decimals -> 125000n; refuses what is not a plain decimal or has more decimals. */
function toUnits(text, precision) {
    const s = String(text === undefined || text === null ? "" : text).trim();
    if (!DECIMAL.test(s)) {
        throw new UserError(
            `"${cleanText(
                s,
                40
            )}" is not a plain decimal number (digits and one dot, no sign, no exponent)`
        );
    }
    const parts = s.split(".");
    const fraction = parts[1] || "";
    if (fraction.length > precision) {
        throw new UserError(
            `${s} has more than ${precision} decimals, which is all this asset has`
        );
    }
    return BigInt(parts[0] + fraction.padEnd(precision, "0"));
}

/** 125000n and 4 decimals -> "12.5000" (always all the decimals the asset has). */
function fromUnits(units, precision) {
    const value = BigInt(units);
    const negative = value < ZERO;
    const digits = (negative ? -value : value)
        .toString()
        .padStart(precision + 1, "0");
    const whole = digits.slice(0, digits.length - precision);
    const fraction = precision
        ? "." + digits.slice(digits.length - precision)
        : "";
    return (negative ? "-" : "") + whole + fraction;
}

// control characters, zero-width and direction-changing characters (written as escapes in
// a string: a literal U+2028 inside a regular expression would end the line)
const UNSAFE = new RegExp(
    "[\\u0000-\\u001f\\u007f-\\u009f\\u200b-\\u200f\\u2028-\\u202e\\u2060-\\u2069\\ufeff]",
    "g"
);

/** Text that came from the chain or from outside, safe to hand to a model: no control or
 * direction-changing characters, one line, cut at `max`. It is still data, not an instruction. */
function cleanText(value, max) {
    const limit = max || 200;
    const s = String(value === undefined || value === null ? "" : value)
        .replace(UNSAFE, " ")
        .replace(/\s+/g, " ")
        .trim();
    return s.length > limit ? s.slice(0, limit - 1) + "\u2026" : s;
}

/** BitShares' time format: UTC, no zone, seconds. */
function chainTime(date) {
    return date.toISOString().slice(0, 19);
}

/** The reverse of chainTime. */
function parseChainTime(text) {
    const ms = Date.parse(String(text) + "Z");
    return Number.isNaN(ms) ? NaN : ms;
}

/** Whether the text is an asset id or a symbol, and which. */
function assetRef(text) {
    const s = String(text === undefined || text === null ? "" : text).trim();
    if (ASSET_ID.test(s)) return {id: s};
    if (SYMBOL.test(s)) return {symbol: s.toUpperCase()};
    throw new UserError(
        `"${cleanText(
            s,
            40
        )}" is not an asset: give a symbol such as BTS or an id such as 1.3.0`
    );
}

/** Whether the text is an account id or a name, and which. */
function accountRef(text) {
    const s = String(text === undefined || text === null ? "" : text).trim();
    if (ACCOUNT_ID.test(s)) return {id: s};
    const name = s.toLowerCase();
    if (name.length >= 1 && name.length <= 63 && ACCOUNT_NAME.test(name)) {
        return {name};
    }
    throw new UserError(
        `"${cleanText(
            s,
            40
        )}" is not an account: give a name such as alice or an id such as 1.2.100`
    );
}

module.exports = {
    UserError,
    ACCOUNT_NAME,
    ACCOUNT_ID,
    ASSET_ID,
    ORDER_ID,
    POOL_ID,
    SYMBOL,
    toUnits,
    fromUnits,
    cleanText,
    chainTime,
    parseChainTime,
    assetRef,
    accountRef
};
