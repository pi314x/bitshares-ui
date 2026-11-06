"use strict";
// A prepared transaction: what the server hands to a person and the application checks
// before anything is signed. It is a small JSON document (the account, the operations as
// the chain reads them, when it was made and when it stops being good) carried in a link's
// fragment, so it never reaches a web server. It holds NO key and NO signature.
//
// Both sides use this file: the server to make and describe it, the application to read it
// again - strictly, with its own eyes: it takes only the two operations that trading needs
// and refuses a field it does not know. The words the application shows are made from the
// operations, never taken from the document.
const {ACCOUNT_ID, ASSET_ID, ORDER_ID, fromUnits} = require("./format");

const VERSION = 1;
const MAX_ENCODED = 8192;
/** The only operations a prepared transaction may carry. */
const OPERATIONS = {limit_order_create: 1, limit_order_cancel: 2};

/** JSON with the keys of every object in order: the same text for the same content. */
function canonical(value) {
    if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
    if (value && typeof value === "object") {
        return (
            "{" +
            Object.keys(value)
                .sort()
                .map(k => JSON.stringify(k) + ":" + canonical(value[k]))
                .join(",") +
            "}"
        );
    }
    return JSON.stringify(value);
}

/**
 * A short code that stands for what would be signed: the chain, the account and the
 * operations. The server says it in its answer and the application shows it again, so a
 * person can see that the link in front of them is the order that was talked about.
 * `sha256Hex` is the caller's hash (Node's crypto, or the application's library).
 */
function fingerprint(proposal, sha256Hex) {
    const hex = String(
        sha256Hex(
            canonical({
                chain: proposal.chain,
                account: proposal.account.id,
                ops: proposal.ops
            })
        )
    ).toUpperCase();
    return hex.slice(0, 4) + "-" + hex.slice(4, 8);
}

/** Whether the reference in the document is the one its operations give (a tampered
 * document that kept the old reference is refused: the application shows the recomputed one). */
function verifyReference(proposal, sha256Hex) {
    return fingerprint(proposal, sha256Hex) === proposal.ref;
}

function toBase64Url(text) {
    let b64;
    if (typeof Buffer !== "undefined") {
        b64 = Buffer.from(text, "utf8").toString("base64");
    } else {
        let binary = "";
        new TextEncoder().encode(text).forEach(b => {
            binary += String.fromCharCode(b);
        });
        b64 = btoa(binary);
    }
    return b64
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
}

function fromBase64Url(text) {
    const b64 =
        text.replace(/-/g, "+").replace(/_/g, "/") +
        "===".slice((text.length + 3) % 4);
    if (typeof Buffer !== "undefined")
        return Buffer.from(b64, "base64").toString("utf8");
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
}

function encodeProposal(proposal) {
    return toBase64Url(JSON.stringify(proposal));
}

const AMOUNT_UNITS = /^\d{1,19}$/;
const CHAIN_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

function onlyKeys(object, keys) {
    return (
        !!object &&
        typeof object === "object" &&
        !Array.isArray(object) &&
        Object.keys(object).every(k => keys.indexOf(k) !== -1) &&
        keys.every(k => Object.prototype.hasOwnProperty.call(object, k))
    );
}

function assetAmount(a) {
    return (
        onlyKeys(a, ["amount", "asset_id"]) &&
        AMOUNT_UNITS.test(String(a.amount)) &&
        ASSET_ID.test(String(a.asset_id))
    );
}

/** Whether `[id, fields]` is exactly one of the operations a prepared transaction may carry. */
function strictOperation(op) {
    if (!Array.isArray(op) || op.length !== 2)
        return "operation is not [id, fields]";
    const [id, f] = op;
    const emptyExtensions =
        f && Array.isArray(f.extensions) && f.extensions.length === 0;
    const fee =
        f &&
        onlyKeys(f.fee, ["amount", "asset_id"]) &&
        String(f.fee.amount) === "0" &&
        f.fee.asset_id === "1.3.0";
    if (id === OPERATIONS.limit_order_create) {
        if (
            !onlyKeys(f, [
                "fee",
                "seller",
                "amount_to_sell",
                "min_to_receive",
                "expiration",
                "fill_or_kill",
                "extensions"
            ]) ||
            !fee ||
            !emptyExtensions ||
            !ACCOUNT_ID.test(String(f.seller)) ||
            !assetAmount(f.amount_to_sell) ||
            !assetAmount(f.min_to_receive) ||
            !CHAIN_TIME.test(String(f.expiration)) ||
            typeof f.fill_or_kill !== "boolean"
        ) {
            return "limit_order_create has fields the application does not accept";
        }
        if (
            BigInt(f.amount_to_sell.amount) === BigInt(0) ||
            BigInt(f.min_to_receive.amount) === BigInt(0)
        ) {
            return "limit_order_create with an amount of zero";
        }
        if (f.amount_to_sell.asset_id === f.min_to_receive.asset_id)
            return "limit_order_create sells and receives the same asset";
        return null;
    }
    if (id === OPERATIONS.limit_order_cancel) {
        if (
            !onlyKeys(f, [
                "fee",
                "fee_paying_account",
                "order",
                "extensions"
            ]) ||
            !fee ||
            !emptyExtensions ||
            !ACCOUNT_ID.test(String(f.fee_paying_account)) ||
            !ORDER_ID.test(String(f.order))
        ) {
            return "limit_order_cancel has fields the application does not accept";
        }
        return null;
    }
    return "operation " + id + " cannot be carried in a prepared transaction";
}

/**
 * The document in a link, read and checked. Returns {ok: true, proposal} or {ok: false,
 * error, detail}; `error` is a short code the application has words for. It does NOT check
 * the time against a clock (see isCurrent) or the chain (the application does, against the
 * chain it is connected to).
 */
function decodeProposal(text) {
    const raw = String(text || "").trim();
    if (!raw) return {ok: false, error: "empty"};
    if (raw.length > MAX_ENCODED) return {ok: false, error: "too_large"};
    if (!/^[A-Za-z0-9_-]+$/.test(raw)) return {ok: false, error: "not_encoded"};
    let p;
    try {
        p = JSON.parse(fromBase64Url(raw));
    } catch (e) {
        return {ok: false, error: "not_json"};
    }
    if (
        !onlyKeys(p, [
            "v",
            "chain",
            "account",
            "ops",
            "created",
            "expires",
            "nonce",
            "ref"
        ])
    ) {
        return {ok: false, error: "fields"};
    }
    if (p.v !== VERSION) return {ok: false, error: "version"};
    if (!/^[0-9a-f]{64}$/.test(String(p.chain)))
        return {ok: false, error: "chain"};
    if (
        !onlyKeys(p.account, ["id", "name"]) ||
        !ACCOUNT_ID.test(String(p.account.id)) ||
        typeof p.account.name !== "string"
    ) {
        return {ok: false, error: "account"};
    }
    if (!Array.isArray(p.ops) || p.ops.length !== 1)
        return {ok: false, error: "operations"};
    const bad = strictOperation(p.ops[0]);
    if (bad) return {ok: false, error: "operation", detail: bad};
    const owner = p.ops[0][1].seller || p.ops[0][1].fee_paying_account;
    if (owner !== p.account.id) return {ok: false, error: "account_mismatch"};
    if (
        !Number.isFinite(Date.parse(p.created)) ||
        !Number.isFinite(Date.parse(p.expires))
    )
        return {ok: false, error: "time"};
    if (
        Date.parse(p.expires) <= Date.parse(p.created) ||
        Date.parse(p.expires) - Date.parse(p.created) > 2 * 3600 * 1000
    ) {
        return {ok: false, error: "time"};
    }
    if (
        !/^[0-9a-f]{16}$/.test(String(p.nonce)) ||
        !/^[0-9A-F]{4}-[0-9A-F]{4}$/.test(String(p.ref))
    ) {
        return {ok: false, error: "reference"};
    }
    return {ok: true, proposal: p};
}

/** Whether the proposal is still good at `nowMs` (and was not made in the future). */
function isCurrent(proposal, nowMs) {
    return (
        nowMs < Date.parse(proposal.expires) &&
        nowMs >= Date.parse(proposal.created) - 5 * 60 * 1000
    );
}

/**
 * Words for what the operation does, made from the operation itself. `lookup(assetId)`
 * gives {symbol, precision} (or null when it is not known: the id is shown then).
 */
function summarize(op, lookup) {
    const [id, f] = op;
    const asset = assetId => lookup(assetId) || {symbol: assetId, precision: 0};
    const amount = a => {
        const info = asset(a.asset_id);
        return `${fromUnits(BigInt(a.amount), info.precision)} ${info.symbol}`;
    };
    if (id === OPERATIONS.limit_order_create) {
        const sell = asset(f.amount_to_sell.asset_id);
        const receive = asset(f.min_to_receive.asset_id);
        const give =
            Number(f.amount_to_sell.amount) / Math.pow(10, sell.precision);
        const get =
            Number(f.min_to_receive.amount) / Math.pow(10, receive.precision);
        const price = get > 0 ? give / get : 0;
        return (
            `Sell ${amount(f.amount_to_sell)} for at least ${amount(
                f.min_to_receive
            )}` +
            (price
                ? ` (${Number(price.toPrecision(8))} ${sell.symbol} per ${
                      receive.symbol
                  })`
                : "") +
            `, open until ${f.expiration.replace("T", " ")} UTC` +
            (f.fill_or_kill ? ", fill or kill" : "")
        );
    }
    return `Cancel the open order ${f.order}`;
}

module.exports = {
    VERSION,
    OPERATIONS,
    canonical,
    fingerprint,
    verifyReference,
    encodeProposal,
    decodeProposal,
    strictOperation,
    isCurrent,
    summarize,
    toBase64Url,
    fromBase64Url
};
