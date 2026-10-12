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

    it("only links to routes App.jsx registers", () => {
        NAV_GROUPS.forEach(group =>
            group.items.forEach(item => {
                // /market/<pair> is registered as /market/:marketID
                const route = item.to.startsWith("/market/")
                    ? "/market/:marketID"
                    : item.to;
                expect(app).toContain(`path="${route}"`);
            })
        );
    });

    it("has no duplicate targets", () => {
        const targets = NAV_GROUPS.flatMap(group => group.items.map(i => i.to));
        expect(new Set(targets).size).toBe(targets.length);
    });
});

describe("topbar title", () => {
    it("reads naturally for the lending screens", () => {
        expect(crumbFromPath("/credit-offer")).toBe("Credit offers");
        expect(crumbFromPath("/samet-funds")).toBe("SameT funds");
    });

    it("keeps the capitalized-segment fallback", () => {
        expect(crumbFromPath("/")).toBe("Dashboard");
        expect(crumbFromPath("/market/BTS_USD")).toBe("Market");
        expect(crumbFromPath("/settings/general")).toBe("Settings");
    });
});
