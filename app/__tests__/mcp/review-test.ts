/** @jest-environment node */
import {encodeProposal} from "../../../mcp/src/proposal";
import {CHAIN, NOW, makeProposal, sha256Hex} from "../utils/mcpProposal";
import {
    MAX_DEVIATION_PERCENT,
    assessPrice,
    computedReference,
    decode,
    lookupProblems,
    minutesLeft,
    problems,
    readPayload
} from "../../lib/common/mcpReview";
import {withMcp, NAV_GROUPS, crumbFromPath} from "../../next/navigation";
import {mcpEnabled, mcpTrading} from "../../lib/common/mcpFlags";
import {SETTINGS} from "../../../mcp/src/settings";
import {readConfig} from "../../../mcp/src/env";
import * as fs from "fs";
import * as path from "path";

const ASSETS = {
    "1.3.0": {symbol: "BTS", precision: 5},
    "1.3.121": {symbol: "USD", precision: 4}
};

describe("reading the link", () => {
    it("takes the document after p= in the fragment or in the query", () => {
        expect(readPayload("https://desk.example/mcp/review#p=abc_-123")).toBe(
            "abc_-123"
        );
        expect(
            readPayload("https://desk.example/#/mcp/review?p=abc_-123")
        ).toBe("abc_-123");
        expect(readPayload("https://desk.example/mcp/review#x=1&p=abc")).toBe(
            "abc"
        );
        expect(readPayload("https://desk.example/mcp/review")).toBeNull();
        expect(
            readPayload("https://desk.example/mcp/review#p=<script>")
        ).toBeNull();
    });

    it("decodes what the server wrote, and says why it cannot", () => {
        const text = encodeProposal(makeProposal());
        expect(decode(text).ok).toBe(true);
        expect((decode(null) as any).error).toBe("empty");
        expect((decode("%%") as any).error).toBe("not_encoded");
    });
});

describe("what blocks signing", () => {
    const ctx = (over?: any) => ({
        now: NOW,
        chainId: CHAIN,
        accountId: "1.2.100",
        sha256Hex,
        ...(over || {})
    });

    it("nothing, for a fresh proposal for the signed-in account on this chain", () => {
        expect(problems(makeProposal(), ctx())).toEqual([]);
    });

    it("a reference that is not the operations' own: the link was changed", () => {
        const p = makeProposal();
        p.ops[0][1].min_to_receive.amount = "1"; // the reference stays the old one
        expect(problems(p, ctx())).toContain("reference");
        expect(computedReference(p, sha256Hex)).not.toBe(p.ref);
    });

    it("expiry, in either direction", () => {
        expect(
            problems(
                makeProposal(),
                ctx({now: Date.parse("2026-10-20T21:42:00Z")})
            )
        ).toEqual(["expired"]);
        expect(
            problems(
                makeProposal(),
                ctx({now: Date.parse("2026-10-20T21:20:00Z")})
            )
        ).toEqual(["expired"]);
        expect(minutesLeft(makeProposal(), NOW)).toBe(6);
        expect(
            minutesLeft(makeProposal(), Date.parse("2027-01-01T00:00:00Z"))
        ).toBe(0);
    });

    it("another chain, no connection yet, another account, nobody signed in", () => {
        expect(
            problems(makeProposal(), ctx({chainId: "f".repeat(64)}))
        ).toEqual(["chain"]);
        expect(problems(makeProposal(), ctx({chainId: null}))).toEqual([
            "chain"
        ]);
        expect(problems(makeProposal(), ctx({accountId: "1.2.7"}))).toEqual([
            "account"
        ]);
        expect(problems(makeProposal(), ctx({accountId: null}))).toEqual([
            "account"
        ]);
    });

    it("an asset the chain does not know, an order that is gone or somebody else's", () => {
        expect(
            lookupProblems(
                makeProposal(),
                {"1.3.0": ASSETS["1.3.0"]},
                undefined
            )
        ).toEqual(["asset_unknown"]);
        expect(lookupProblems(makeProposal(), ASSETS, undefined)).toEqual([]);
        const cancel = makeProposal({
            ops: [
                [
                    2,
                    {
                        fee: {amount: "0", asset_id: "1.3.0"},
                        fee_paying_account: "1.2.100",
                        order: "1.7.500",
                        extensions: []
                    }
                ]
            ]
        });
        expect(lookupProblems(cancel, {}, null)).toEqual(["order_missing"]);
        expect(lookupProblems(cancel, {}, {seller: "1.2.9"})).toEqual([
            "order_not_yours"
        ]);
        expect(lookupProblems(cancel, {}, {seller: "1.2.100"})).toEqual([]);
        // not looked up yet: nothing is said
        expect(lookupProblems(cancel, {}, undefined)).toEqual([]);
    });
});

describe("the price against the market", () => {
    // 100 BTS for 0.1205 USD is 829.88 BTS per USD
    it("is fine at the market's price or better, and says how far", () => {
        const ok: any = assessPrice(makeProposal(), ASSETS, {
            latest: "830",
            lowest_ask: "840",
            highest_bid: "828"
        });
        expect(ok.kind).toBe("ok");
        expect(ok.market).toBe(834);
        expect(ok.percent).toBeLessThan(0);
        expect(
            assessPrice(makeProposal(), ASSETS, {
                latest: "700",
                lowest_ask: "0",
                highest_bid: "0"
            }).kind
        ).toBe("worse");
    });

    it("is worse above the limit: the page's own limit, not the document's", () => {
        const p = makeProposal();
        p.ops[0][1].min_to_receive.amount = "1000"; // 1000 BTS per USD, 20% above
        const out: any = assessPrice(p, ASSETS, {
            latest: "830",
            lowest_ask: "840",
            highest_bid: "828"
        });
        expect(out.kind).toBe("worse");
        expect(out.percent).toBeGreaterThan(MAX_DEVIATION_PERCENT);
        // just inside the limit passes
        const near = makeProposal();
        near.ops[0][1].min_to_receive.amount = "1170"; // 854.7, +2.5%
        expect(
            assessPrice(near, ASSETS, {
                latest: "830",
                lowest_ask: "840",
                highest_bid: "828"
            }).kind
        ).toBe("ok");
    });

    it("says so when the market has no price, and nothing for a cancellation", () => {
        expect(
            assessPrice(makeProposal(), ASSETS, {
                latest: "0",
                lowest_ask: "0",
                highest_bid: "0"
            }).kind
        ).toBe("unpriced");
        expect(assessPrice(makeProposal(), ASSETS, null).kind).toBe("unpriced");
        const cancel = makeProposal({
            ops: [
                [
                    2,
                    {
                        fee: {amount: "0", asset_id: "1.3.0"},
                        fee_paying_account: "1.2.100",
                        order: "1.7.500",
                        extensions: []
                    }
                ]
            ]
        });
        expect(assessPrice(cancel, ASSETS, null).kind).toBe("none");
        expect(assessPrice(makeProposal(), {}, {latest: "830"}).kind).toBe(
            "none"
        );
    });
});

describe("the menu and the flags", () => {
    it("has no MCP entry unless the build has the page", () => {
        expect(withMcp(NAV_GROUPS, false)).toBe(NAV_GROUPS);
        const more = withMcp(NAV_GROUPS, true).find(g => g.label === "More")!;
        expect(more.items.map(i => i.label)).toEqual([
            "Spotlight",
            "Advanced",
            "AI assistants",
            "Settings",
            "Help"
        ]);
        const entry = more.items.find(i => i.to === "/mcp")!;
        expect(entry.match!.test("/mcp")).toBe(true);
        expect(entry.match!.test("/mcp/review")).toBe(true);
        expect(entry.match!.test("/mcpx")).toBe(false);
        // the other groups are as they were
        expect(
            withMcp(NAV_GROUPS, true).filter(g => g.label !== "More")
        ).toEqual(NAV_GROUPS.filter(g => g.label !== "More"));
        expect(crumbFromPath("/mcp/review")).toBe("AI assistants");
    });

    it("the route of the entry is in App.jsx, behind the flag", () => {
        const app = fs.readFileSync(
            path.join(__dirname, "../../App.jsx"),
            "utf8"
        );
        expect(app).toMatch(/mcpEnabled\(\) \? \(\s*<Route\s+path="\/mcp"/);
        expect(app).toMatch(
            /mcpTrading\(\) \? \(\s*<Route\s+path="\/mcp\/review"/
        );
    });

    it("is off in the test build, and trading needs the page", () => {
        expect(mcpEnabled()).toBe(false);
        expect(mcpTrading()).toBe(false);
    });
});

describe("the settings table", () => {
    const example = fs.readFileSync(
        path.join(__dirname, "../../../.env.example"),
        "utf8"
    );

    it("lists every setting the example file and the server know, each once", () => {
        const names = SETTINGS.map((s: any) => s.name);
        expect(new Set(names).size).toBe(names.length);
        const inExample = (
            example.match(/^[A-Z][A-Z0-9_]*(?==)/gm) || []
        ).sort();
        expect(inExample).toEqual(names.slice().sort());
        // and the source of the server reads each of them
        const source = ["env.js"]
            .map(f =>
                fs.readFileSync(
                    path.join(__dirname, "../../../mcp/src", f),
                    "utf8"
                )
            )
            .join("\n");
        names.forEach((name: string) => expect(source).toContain(name));
    });

    it("gives the defaults the server really has", () => {
        const defaults: Record<string, string> = {};
        SETTINGS.forEach((s: any) => (defaults[s.name] = s.default));
        const c = readConfig({});
        expect(String(c.enabled)).toBe(defaults.MCP_ENABLED);
        expect(c.transport).toBe(defaults.MCP_TRANSPORT);
        expect(c.http.host).toBe(defaults.MCP_HTTP_HOST);
        expect(String(c.http.port)).toBe(defaults.MCP_HTTP_PORT);
        expect(c.nodes[0]).toBe(defaults.MCP_NODES);
        expect(c.appUrl).toBe(defaults.MCP_APP_URL);
        expect(String(c.appHashRouter)).toBe(defaults.MCP_APP_HASH_ROUTER);
        expect(String(c.trading.enabled)).toBe(defaults.MCP_TRADING_ENABLED);
        expect(String(c.trading.maxDeviationPercent)).toBe(
            defaults.MCP_MAX_PRICE_DEVIATION_PERCENT
        );
        expect(String(c.trading.proposalTtlMinutes)).toBe(
            defaults.MCP_PROPOSAL_TTL_MINUTES
        );
        expect(String(c.trading.maxExpirationHours)).toBe(
            defaults.MCP_MAX_ORDER_EXPIRATION_HOURS
        );
        expect(String(c.trading.preparePerHour)).toBe(
            defaults.MCP_PREPARE_PER_HOUR
        );
        expect(String(c.trading.allowUnpriced)).toBe(
            defaults.MCP_ALLOW_UNPRICED_MARKETS
        );
    });

    it("the example file is a safe start: it turns everything off and puts no secret in", () => {
        const values: Record<string, string> = {};
        example.split("\n").forEach(line => {
            const m = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);
            if (m) values[m[1]] = m[2];
        });
        expect(values.MCP_ENABLED).toBe("false");
        expect(values.MCP_TRADING_ENABLED).toBe("false");
        expect(values.MCP_AUTH_TOKEN).toBe("");
        // the file as it is must pass the server's own checks
        expect(() => readConfig(values)).not.toThrow();
    });
});

describe("what the application's bundle imports from mcp/", () => {
    // the review and the MCP page import these files: the build for the browser cannot
    // resolve a Node module (fs, crypto, http ...), so they may require only each other
    const BROWSER_SAFE = [
        "catalog.js",
        "settings.js",
        "format.js",
        "policy.js",
        "proposal.js"
    ];
    BROWSER_SAFE.forEach(file => {
        it(`${file} requires nothing but its siblings`, () => {
            const source = fs.readFileSync(
                path.join(__dirname, "../../../mcp/src", file),
                "utf8"
            );
            const required = (
                source.match(/require\(["'][^"']+["']\)/g) || []
            ).map(r => r.slice(9, -2));
            required.forEach(name =>
                expect(name).toMatch(
                    /^\.\/(format|policy|proposal|catalog|settings)$/
                )
            );
        });
    });

    it("the app's own imports of mcp/ are only those files", () => {
        const walk = (dir: string): string[] =>
            fs.readdirSync(dir).reduce((all: string[], name) => {
                const full = path.join(dir, name);
                if (name === "__tests__" || name === "node_modules") return all;
                return fs.statSync(full).isDirectory()
                    ? all.concat(walk(full))
                    : all.concat(/\.(tsx?|jsx?)$/.test(name) ? [full] : []);
            }, []);
        const imported = new Set<string>();
        walk(path.join(__dirname, "../..")).forEach(file => {
            (
                fs
                    .readFileSync(file, "utf8")
                    .match(/from "(?:\.\.\/)+mcp\/src\/([a-z]+)"/g) || []
            ).forEach(m =>
                imported.add(m.replace(/.*src\//, "").replace('"', ""))
            );
        });
        Array.from(imported).forEach(name =>
            expect(BROWSER_SAFE).toContain(name + ".js")
        );
        expect(imported.size).toBeGreaterThan(2);
    });
});
