// The left rail is the only way to reach most screens now that the old header
// menu is gone, so what it links to is pinned here: every entry must point at a
// route App.jsx really registers, and the Lending group (credit offers and
// SameT funds) must stay reachable.
import * as fs from "fs";
import * as path from "path";
import {NAV_GROUPS, crumbFromPath} from "../../next/navigation";

const app = fs.readFileSync(path.join(__dirname, "../../App.jsx"), "utf8");

describe("left navigation rail", () => {
    it("has a Lending group with Credit offers and SameT funds", () => {
        const lending = NAV_GROUPS.find(group => group.label === "Lending");
        expect(lending).toBeDefined();
        expect(lending!.items).toEqual([
            {label: "Credit offers", to: "/credit-offer"},
            {label: "SameT funds", to: "/samet-funds"}
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
        expect(labels("More")).toEqual(["Spotlight"]);
    });

    it("keeps the explorer out of the markets group", () => {
        const markets = NAV_GROUPS.find(g => g.label === "Markets")!;
        expect(markets.items.map(i => i.label)).not.toContain("Explorer");
        const network = NAV_GROUPS.find(g => g.label === "Network")!;
        expect(network.items).toEqual([{label: "Explorer", to: "/explorer"}]);
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
