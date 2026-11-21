"use strict";
// The Model Context Protocol, the part a tool server needs: JSON-RPC 2.0 messages for
// `initialize`, `ping`, `tools/list` and `tools/call` (the notifications are accepted and
// ignored). Transport-free: a message goes in, the reply (or null) comes out, so the stdio
// and HTTP transports and the tests all use the same function.
const {SERVER_INFO, INSTRUCTIONS} = require("./catalog");
const {validate} = require("./schema");
const {UserError, cleanText} = require("./format");
const {RpcError} = require("./rpc");
const {listTools, HANDLERS} = require("./tools");

const VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
const MAX_RESULT_CHARS = 100000;

const rpcError = (id, code, message) => ({
    jsonrpc: "2.0",
    id: id === undefined ? null : id,
    error: {code, message}
});

/**
 * @param {{config: object, context: object, log?: Function}} options
 * @returns {{handle: (message: any) => Promise<object|null>}}
 */
function createProtocol(options) {
    const {config, context} = options;
    const log = options.log || (() => {});

    async function callTool(id, params) {
        const name = params && params.name;
        const tool = listTools(config).find(t => t.name === name);
        if (!tool || !HANDLERS[name])
            return rpcError(id, -32602, `Unknown tool: ${cleanText(name, 60)}`);
        const args = params.arguments === undefined ? {} : params.arguments;
        const checked = validate(args, tool.inputSchema);
        if (!checked.ok)
            return rpcError(
                id,
                -32602,
                `Invalid arguments for ${name}: ${checked.errors
                    .slice(0, 5)
                    .join("; ")}`
            );
        const started = Date.now();
        const reply = (isError, text, structured) => {
            const result = {content: [{type: "text", text}], isError};
            if (structured && !isError) result.structuredContent = structured;
            return {jsonrpc: "2.0", id, result};
        };
        try {
            const out = await HANDLERS[name](context, args);
            const body = JSON.stringify(out, null, 2);
            log({
                event: "tool",
                tool: name,
                ok: true,
                ms: Date.now() - started,
                args
            });
            if (body.length > MAX_RESULT_CHARS) {
                return reply(
                    true,
                    "The result is too large to return; ask for less (a smaller limit or depth)."
                );
            }
            return reply(false, body, out);
        } catch (e) {
            if (e instanceof UserError) {
                log({
                    event: "tool",
                    tool: name,
                    ok: false,
                    code: e.code,
                    ms: Date.now() - started,
                    args
                });
                return reply(true, e.message);
            }
            if (e instanceof RpcError) {
                log({
                    event: "tool",
                    tool: name,
                    ok: false,
                    code: "node",
                    message: e.message,
                    ms: Date.now() - started
                });
                return reply(
                    true,
                    `The BitShares node could not answer: ${e.message}`
                );
            }
            log({
                event: "tool",
                tool: name,
                ok: false,
                code: "internal",
                message: String((e && e.message) || e).slice(0, 200)
            });
            return reply(true, "The tool failed unexpectedly.");
        }
    }

    async function one(message) {
        if (
            !message ||
            typeof message !== "object" ||
            Array.isArray(message) ||
            message.jsonrpc !== "2.0" ||
            typeof message.method !== "string"
        ) {
            return rpcError(message && message.id, -32600, "Invalid request");
        }
        const hasId =
            Object.prototype.hasOwnProperty.call(message, "id") &&
            message.id !== null;
        const id = message.id;
        if (!hasId) return null; // a notification: nothing to answer
        switch (message.method) {
            case "initialize": {
                const asked = message.params && message.params.protocolVersion;
                return {
                    jsonrpc: "2.0",
                    id,
                    result: {
                        protocolVersion:
                            VERSIONS.indexOf(asked) !== -1
                                ? asked
                                : VERSIONS[0],
                        capabilities: {tools: {listChanged: false}},
                        serverInfo: SERVER_INFO,
                        instructions: INSTRUCTIONS
                    }
                };
            }
            case "ping":
                return {jsonrpc: "2.0", id, result: {}};
            case "tools/list":
                return {jsonrpc: "2.0", id, result: {tools: listTools(config)}};
            case "tools/call":
                return callTool(id, message.params);
            default:
                return rpcError(
                    id,
                    -32601,
                    `Method not found: ${cleanText(message.method, 60)}`
                );
        }
    }

    return {
        /** One message or a batch; resolves to the reply, an array of replies, or null. */
        async handle(message) {
            if (Array.isArray(message)) {
                if (!message.length)
                    return rpcError(null, -32600, "Invalid request");
                const replies = (await Promise.all(message.map(one))).filter(
                    Boolean
                );
                return replies.length ? replies : null;
            }
            return one(message);
        }
    };
}

module.exports = {createProtocol, VERSIONS};
