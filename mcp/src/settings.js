"use strict";
// The settings the MCP server and the web build read, as data: the name, the value it has
// when nothing is set, and what it does. A test checks that the example file, the server's
// parser and this list agree (the application's MCP page does not show them). No code and no
// requires here.
const SETTINGS = [
    {
        name: "MCP_ENABLED",
        group: "server",
        default: "false",
        text:
            "Master switch: the server does not start, and the app has no MCP page, unless this is true."
    },
    {
        name: "MCP_TRANSPORT",
        group: "server",
        default: "stdio",
        text:
            "stdio: the AI client starts the server itself and nothing listens on a port. http: one local web address, with a token."
    },
    {
        name: "MCP_HTTP_HOST",
        group: "http",
        default: "127.0.0.1",
        text:
            "The address the http transport listens on: this machine only, unless you change it."
    },
    {
        name: "MCP_HTTP_PORT",
        group: "http",
        default: "8765",
        text: "The port of the http transport."
    },
    {
        name: "MCP_AUTH_TOKEN",
        group: "http",
        default: "",
        text:
            "At least 24 random characters, sent as a bearer token on every call (node mcp/server.js --new-token makes one)."
    },
    {
        name: "MCP_ALLOWED_ORIGINS",
        group: "http",
        default: "",
        text:
            "Web origins that may call the http transport from a browser: none unless listed."
    },
    {
        name: "MCP_NODES",
        group: "server",
        default: "https://node.xbts.io/ws",
        text:
            "The nodes the server asks, comma separated (https; http only for localhost). The first that answers is used."
    },
    {
        name: "MCP_APP_URL",
        group: "server",
        default: "http://localhost:8080",
        text:
            "Where BitShares Desk is served: the links of the trading tools point there."
    },
    {
        name: "MCP_APP_HASH_ROUTER",
        group: "server",
        default: "false",
        text: "true if the app is built with hash routing (yarn build-hash)."
    },
    {
        name: "MCP_TRADING_ENABLED",
        group: "trading",
        default: "false",
        text:
            "Adds the tools that prepare an order for you to sign. Also puts the review page into the app build."
    },
    {
        name: "MCP_TRADING_ACCOUNTS",
        group: "trading",
        default: "",
        text:
            "The accounts an order may be prepared for. Required when trading is on."
    },
    {
        name: "MCP_TRADE_LIMITS",
        group: "trading",
        default: "",
        text:
            "The assets that may be traded and, per asset, the most one order and 24 hours may sell: SYMBOL:PER_ORDER[:PER_DAY], comma separated. Required when trading is on."
    },
    {
        name: "MCP_MAX_PRICE_DEVIATION_PERCENT",
        group: "trading",
        default: "3",
        text:
            "A price that pays more than this many percent above the market's is refused."
    },
    {
        name: "MCP_PROPOSAL_TTL_MINUTES",
        group: "trading",
        default: "10",
        text: "How long a prepared order can be opened for signing."
    },
    {
        name: "MCP_MAX_ORDER_EXPIRATION_HOURS",
        group: "trading",
        default: "48",
        text: "The longest an order may stay open once it is placed."
    },
    {
        name: "MCP_PREPARE_PER_HOUR",
        group: "trading",
        default: "20",
        text: "How many orders may be prepared per hour."
    },
    {
        name: "MCP_STATE_FILE",
        group: "trading",
        default: ".mcp-state.json",
        text:
            "Where the server keeps what it prepared lately, so that the limits per hour and per day hold across restarts (a file in the project's folder, mode 600)."
    },
    {
        name: "MCP_ALLOW_UNPRICED_MARKETS",
        group: "trading",
        default: "false",
        text:
            "Allow an order in a market that has no price to compare with (not recommended)."
    }
];

module.exports = {SETTINGS};
