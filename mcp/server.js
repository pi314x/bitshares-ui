#!/usr/bin/env node
"use strict";
// The MCP server of BitShares Desk. Off unless MCP_ENABLED=true (in the environment or in
// the `.env` file of the project's root; see `.env.example` and mcp/README.md).
//
//   node mcp/server.js              start it (the transport is MCP_TRANSPORT: stdio or http)
//   node mcp/server.js --new-token  print a random token for MCP_AUTH_TOKEN
//   node mcp/server.js --check      read the settings, say what is on, and stop
//
// stdout is the protocol's channel when the transport is stdio, so everything this process
// says for people goes to stderr.
const crypto = require("crypto");
const path = require("path");
const {ConfigError, loadEnvFile, readConfig} = require("./src/env");
const {createRpc} = require("./src/rpc");
const {createContext, listTools} = require("./src/tools");
const {createProtocol} = require("./src/protocol");
const {runStdio, createHttpServer, isLoopback} = require("./src/transports");
const {createLedger} = require("./src/policy");
const {fileStore} = require("./src/store");

const say = text => process.stderr.write(text + "\n");
const log = entry =>
    process.stderr.write(
        JSON.stringify(Object.assign({t: new Date().toISOString()}, entry)) +
            "\n"
    );

async function main(argv) {
    if (argv.indexOf("--new-token") !== -1) {
        process.stdout.write(
            crypto.randomBytes(32).toString("base64url") + "\n"
        );
        return 0;
    }
    loadEnvFile(path.join(__dirname, "..", ".env"), process.env);
    let config;
    try {
        config = readConfig(process.env);
    } catch (e) {
        if (e instanceof ConfigError) {
            say(`MCP server: ${e.message}`);
            return 2;
        }
        throw e;
    }
    if (argv.indexOf("--check") !== -1) {
        say(`MCP_ENABLED: ${config.enabled}`);
        say(`transport: ${config.transport}`);
        say(`nodes: ${config.nodes.join(", ")}`);
        say(
            `trading tools: ${
                config.trading.enabled
                    ? "ON (prepare only, the person signs)"
                    : "off"
            }`
        );
        say(
            `tools: ${listTools(config)
                .map(t => t.name)
                .join(", ")}`
        );
        return 0;
    }
    if (!config.enabled) {
        say("MCP server: not started, MCP_ENABLED is not true.");
        return 0;
    }
    const rpc = createRpc({urls: config.nodes});
    // what was prepared lately is kept between runs (the daily limit needs it)
    const ledger = createLedger(
        config.trading.enabled
            ? fileStore(path.resolve(__dirname, "..", config.trading.stateFile))
            : null
    );
    const context = createContext({
        rpc,
        config,
        ledger,
        randomHex: bytes => crypto.randomBytes(bytes).toString("hex"),
        sha256Hex: text =>
            crypto
                .createHash("sha256")
                .update(text)
                .digest("hex")
    });
    const protocol = createProtocol({config, context, log});
    say(
        `MCP server: ${listTools(config).length} tools, transport ${
            config.transport
        }, trading ${config.trading.enabled ? "ON (prepare only)" : "off"}.`
    );

    if (config.transport === "stdio") {
        await runStdio(protocol);
        return 0;
    }
    const server = createHttpServer(protocol, config.http, log);
    if (!isLoopback(config.http.host)) {
        say(
            `MCP server: WARNING: listening on ${config.http.host}, not only on this machine. Put TLS in front of it and keep the token secret.`
        );
    }
    await new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(config.http.port, config.http.host, resolve);
    });
    say(
        `MCP server: http://${config.http.host}:${config.http.port}/mcp (Authorization: Bearer <MCP_AUTH_TOKEN>)`
    );
    return new Promise(() => {});
}

main(process.argv.slice(2)).then(
    code => {
        if (code) process.exitCode = code;
    },
    e => {
        say(`MCP server: ${(e && e.message) || e}`);
        process.exitCode = 1;
    }
);
