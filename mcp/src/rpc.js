"use strict";
// Calls to a BitShares node over its HTTP JSON-RPC (the same address as its websocket),
// with named APIs, so there is no session to keep. The nodes are tried in turn: the last
// one that answered first. Read-only: this module has no way to broadcast a transaction
// (`network_broadcast` is not a name it will call).

// only the database (0) and history APIs are reachable; and calls that would change
// something on the node or the chain are refused by name, whatever calls them
const FORBIDDEN = /^(broadcast|set_|cancel_all|login|network_broadcast)/;

class RpcError extends Error {
    constructor(message, detail) {
        super(message);
        this.name = "RpcError";
        this.detail = detail;
    }
}

/**
 * @param {{urls: string[], fetch?: Function, timeoutMs?: number}} options
 * @returns {{call: (api: string|number, method: string, params: any[]) => Promise<any>, last: () => string|null}}
 */
function createRpc(options) {
    const urls = options.urls;
    const doFetch =
        options.fetch || (typeof fetch === "function" ? fetch : null);
    const timeoutMs = options.timeoutMs || 15000;
    let preferred = 0;
    let lastUsed = null;
    let nextId = 1;

    async function once(url, api, method, params) {
        if (!doFetch)
            throw new RpcError(
                "this Node.js has no fetch (use Node 18 or later)"
            );
        const controller =
            typeof AbortController === "function"
                ? new AbortController()
                : null;
        const timer = controller
            ? setTimeout(() => controller.abort(), timeoutMs)
            : null;
        try {
            const response = await doFetch(url, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "user-agent": "curl/8 bitshares-desk-mcp"
                },
                body: JSON.stringify({
                    jsonrpc: "2.0",
                    method: "call",
                    params: [api, method, params],
                    id: nextId++
                }),
                signal: controller ? controller.signal : undefined
            });
            if (!response.ok)
                throw new RpcError(`node answered ${response.status}`);
            const body = await response.json();
            if (body && body.error) {
                const message = String(
                    (body.error && body.error.message) ||
                        "the node refused the call"
                );
                // a refused call is an answer, not a broken node: do not try the next one
                const refusal = new RpcError(
                    message.split("\n")[0].slice(0, 300)
                );
                refusal.answered = true;
                throw refusal;
            }
            return body.result;
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    return {
        async call(api, method, params) {
            if (FORBIDDEN.test(method))
                throw new RpcError(`the call ${method} is not allowed here`);
            if (api !== 0 && api !== "database" && api !== "history") {
                throw new RpcError(`the API ${api} is not allowed here`);
            }
            let failure = null;
            for (let i = 0; i < urls.length; i++) {
                const index = (preferred + i) % urls.length;
                try {
                    const result = await once(
                        urls[index],
                        api,
                        method,
                        params || []
                    );
                    preferred = index;
                    lastUsed = urls[index];
                    return result;
                } catch (e) {
                    if (e && e.answered) throw e;
                    failure = e;
                }
            }
            throw new RpcError(
                `no node answered${
                    failure && failure.message
                        ? ": " + String(failure.message).slice(0, 120)
                        : ""
                }`
            );
        },
        last: () => lastUsed
    };
}

module.exports = {createRpc, RpcError};
