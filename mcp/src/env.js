"use strict";
// The settings of the MCP server: read from the process environment, which a `.env` file
// in the project's root fills in for what is not set already (see `.env.example`). Every
// value is checked, and a wrong one stops the server with a message rather than falling
// back to something looser: the defaults are the safe ones (off, read-only, local only).
const fs = require("fs");

class ConfigError extends Error {
    constructor(message) {
        super(message);
        this.name = "ConfigError";
    }
}

/** KEY=value lines; `#` comments, blank lines, an optional `export `, quotes around a value. */
function parseEnvFile(text) {
    const out = {};
    String(text)
        .split(/\r?\n/)
        .forEach(line => {
            const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(
                line
            );
            if (!m) return;
            let value = m[2];
            const quoted = /^(["'])(.*)\1$/.exec(value);
            if (quoted) value = quoted[2];
            else value = value.replace(/\s+#.*$/, "");
            out[m[1]] = value;
        });
    return out;
}

/** Puts the file's values into `env` where `env` has none: the real environment wins. Only
 * the names that match `only` (a RegExp), when given. */
function loadEnvFile(file, env, only) {
    let text;
    try {
        text = fs.readFileSync(file, "utf8");
    } catch (e) {
        return false;
    }
    const values = parseEnvFile(text);
    Object.keys(values).forEach(key => {
        if (only && !only.test(key)) return;
        if (env[key] === undefined) env[key] = values[key];
    });
    return true;
}

function flag(env, name, fallback) {
    const raw = env[name];
    if (raw === undefined || String(raw).trim() === "") return fallback;
    const v = String(raw)
        .trim()
        .toLowerCase();
    if (["1", "true", "yes", "on"].indexOf(v) !== -1) return true;
    if (["0", "false", "no", "off"].indexOf(v) !== -1) return false;
    throw new ConfigError(`${name} must be true or false, not "${raw}"`);
}

function number(env, name, fallback, min, max) {
    const raw = env[name];
    if (raw === undefined || String(raw).trim() === "") return fallback;
    const n = Number(String(raw).trim());
    if (!Number.isFinite(n) || n < min || n > max) {
        throw new ConfigError(
            `${name} must be a number from ${min} to ${max}, not "${raw}"`
        );
    }
    return n;
}

function list(env, name) {
    const raw = env[name];
    if (raw === undefined) return [];
    return String(raw)
        .split(",")
        .map(s => s.trim())
        .filter(Boolean);
}

function url(text, name, schemes) {
    let parsed;
    try {
        parsed = new URL(text);
    } catch (e) {
        throw new ConfigError(`${name}: "${text}" is not a URL`);
    }
    const local =
        ["localhost", "127.0.0.1", "[::1]"].indexOf(parsed.hostname) !== -1;
    // a node or the app over clear text is for this machine only
    if (
        !(
            schemes.indexOf(parsed.protocol) !== -1 &&
            (parsed.protocol === "https:" || local)
        )
    ) {
        throw new ConfigError(
            `${name}: "${text}" must be https (http only for localhost)`
        );
    }
    return parsed.toString().replace(/\/$/, "");
}

/**
 * "BTS:1000:5000,XBTSX.USDT:50" -> {BTS: {perOrder: "1000", perDay: "5000"}, ...}. The
 * assets named are the only ones that can be traded, each with the most that one order may
 * sell and (the second number, the first one's by default) the most in 24 hours.
 */
function tradeLimits(text) {
    const limits = {};
    String(text || "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
        .forEach(entry => {
            const m = /^([A-Za-z0-9][A-Za-z0-9._-]{0,31}):(\d+(?:\.\d+)?)(?::(\d+(?:\.\d+)?))?$/.exec(
                entry
            );
            if (!m) {
                throw new ConfigError(
                    `MCP_TRADE_LIMITS: "${entry}" is not SYMBOL:PER_ORDER[:PER_DAY], e.g. BTS:1000:5000`
                );
            }
            const symbol = m[1].toUpperCase();
            const perOrder = m[2];
            const perDay = m[3] || m[2];
            if (Number(perOrder) <= 0 || Number(perDay) < Number(perOrder)) {
                throw new ConfigError(
                    `MCP_TRADE_LIMITS: ${symbol}: the limit per order must be above 0 and the limit per day at least as large`
                );
            }
            limits[symbol] = {perOrder, perDay};
        });
    return limits;
}

/** The settings, checked. `env` is an object like process.env. Throws ConfigError. */
function readConfig(env) {
    const enabled = flag(env, "MCP_ENABLED", false);
    const transport = String(env.MCP_TRANSPORT || "stdio")
        .trim()
        .toLowerCase();
    if (["stdio", "http"].indexOf(transport) === -1) {
        throw new ConfigError(
            `MCP_TRANSPORT must be stdio or http, not "${env.MCP_TRANSPORT}"`
        );
    }
    const nodes = (list(env, "MCP_NODES").length
        ? list(env, "MCP_NODES")
        : ["https://node.xbts.io/ws"]
    ).map(n => url(n, "MCP_NODES", ["https:", "http:"]));
    const token = String(env.MCP_AUTH_TOKEN || "").trim();
    const http = {
        host: String(env.MCP_HTTP_HOST || "127.0.0.1").trim(),
        port: number(env, "MCP_HTTP_PORT", 8765, 1, 65535),
        token,
        allowedOrigins: list(env, "MCP_ALLOWED_ORIGINS")
    };
    if (enabled && transport === "http" && token.length < 24) {
        throw new ConfigError(
            "MCP_AUTH_TOKEN must be set to at least 24 characters for the http transport (node mcp/server.js --new-token makes one)"
        );
    }
    const trading = {
        enabled: flag(env, "MCP_TRADING_ENABLED", false),
        accounts: list(env, "MCP_TRADING_ACCOUNTS").map(a => a.toLowerCase()),
        limits: tradeLimits(env.MCP_TRADE_LIMITS),
        maxDeviationPercent: number(
            env,
            "MCP_MAX_PRICE_DEVIATION_PERCENT",
            3,
            0.1,
            50
        ),
        proposalTtlMinutes: number(env, "MCP_PROPOSAL_TTL_MINUTES", 10, 1, 60),
        maxExpirationHours: number(
            env,
            "MCP_MAX_ORDER_EXPIRATION_HOURS",
            48,
            1,
            720
        ),
        preparePerHour: number(env, "MCP_PREPARE_PER_HOUR", 20, 1, 200),
        stateFile: String(env.MCP_STATE_FILE || ".mcp-state.json").trim(),
        allowUnpriced: flag(env, "MCP_ALLOW_UNPRICED_MARKETS", false)
    };
    if (enabled && trading.enabled) {
        if (!trading.accounts.length) {
            throw new ConfigError(
                "MCP_TRADING_ACCOUNTS must name the accounts an order may be prepared for (trading is on)"
            );
        }
        if (!Object.keys(trading.limits).length) {
            throw new ConfigError(
                "MCP_TRADE_LIMITS must name the assets that may be traded and their limits (trading is on)"
            );
        }
    }
    return {
        enabled,
        transport,
        http,
        nodes,
        appUrl: url(env.MCP_APP_URL || "http://localhost:8080", "MCP_APP_URL", [
            "https:",
            "http:"
        ]),
        appHashRouter: flag(env, "MCP_APP_HASH_ROUTER", false),
        trading
    };
}

/**
 * What the web build needs to know: whether the application has the MCP page, and whether
 * it has the review of transactions an assistant prepared. Only these two switches: the
 * rest of the settings belong to the server. Trading needs MCP on as well.
 */
function buildFlags(env) {
    const enabled = flag(env, "MCP_ENABLED", false);
    return {
        enabled,
        trading: enabled && flag(env, "MCP_TRADING_ENABLED", false)
    };
}

module.exports = {
    ConfigError,
    parseEnvFile,
    loadEnvFile,
    readConfig,
    buildFlags,
    tradeLimits
};
