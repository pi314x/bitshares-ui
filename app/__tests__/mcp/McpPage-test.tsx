import * as React from "react";
import {render, fireEvent, act} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";
import {TOOLS} from "../../../mcp/src/catalog";
import McpPage from "../../components/Mcp/McpPage";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

describe("the MCP page", () => {
    it("lists every tool of the server's catalog, with its name, description and arguments", () => {
        const {container, getByText} = render(<McpPage />);
        fireEvent.click(getByText("Tools"));
        const cards = Array.from(container.querySelectorAll("[data-tool]"));
        expect(cards.map(c => c.getAttribute("data-tool")).sort()).toEqual(
            TOOLS.map((t: any) => t.name).sort()
        );
        const balances = container.querySelector(
            '[data-tool="bitshares_get_balances"]'
        )!;
        expect(balances.textContent).toContain("Balances");
        expect(balances.textContent).toContain("include_zero");
        expect(balances.textContent).toMatch(/account\s*string, required/);
        expect(balances.textContent).toContain("Zero balances are left out");
        // a tool without arguments says so
        expect(
            container.querySelector('[data-tool="bitshares_chain_info"]')!
                .textContent
        ).toContain("No arguments.");
    });

    it("shows the annotations as chips: read-only for what reads, not read-only for what prepares", () => {
        const {container, getByText} = render(<McpPage />);
        fireEvent.click(getByText("Tools"));
        const chips = (name: string) =>
            container.querySelector(`[data-tool="${name}"]`)!.textContent || "";
        expect(chips("bitshares_get_ticker")).toContain("Read-only");
        expect(chips("bitshares_get_ticker")).toContain("Asks the network");
        expect(chips("bitshares_get_ticker")).not.toContain("Not read-only");
        expect(chips("bitshares_prepare_limit_order")).toContain(
            "Not read-only"
        );
        expect(chips("bitshares_prepare_limit_order")).not.toMatch(
            /Destructive/
        );
        // what the policy tool reaches is nothing outside
        expect(chips("bitshares_trading_policy")).toContain("Local only");
        // a chip explains itself
        const chip = Array.from(container.querySelectorAll("span")).find(
            s => s.textContent === "Not read-only"
        )!;
        expect(chip.getAttribute("title")).toMatch(/first say/);
        expect(container.textContent).toContain("What the annotations mean");
    });

    it("says that the trading tools are off in a build made without them", () => {
        const {container, getByText} = render(<McpPage />);
        fireEvent.click(getByText("Tools"));
        expect(container.textContent).toContain(
            "Trading tools: off in this build. An assistant can only read."
        );
        expect(container.textContent).toContain("Off in this build");
    });

    it("starts on Connect and shows one section at a time", () => {
        const {container, getByText, queryByText} = render(<McpPage />);
        const sections = () =>
            Array.from(container.querySelectorAll("section")).map(s =>
                s.getAttribute("aria-label")
            );
        const tabs = Array.from(container.querySelectorAll('[role="tab"]')).map(
            b => b.textContent
        );
        expect(tabs).toEqual(["Connect", "Tools", "Safety"]);
        expect(
            container.querySelector('[role="tab"][aria-selected="true"]')!
                .textContent
        ).toBe("Connect");
        // the status is above the tabs and stays; one section under them
        expect(sections()).toEqual(["This build", "Connect an assistant"]);
        expect(container.querySelector("[data-tool]")).toBeNull();
        fireEvent.click(getByText("Tools"));
        expect(sections()).toEqual(["This build", "Tools"]);
        expect(
            container.querySelectorAll("[data-tool]").length
        ).toBeGreaterThan(10);
        fireEvent.click(getByText("Safety"));
        expect(sections()).toEqual(["This build", "Trading safely"]);
        expect(container.querySelector("[data-tool]")).toBeNull();
        expect(queryByText("Connect an assistant")).toBeNull();
        // the line about the docs is on every tab
        expect(container.textContent).toContain("docs/MCP.md");
        fireEvent.click(getByText("Connect"));
        expect(sections()).toEqual(["This build", "Connect an assistant"]);
    });

    it("has a tab for each client, opencode first", () => {
        const {container} = render(<McpPage />);
        const tabs = Array.from(
            container.querySelectorAll("button[aria-pressed]")
        ).map(b => b.textContent);
        expect(tabs).toEqual([
            "opencode",
            "Claude Code",
            "Desktop",
            "Codex",
            "HTTP"
        ]);
        expect(
            container.querySelector("button[aria-pressed=true]")!.textContent
        ).toBe("opencode");
    });

    it("shows how to connect each client, and copies the block", async () => {
        const writeText = jest.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "clipboard", {
            value: {writeText},
            configurable: true
        });
        Object.defineProperty(window, "isSecureContext", {
            value: true,
            configurable: true
        });
        const {container, getByText} = render(<McpPage />);
        const blocks = () =>
            Array.from(container.querySelectorAll("pre")).map(
                p => p.textContent || ""
            );

        // opencode: a server it starts itself
        const local = JSON.parse(blocks()[0]);
        expect(local.$schema).toBe("https://opencode.ai/config.json");
        expect(local.mcp.desk).toEqual({
            type: "local",
            command: ["node", "/path/to/bitshares-ui/mcp/server.js"],
            enabled: true,
            environment: {MCP_ENABLED: "true"}
        });
        expect(container.textContent).toContain("opencode mcp list");

        // Claude Code: one command
        fireEvent.click(getByText("Claude Code"));
        expect(blocks()).toEqual([
            "claude mcp add desk --env MCP_ENABLED=true -- node /path/to/bitshares-ui/mcp/server.js"
        ]);
        expect(container.textContent).toContain("claude mcp list");

        // Claude Desktop: the config file
        fireEvent.click(getByText("Desktop"));
        expect(JSON.parse(blocks()[0]).mcpServers.desk).toEqual({
            command: "node",
            args: ["/path/to/bitshares-ui/mcp/server.js"],
            env: {MCP_ENABLED: "true"}
        });

        // Codex: the command, and the same as TOML
        fireEvent.click(getByText("Codex"));
        const codex = blocks();
        expect(codex).toHaveLength(2);
        expect(codex[0]).toBe(
            "codex mcp add desk --env MCP_ENABLED=true -- node /path/to/bitshares-ui/mcp/server.js"
        );
        expect(codex[1]).toBe(
            [
                "[mcp_servers.desk]",
                'command = "node"',
                'args = ["/path/to/bitshares-ui/mcp/server.js"]',
                "",
                "[mcp_servers.desk.env]",
                'MCP_ENABLED = "true"'
            ].join("\n")
        );
        expect(container.textContent).toContain("codex mcp list");

        // HTTP: a token, the start, and an entry for each client
        fireEvent.click(getByText("HTTP"));
        const http = blocks();
        expect(http).toHaveLength(5);
        expect(http[0]).toContain("--new-token");
        expect(http[1]).toContain("MCP_TRANSPORT=http");
        expect(http[1]).toContain("MCP_AUTH_TOKEN=<the token>");
        expect(JSON.parse(http[2]).mcp.desk).toEqual({
            type: "remote",
            url: "http://127.0.0.1:8765/mcp",
            enabled: true,
            headers: {Authorization: "Bearer <the token>"}
        });
        expect(http[3]).toContain(
            "claude mcp add --transport http desk http://127.0.0.1:8765/mcp"
        );
        expect(http[4]).toContain("[mcp_servers.desk]");
        expect(http[4]).toContain('url = "http://127.0.0.1:8765/mcp"');
        expect(http[4]).toContain('bearer_token_env_var = "DESK_MCP_TOKEN"');
        // no real token on the page
        expect(http.join("\n")).not.toMatch(/[A-Za-z0-9_-]{32,}/);

        const buttons = container.querySelectorAll("button");
        await act(async () => {
            fireEvent.click(buttons[buttons.length - 1]);
        });
        expect(writeText).toHaveBeenCalled();
    });

    it("sets out how trading is kept safe, and what is not offered", () => {
        const {container, getByText} = render(<McpPage />);
        fireEvent.click(getByText("Safety"));
        const text = container.textContent || "";
        [
            "No keys, no signing",
            "Limits you set",
            "A price guard, twice",
            "A reference code to compare",
            "Your client asks first",
            "Text from the chain is data",
            "A closed door"
        ].forEach(title => expect(text).toContain(title));
        expect(text).toContain("Not offered on purpose");
        expect(text).toContain("What this does not protect against");
        expect(container.querySelectorAll("ol li").length).toBe(9);
    });

    it("does not list the server's settings (they are in the example file and docs/MCP.md)", () => {
        const {container} = render(<McpPage />);
        expect(container.textContent).not.toContain("MCP_AUTH_TOKEN");
        expect(container.textContent).not.toContain("MCP_TRADE_LIMITS");
        expect(container.querySelector("table")).toBeNull();
        expect(container.textContent).toContain("docs/MCP.md");
    });

    it("writes `code` in a description as code", () => {
        const {container, getByText} = render(<McpPage />);
        fireEvent.click(getByText("Tools"));
        const text = container.querySelector(
            '[data-tool="bitshares_prepare_limit_order"] p'
        )!;
        expect(text.querySelector("code")!.textContent).toBe("sell_amount");
        expect(text.textContent).not.toContain("`");
    });

    it("has every string on every tab, also in a language that has none of its own", () => {
        const c: any = counterpart;
        c.registerTranslations("de", {});
        c.setFallbackLocale("en");
        c.setLocale("de");
        try {
            const {container, getByText} = render(<McpPage />);
            const missing = () =>
                (container.textContent || "").match(
                    /missing translation[^ ]*/g
                );
            ["Connect", "Tools", "Safety"].forEach(tab => {
                fireEvent.click(getByText(tab));
                if (tab === "Connect") {
                    [
                        "opencode",
                        "Claude Code",
                        "Desktop",
                        "Codex",
                        "HTTP"
                    ].forEach(client => {
                        fireEvent.click(getByText(client));
                        expect(missing()).toBeNull();
                    });
                }
                expect(missing()).toBeNull();
            });
        } finally {
            c.setLocale("en");
        }
    });
});
