// The left rail is the only way to reach most screens now that the old header
// menu is gone, so what it links to is pinned here: every entry must point at a
// route App.jsx really registers, and the Lending group (credit offers and
// SameT funds) must stay reachable.
import * as fs from "fs";
import * as path from "path";
import {NAV_GROUPS, crumbFromPath, withLastMarket} from "../../next/navigation";
import {isNavItemActive} from "../../design-system/Rail";

const app = fs.readFileSync(path.join(__dirname, "../../App.jsx"), "utf8");

describe("left navigation rail", () => {
    it("has a Lending group with Credit offers and SameT funds", () => {
        const lending = NAV_GROUPS.find(group => group.label === "Lending");
        expect(lending).toBeDefined();
        expect(lending!.items).toEqual([
            {label: "Credit offers", icon: "credit", to: "/credit-offer"},
            {label: "SameT funds", icon: "funds", to: "/samet-funds"}
        ]);
    });

    it("lists the features that nothing else links to", () => {
        const labels = (group: string) =>
            NAV_GROUPS.find(g => g.label === group)!.items.map(i => i.label);
        expect(labels("Account")).toContain("Voting");
        expect(labels("Markets")).toEqual(
            expect.arrayContaining(["Instant trade", "Prediction markets"])
        );
        // the old header's Spotlight hub: barter, HTLC, direct debit, ...
        expect(labels("More")).toEqual(["Spotlight", "Help"]);
    });

    it("keeps the explorer out of the markets group", () => {
        const markets = NAV_GROUPS.find(g => g.label === "Markets")!;
        expect(markets.items.map(i => i.label)).not.toContain("Explorer");
        const network = NAV_GROUPS.find(g => g.label === "Network")!;
        expect(network.items.map(i => i.label)).toEqual(["Explorer"]);
        expect(network.items[0].to).toBe("/explorer");
    });

    it("puts the liquidity pools right behind the order book trade entry", () => {
        const markets = NAV_GROUPS.find(g => g.label === "Markets")!;
        const labels = markets.items.map(i => i.label);
        expect(labels[0]).toBe("Trade");
        expect(labels[1]).toBe("Liquidity pools");
    });

    it("keeps moving money together: send, deposit, withdraw and timed transfer are pages", () => {
        const payments = NAV_GROUPS.find(g => g.label === "Payments")!;
        expect(payments.items.map(i => i.label)).toEqual([
            "Send",
            "Deposit",
            "Withdraw",
            "Timed transfer"
        ]);
        // pages, not popups: every entry goes somewhere
        expect(payments.items.map(i => i.to)).toEqual([
            "/send",
            "/deposit",
            "/withdraw",
            "/timed-transfer"
        ]);
        expect(payments.items.some(i => i.action)).toBe(false);
    });

    it("recognises the account voting tab as the Voting entry", () => {
        const voting = NAV_GROUPS.flatMap(g => g.items).find(
            i => i.label === "Voting"
        )!;
        expect(voting.match!.test("/voting")).toBe(true);
        expect(voting.match!.test("/account/abit/voting")).toBe(true);
        expect(voting.match!.test("/account/abit/voting/witnesses")).toBe(true);
        expect(voting.match!.test("/account/abit/overview")).toBe(false);
        expect(voting.match!.test("/account/voting-bot/overview")).toBe(false);
    });

    it("only links to routes App.jsx registers", () => {
        NAV_GROUPS.forEach(group =>
            group.items.forEach(item => {
                // an action (Send, Deposit, Withdraw) opens a dialog: no route
                if (!item.to) return;
                // /market/<pair> is registered as /market/:marketID
                const route = item.to.startsWith("/market/")
                    ? "/market/:marketID"
                    : item.to;
                expect(app).toContain(`path="${route}"`);
            })
        );
    });

    it("has no duplicate targets", () => {
        const targets = NAV_GROUPS.flatMap(group =>
            group.items.map(i => i.to || `action:${i.action}`)
        );
        expect(new Set(targets).size).toBe(targets.length);
    });
});

describe("topbar title", () => {
    it("reads naturally for the lending screens", () => {
        expect(crumbFromPath("/credit-offer")).toBe("Credit offers");
        expect(crumbFromPath("/samet-funds")).toBe("SameT funds");
    });

    it("names the restored entries", () => {
        expect(crumbFromPath("/instant-trade")).toBe("Instant trade");
        expect(crumbFromPath("/instant-trade/BTS_USD")).toBe("Instant trade");
        expect(crumbFromPath("/prediction")).toBe("Prediction markets");
        expect(crumbFromPath("/spotlight")).toBe("Spotlight");
        expect(crumbFromPath("/voting")).toBe("Voting");
    });

    it("names the payment pages", () => {
        expect(crumbFromPath("/send")).toBe("Send");
        expect(crumbFromPath("/deposit")).toBe("Deposit");
        expect(crumbFromPath("/withdraw")).toBe("Withdraw");
    });

    it("spells out the hyphenated and abbreviated screens", () => {
        expect(crumbFromPath("/create-worker")).toBe("Create worker");
        expect(crumbFromPath("/deposit-withdraw")).toBe("Deposit & withdraw");
        expect(crumbFromPath("/direct-debit")).toBe("Direct debit");
        expect(crumbFromPath("/htlc")).toBe("HTLC");
    });

    it("keeps the capitalized-segment fallback", () => {
        expect(crumbFromPath("/")).toBe("Dashboard");
        expect(crumbFromPath("/market/BTS_USD")).toBe("Market");
        expect(crumbFromPath("/settings/general")).toBe("Settings");
    });
});

describe("rail icons", () => {
    it("every entry has an icon the rail can draw", () => {
        const source = fs.readFileSync(
            path.join(__dirname, "../../design-system/RailIcon.tsx"),
            "utf8"
        );
        NAV_GROUPS.forEach(group =>
            group.items.forEach(item => {
                expect(item.icon).toBeTruthy();
                expect(source).toContain(`    ${item.icon}:`);
            })
        );
    });
});

describe("crumbs of an account's pages", () => {
    it("names the page, not just 'Account'", () => {
        expect(crumbFromPath("/account/alice/vesting")).toBe("Vesting");
        expect(crumbFromPath("/account/alice/signedmessages")).toBe(
            "Signed messages"
        );
        expect(crumbFromPath("/account/alice")).toBe("Portfolio");
        expect(crumbFromPath("/account/alice/overview")).toBe("Portfolio");
        expect(crumbFromPath("/portfolio")).toBe("Portfolio");
    });
});

describe("every page has one entry in the menu", () => {
    const items = NAV_GROUPS.reduce<any[]>((all, g) => all.concat(g.items), []);
    const activeLabels = (pathname: string) =>
        items.filter(i => isNavItemActive(i, pathname)).map(i => i.label);

    // the routes App.jsx registers, with their parameters filled in
    const routes = Array.from(
        new Set(Array.from(app.matchAll(/path="([^"]+)"/g)).map(m => m[1]))
    )
        .filter(p => p.startsWith("/"))
        .map(p => p.replace(/\/\*$/, "").replace(/:[A-Za-z_]+/g, "x"));

    it("finds the routes of the app", () => {
        expect(routes.length).toBeGreaterThan(20);
        expect(routes).toContain("/market/x");
    });

    routes.forEach(route => {
        it(`${route} highlights exactly one entry`, () => {
            expect(activeLabels(route)).toHaveLength(1);
        });
    });

    it("the account's pages belong to the portfolio, its voting to Voting", () => {
        expect(activeLabels("/account/alice")).toEqual(["Portfolio"]);
        expect(activeLabels("/account/alice/vesting")).toEqual(["Portfolio"]);
        expect(activeLabels("/account/alice/voting/witnesses")).toEqual([
            "Voting"
        ]);
        expect(activeLabels("/market/EUR_BTS")).toEqual(["Trade"]);
        expect(activeLabels("/asset/EUR")).toEqual(["Explorer"]);
        expect(activeLabels("/htlc")).toEqual(["Spotlight"]);
    });
});

describe("withLastMarket", () => {
    const tradeOf = (groups: typeof NAV_GROUPS) =>
        groups
            .reduce((all: any[], g) => all.concat(g.items), [])
            .find(item => item.label === "Trade").to;

    it("points Trade at the market the user traded last", () => {
        expect(tradeOf(withLastMarket(NAV_GROUPS, "USD_BTS"))).toBe(
            "/market/USD_BTS"
        );
    });

    it("keeps the default market without a (valid) last market", () => {
        const base = tradeOf(NAV_GROUPS);
        [undefined, null, "", "BTS", "a/b_c", 5].forEach(value =>
            expect(tradeOf(withLastMarket(NAV_GROUPS, value))).toBe(base)
        );
    });

    it("leaves every other entry alone", () => {
        const groups = withLastMarket(NAV_GROUPS, "USD_BTS");
        const others = (g: typeof NAV_GROUPS) =>
            g
                .reduce((all: any[], x) => all.concat(x.items), [])
                .filter(item => item.label !== "Trade")
                .map(item => item.to);
        expect(others(groups)).toEqual(others(NAV_GROUPS));
    });
});
