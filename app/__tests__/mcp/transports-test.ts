/** @jest-environment node */
import http from "http";
import {PassThrough} from "stream";
import crypto from "crypto";
import {readConfig} from "../../../mcp/src/env";
import {createContext} from "../../../mcp/src/tools";
import {createProtocol} from "../../../mcp/src/protocol";
import {
    createHttpServer,
    runStdio,
    sameToken,
    isLoopback
} from "../../../mcp/src/transports";
import {createChain} from "../utils/fakeChain";

const TOKEN = "t".repeat(32);

function protocolFor() {
    const chain = createChain();
    const config = readConfig({MCP_ENABLED: "true"});
    const context = createContext({
        rpc: chain.rpc,
        config,
        randomHex: (n: number) => "ab".repeat(n),
        sha256Hex: (t: string) =>
            crypto
                .createHash("sha256")
                .update(t)
                .digest("hex")
    });
    return createProtocol({config, context});
}

describe("the http transport", () => {
    let server: http.Server;
    let port = 0;

    beforeAll(async () => {
        const settings = {
            host: "127.0.0.1",
            port: 0,
            token: TOKEN,
            allowedOrigins: ["https://desk.example"]
        };
        server = createHttpServer(protocolFor(), settings, () => {});
        await new Promise<void>(resolve =>
            server.listen(0, "127.0.0.1", resolve)
        );
        port = (server.address() as any).port;
        // the host check compares with the port the server really got
        (settings as any).port = port;
        server.close();
        server = createHttpServer(protocolFor(), {...settings, port}, () => {});
        await new Promise<void>(resolve =>
            server.listen(port, "127.0.0.1", resolve)
        );
    });
    afterAll(
        () => new Promise<void>(resolve => server.close(() => resolve()))
    );

    const request = (options: {
        method?: string;
        path?: string;
        headers?: Record<string, string>;
        body?: any;
        raw?: string;
    }) =>
        new Promise<{
            status: number;
            body: any;
            headers: http.IncomingHttpHeaders;
        }>((resolve, reject) => {
            const text =
                options.raw !== undefined
                    ? options.raw
                    : options.body === undefined
                    ? ""
                    : JSON.stringify(options.body);
            const req = http.request(
                {
                    host: "127.0.0.1",
                    port,
                    method: options.method || "POST",
                    path: options.path || "/mcp",
                    headers: {
                        "content-type": "application/json",
                        authorization: `Bearer ${TOKEN}`,
                        "content-length": String(Buffer.byteLength(text)),
                        ...(options.headers || {})
                    }
                },
                res => {
                    let data = "";
                    res.on("data", c => (data += c));
                    res.on("end", () => {
                        let body: any = data;
                        try {
                            body = data ? JSON.parse(data) : null;
                        } catch (e) {
                            // not JSON
                        }
                        resolve({
                            status: res.statusCode || 0,
                            body,
                            headers: res.headers
                        });
                    });
                }
            );
            req.on("error", reject);
            req.end(text);
        });

    const ping = {jsonrpc: "2.0", id: 1, method: "ping"};

    it("answers a request with the token", async () => {
        const r = await request({body: ping});
        expect(r.status).toBe(200);
        expect(r.body).toEqual({jsonrpc: "2.0", id: 1, result: {}});
        expect(r.headers["access-control-allow-origin"]).toBeUndefined();
        expect(r.headers["cache-control"]).toBe("no-store");
        const list = await request({
            body: {jsonrpc: "2.0", id: 2, method: "tools/list"}
        });
        expect(list.body.result.tools.length).toBeGreaterThan(5);
    });

    it("answers a notification with 202 and nothing", async () => {
        const r = await request({
            body: {jsonrpc: "2.0", method: "notifications/initialized"}
        });
        expect(r.status).toBe(202);
        expect(r.body).toBeNull();
    });

    it("wants the token, the right one", async () => {
        expect(
            (await request({body: ping, headers: {authorization: ""}})).status
        ).toBe(401);
        expect(
            (
                await request({
                    body: ping,
                    headers: {authorization: "Bearer wrong"}
                })
            ).status
        ).toBe(401);
        expect(
            (await request({body: ping, headers: {authorization: TOKEN}}))
                .status
        ).toBe(401);
        const r = await request({
            body: ping,
            headers: {authorization: "Bearer nope"}
        });
        expect(r.headers["www-authenticate"]).toBe("Bearer");
    });

    it("refuses a Host that is not this machine (DNS rebinding) and an Origin that was not named", async () => {
        expect(
            (await request({body: ping, headers: {host: "evil.example"}}))
                .status
        ).toBe(403);
        expect(
            (
                await request({
                    body: ping,
                    headers: {host: `evil.example:${port}`}
                })
            ).status
        ).toBe(403);
        expect(
            (
                await request({
                    body: ping,
                    headers: {origin: "https://evil.example"}
                })
            ).status
        ).toBe(403);
        expect(
            (await request({body: ping, headers: {origin: "null"}})).status
        ).toBe(403);
        expect(
            (
                await request({
                    body: ping,
                    headers: {origin: "https://desk.example"}
                })
            ).status
        ).toBe(200);
        expect(
            (await request({body: ping, headers: {host: `localhost:${port}`}}))
                .status
        ).toBe(200);
    });

    it("takes POST on /mcp only, JSON only, and small bodies", async () => {
        expect((await request({method: "GET"})).status).toBe(405);
        expect((await request({method: "DELETE"})).status).toBe(405);
        expect((await request({path: "/other", body: ping})).status).toBe(404);
        expect(
            (
                await request({
                    body: ping,
                    headers: {"content-type": "text/plain"}
                })
            ).status
        ).toBe(415);
        expect((await request({raw: "{not json"})).status).toBe(400);
        const small = await request({
            method: "GET",
            path: "/health",
            headers: {authorization: ""}
        });
        expect(small.status).toBe(200);
        const big = await request({
            raw: JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "ping",
                params: {x: "y".repeat(300 * 1024)}
            })
        }).catch(() => ({status: 0}));
        // refused: the connection is cut or an error comes back, never an answer
        expect([0, 413, 400]).toContain((big as any).status);
    });

    it("reads a call through to a tool", async () => {
        const r = await request({
            body: {
                jsonrpc: "2.0",
                id: 3,
                method: "tools/call",
                params: {name: "bitshares_chain_info", arguments: {}}
            }
        });
        expect(r.body.result.structuredContent.head_block_number).toBe(1000);
    });
});

describe("the stdio transport", () => {
    it("reads one JSON message per line and writes one per reply", async () => {
        const input = new PassThrough();
        const output = new PassThrough();
        const done = runStdio(protocolFor(), {input, output});
        const lines: any[] = [];
        output.on("data", chunk =>
            String(chunk)
                .split("\n")
                .filter(Boolean)
                .forEach(l => lines.push(JSON.parse(l)))
        );
        input.write('{"jsonrpc":"2.0","id":1,"method":"ping"}\n');
        input.write("\n");
        input.write("{broken\n");
        input.write('{"jsonrpc":"2.0","method":"notifications/initialized"}\n');
        input.write('{"jsonrpc":"2.0","id":2,"method":"tools/list"}\n');
        input.end();
        await done;
        await new Promise(resolve => setTimeout(resolve, 20));
        expect(lines.find(l => l.id === 1)).toEqual({
            jsonrpc: "2.0",
            id: 1,
            result: {}
        });
        expect(lines.find(l => l.id === null).error.code).toBe(-32700);
        expect(lines.find(l => l.id === 2).result.tools.length).toBeGreaterThan(
            5
        );
        expect(lines).toHaveLength(3);
    });
});

describe("helpers", () => {
    it("compares tokens whatever their length", () => {
        expect(sameToken("abc", "abc")).toBe(true);
        expect(sameToken("abc", "abd")).toBe(false);
        expect(sameToken("abc", "abcd")).toBe(false);
        expect(sameToken("", "x")).toBe(false);
    });

    it("knows the loopback names", () => {
        ["127.0.0.1", "localhost", "::1"].forEach(h =>
            expect(isLoopback(h)).toBe(true)
        );
        ["0.0.0.0", "192.168.1.5", "example.com"].forEach(h =>
            expect(isLoopback(h)).toBe(false)
        );
    });
});
