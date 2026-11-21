import {
    MAX_RECENT_PICKS,
    addRecentPick,
    getRecentPicks,
    reloadRecentPicks,
    removeRecentPick
} from "../../lib/common/recentMarketPicks";

const KEY = "__graphene__recentMarketPicks";

beforeEach(() => {
    window.localStorage.clear();
    reloadRecentPicks();
});

const symbols = () => getRecentPicks().map(p => p.symbol);

describe("the assets picked last in the market picker", () => {
    it("keeps the newest first", () => {
        addRecentPick("USD", "a");
        addRecentPick("CNY", "b");
        expect(getRecentPicks()).toEqual([
            {symbol: "CNY", issuer: "b"},
            {symbol: "USD", issuer: "a"}
        ]);
    });

    it("keeps only the last five", () => {
        expect(MAX_RECENT_PICKS).toBe(5);
        ["AAA", "BBB", "CCC", "DDD", "EEE", "FFF", "GGG"].forEach(s =>
            addRecentPick(s)
        );
        expect(symbols()).toEqual(["GGG", "FFF", "EEE", "DDD", "CCC"]);
    });

    it("moves an asset that is picked again to the front, once, with the owner it has now", () => {
        addRecentPick("USD", "old");
        addRecentPick("CNY");
        addRecentPick("EUR");
        addRecentPick("USD", "new");
        expect(getRecentPicks()).toEqual([
            {symbol: "USD", issuer: "new"},
            {symbol: "EUR", issuer: ""},
            {symbol: "CNY", issuer: ""}
        ]);
    });

    it("takes one out, and ignores one that is not there", () => {
        addRecentPick("USD");
        addRecentPick("CNY");
        removeRecentPick("EUR");
        expect(symbols()).toEqual(["CNY", "USD"]);
        removeRecentPick("CNY");
        expect(symbols()).toEqual(["USD"]);
    });

    it("is kept in the browser, and read back", () => {
        addRecentPick("USD", "committee-account");
        addRecentPick("CNY");
        expect(JSON.parse(window.localStorage.getItem(KEY) as string)).toEqual([
            {symbol: "CNY", issuer: ""},
            {symbol: "USD", issuer: "committee-account"}
        ]);
        removeRecentPick("CNY");
        reloadRecentPicks();
        expect(symbols()).toEqual(["USD"]);
    });

    it("takes a symbol in any case, and nothing that is not an asset symbol", () => {
        addRecentPick(" usd ");
        addRecentPick("not a symbol!");
        addRecentPick("");
        addRecentPick("A");
        expect(symbols()).toEqual(["USD"]);
    });

    it("reads back only what is valid: no duplicates, no junk, at most five", () => {
        window.localStorage.setItem(
            KEY,
            JSON.stringify([
                {symbol: "USD", issuer: "x"},
                {symbol: "usd", issuer: "y"},
                {symbol: 5},
                null,
                "CNY",
                {symbol: "bad symbol"},
                {symbol: "CNY"},
                {symbol: "EUR"},
                {symbol: "GBP"},
                {symbol: "JPY"},
                {symbol: "RUB"}
            ])
        );
        reloadRecentPicks();
        expect(symbols()).toEqual(["USD", "CNY", "EUR", "GBP", "JPY"]);
        expect(getRecentPicks()[0].issuer).toBe("x");
    });

    it("starts empty when what is stored is not a list or not JSON", () => {
        window.localStorage.setItem(KEY, "{not json");
        reloadRecentPicks();
        expect(symbols()).toEqual([]);
        window.localStorage.setItem(KEY, JSON.stringify({symbol: "USD"}));
        reloadRecentPicks();
        expect(symbols()).toEqual([]);
    });

    it("works when the browser does not keep it: the list stays for this visit", () => {
        const spy = jest
            .spyOn(Storage.prototype, "setItem")
            .mockImplementation(() => {
                throw new Error("quota");
            });
        addRecentPick("USD");
        expect(symbols()).toEqual(["USD"]);
        spy.mockRestore();
    });
});
