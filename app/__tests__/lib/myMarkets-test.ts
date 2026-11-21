import Immutable from "immutable";
import {
    isHiddenAsIlliquid,
    marketOfId,
    withOwnMarkets
} from "../../lib/common/myMarkets";

const pair = (quote: string, base: string) => ({quote, base});
const listed = Immutable.Map({
    USD_BTS: pair("USD", "BTS"),
    "XBTSX.USDT_BTS": pair("XBTSX.USDT", "BTS")
});

describe("marketOfId", () => {
    it("splits a market id into its assets", () => {
        expect(marketOfId("XBTSX.A_BTS")).toEqual(pair("XBTSX.A", "BTS"));
    });

    it("is null for what is not a market id", () => {
        ["", undefined, "BTS", "A_B_C", "_BTS", "BTS_"].forEach(id =>
            expect(marketOfId(id)).toBeNull()
        );
    });
});

describe("withOwnMarkets", () => {
    it("adds the market that is open, so a market you are looking at is in your list", () => {
        const all = withOwnMarkets(listed, undefined, "XBTSX.A_BTS");
        expect(all.get("XBTSX.A_BTS")).toEqual(pair("XBTSX.A", "BTS"));
        expect(all.size).toBe(3);
    });

    it("adds the starred markets", () => {
        const starred = Immutable.Map({XBTSX_A_X: pair("EUR", "BTS")});
        const all = withOwnMarkets(listed, starred);
        expect(all.get("XBTSX_A_X")).toEqual(pair("EUR", "BTS"));
    });

    it("keeps what the list has, and adds nothing twice", () => {
        const starred = Immutable.Map({USD_BTS: pair("USD", "BTS")});
        const all = withOwnMarkets(listed, starred, "USD_BTS");
        expect(all).toBe(listed);
    });

    it("leaves the list as it is when nothing is open and nothing starred", () => {
        expect(withOwnMarkets(listed, Immutable.Map(), undefined)).toBe(listed);
        expect(withOwnMarkets(listed, undefined, "not a market")).toBe(listed);
    });
});

describe("isHiddenAsIlliquid", () => {
    it("hides a market with no volume in 24 hours when only liquid markets are shown", () => {
        expect(isHiddenAsIlliquid(true, {volumeBase: 0}, "A_BTS")).toBe(true);
    });

    it("shows it when the option is off, when it traded, and when nothing is known of it yet", () => {
        expect(isHiddenAsIlliquid(false, {volumeBase: 0}, "A_BTS")).toBe(false);
        expect(isHiddenAsIlliquid(true, {volumeBase: 12.5}, "A_BTS")).toBe(
            false
        );
        expect(isHiddenAsIlliquid(true, undefined, "A_BTS")).toBe(false);
    });

    it("never hides the market that is open", () => {
        expect(
            isHiddenAsIlliquid(true, {volumeBase: 0}, "A_BTS", "A_BTS")
        ).toBe(false);
    });
});
