"use strict";
// How messages reach the protocol: standard input and output (an AI client starts the
// server as a child process; nothing listens on a port), or HTTP (the MCP "streamable HTTP"
// transport, in its simplest form: one POST, one JSON answer).
//
// The HTTP one is made hard to reach by accident: it listens on the loopback address unless
// told otherwise, wants a bearer token on every call, checks the Host and Origin headers (a
// web page in the user's browser can neither read nor trigger it: DNS rebinding and
// cross-site requests are refused), takes only small JSON bodies, and answers no CORS.
const crypto = require("crypto");
const http = require("http");
const readline = require("readline");

const MAX_BODY = 256 * 1024;
const MAX_REQUESTS_PER_MINUTE = 120;

/** Same answer in the same time whatever the token: compares digests. */
function sameToken(a, b) {
    const ha = crypto
        .createHash("sha256")
        .update(String(a))
        .digest();
    const hb = crypto
        .createHash("sha256")
        .update(String(b))
        .digest();
    return crypto.timingSafeEqual(ha, hb);
}

const isLoopback = host =>
    ["127.0.0.1", "localhost", "::1", "[::1]"].indexOf(host) !== -1;

function runStdio(protocol, io) {
    const input = (io && io.input) || process.stdin;
    const output = (io && io.output) || process.stdout;
    const lines = readline.createInterface({input, crlfDelay: Infinity});
    const send = message => output.write(JSON.stringify(message) + "\n");
    lines.on("line", line => {
        if (!line.trim()) return;
        let message;
        try {
            message = JSON.parse(line);
        } catch (e) {
            send({
                jsonrpc: "2.0",
                id: null,
                error: {code: -32700, message: "Parse error"}
            });
            return;
        }
        protocol.handle(message).then(reply => {
            if (reply) send(reply);
        });
    });
    return new Promise(resolve => lines.on("close", resolve));
}

/**
 * @param {object} protocol  createProtocol()'s result
 * @param {{host: string, port: number, token: string, allowedOrigins: string[]}} settings
 * @param {Function} log
 * @returns {http.Server} (not yet listening)
 */
function createHttpServer(protocol, settings, log) {
    const allowedHosts = ["127.0.0.1", "localhost", "[::1]"].map(
        h => `${h}:${settings.port}`
    );
    if (!isLoopback(settings.host))
        allowedHosts.push(`${settings.host}:${settings.port}`);
    let windowStart = Date.now();
    let count = 0;

    const reply = (res, status, body, headers) => {
        const text = body === undefined ? "" : JSON.stringify(body);
        res.writeHead(
            status,
            Object.assign(
                {
                    "content-type": "application/json",
                    "cache-control": "no-store",
                    "x-content-type-options": "nosniff"
                },
                headers || {}
            )
        );
        res.end(text);
    };

    const server = http.createServer((req, res) => {
        const url = String(req.url || "").split("?")[0];
        if (
            allowedHosts.indexOf(
                String(req.headers.host || "").toLowerCase()
            ) === -1
        ) {
            return reply(res, 403, {error: "host not allowed"});
        }
        const origin = req.headers.origin;
        if (
            origin !== undefined &&
            settings.allowedOrigins.indexOf(origin) === -1
        ) {
            return reply(res, 403, {error: "origin not allowed"});
        }
        if (url === "/health" && req.method === "GET")
            return reply(res, 200, {ok: true});
        if (url !== "/mcp") return reply(res, 404, {error: "not found"});
        if (req.method !== "POST")
            return reply(res, 405, {error: "POST only"}, {allow: "POST"});
        const auth = String(req.headers.authorization || "");
        const given = auth.indexOf("Bearer ") === 0 ? auth.slice(7).trim() : "";
        if (!given || !sameToken(given, settings.token)) {
            log({event: "http", ok: false, code: "unauthorized"});
            return reply(
                res,
                401,
                {error: "unauthorized"},
                {"www-authenticate": "Bearer"}
            );
        }
        if (
            !/^application\/json\b/i.test(
                String(req.headers["content-type"] || "")
            )
        ) {
            return reply(res, 415, {error: "send application/json"});
        }
        const now = Date.now();
        if (now - windowStart > 60000) {
            windowStart = now;
            count = 0;
        }
        if (++count > MAX_REQUESTS_PER_MINUTE)
            return reply(
                res,
                429,
                {error: "too many requests"},
                {"retry-after": "30"}
            );

        const chunks = [];
        let size = 0;
        let tooBig = false;
        req.on("data", chunk => {
            size += chunk.length;
            if (size > MAX_BODY) {
                tooBig = true;
                req.destroy();
                return;
            }
            chunks.push(chunk);
        });
        req.on("end", () => {
            if (tooBig) return;
            let message;
            try {
                message = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            } catch (e) {
                return reply(res, 400, {
                    jsonrpc: "2.0",
                    id: null,
                    error: {code: -32700, message: "Parse error"}
                });
            }
            protocol.handle(message).then(
                out => (out ? reply(res, 200, out) : reply(res, 202)),
                () => reply(res, 500, {error: "internal error"})
            );
        });
        req.on("error", () => {});
    });
    server.requestTimeout = 30000;
    server.headersTimeout = 10000;
    return server;
}

module.exports = {runStdio, createHttpServer, sameToken, isLoopback};
