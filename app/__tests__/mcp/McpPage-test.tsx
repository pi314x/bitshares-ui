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
        const {container} = render(<McpPage />);
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
        const {container} = render(<McpPage />);
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
        const {container} = render(<McpPage />);
        expect(container.textContent).toContain(
            "Trading tools: off in this build. An assistant can only read."
        );
        expect(container.textContent).toContain("Off in this build");
    });

    it("shows how to connect, in three ways, with a copy button", async () => {
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
        expect(container.querySelector("pre")!.textContent).toContain(
            "claude mcp add bitshares --env MCP_ENABLED=true -- node"
        );
        fireEvent.click(getByText("Claude Desktop"));
        const json = JSON.parse(
            container.querySelector("pre")!.textContent || ""
        );
        expect(json.mcpServers.bitshares.command).toBe("node");
        expect(json.mcpServers.bitshares.env).toEqual({MCP_ENABLED: "true"});
        fireEvent.click(getByText("HTTP"));
        const http = container.querySelector("pre")!.textContent || "";
        expect(http).toContain("--new-token");
        expect(http).toContain("MCP_TRANSPORT=http");
        expect(http).toContain("Authorization: Bearer <the token>");
        // no real token on the page
        expect(http).not.toMatch(/[A-Za-z0-9_-]{32,}/);
        await act(async () => {
            fireEvent.click(getByText("Copy"));
        });
        expect(writeText).toHaveBeenCalledWith(http);
    });

    it("sets out how trading is kept safe, and what is not offered", () => {
        const {container} = render(<McpPage />);
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
        const {container} = render(<McpPage />);
        const text = container.querySelector(
            '[data-tool="bitshares_prepare_limit_order"] p'
        )!;
        expect(text.querySelector("code")!.textContent).toBe("sell_amount");
        expect(text.textContent).not.toContain("`");
    });
});
