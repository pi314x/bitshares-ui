// Whether this build has the MCP page and the review of what an AI assistant prepared
// (docs/MCP.md). Both are decided when the app is built (MCP_ENABLED / MCP_TRADING_ENABLED,
// see `.env.example`); a build without them has neither the screens nor their menu entry.
// The `typeof` keeps a bundle that does not define them (the preview build) working.

export function mcpEnabled(): boolean {
    return typeof __MCP_ENABLED__ !== "undefined" && __MCP_ENABLED__ === true;
}

export function mcpTrading(): boolean {
    return (
        mcpEnabled() &&
        typeof __MCP_TRADING__ !== "undefined" &&
        __MCP_TRADING__ === true
    );
}
