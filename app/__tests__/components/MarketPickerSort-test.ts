// The order of what the market picker's "Find by asset" box finds: the symbol that was typed first (also when it is
// typed with its gateway, "XBTSX.USDT"), then the symbols that start with the text, then those that only contain it,
// each A to Z. It was the other way round: the asset after the gateway's dot was set against the whole text (it never
// equals "XBTSX.USDT"), and the rest was Z to A, so the symbol itself was listed last.
import Immutable from "immutable";

jest.mock("bitsharesjs", () => ({
    ...jest.requireActual("bitsharesjs"),
    ChainStore: {getObject: () => undefined}
}));

import {
    assetFilter,
    sortMarketsList
} from "../../components/Exchange/MarketPickerHelpers";

const market = (quote: string, issuerId = "1.2.9") =>
    [`${quote}_BTS`, {quote, base: "BTS", issuerId}] as [string, any];
const order = (list: Array<[string, any]>) => list.map(([, m]) => m.quote);

// what the screenshot showed (as the sort used to leave it, Z to A with the symbol last)
const USDT_POOLS = [
    "XBTSX.USDTPPCLPxbtsio",
    "XBTSX.USDTPEPLPxbtsio",
    "XBTSX.USDTETCLPxbtsio",
    "XBTSX.USDTEMCLPxbtsio",
    "XBTSX.USDTBUSDLPxbtsio",
    "XBTSX.USDTBNBLPxbtsio",
    "XBTSX.USDT"
];
const USDT_SORTED = [
    "XBTSX.USDT",
    "XBTSX.USDTBNBLPxbtsio",
    "XBTSX.USDTBUSDLPxbtsio",
    "XBTSX.USDTEMCLPxbtsio",
    "XBTSX.USDTETCLPxbtsio",
    "XBTSX.USDTPEPLPxbtsio",
    "XBTSX.USDTPPCLPxbtsio"
];

describe("market picker: the order of a search", () => {
    it("lists the symbol that was typed with its gateway first, the rest A to Z", () => {
        const list = USDT_POOLS.map(q => market(q));
        expect(order(sortMarketsList(list, "XBTSX.USDT"))).toEqual(USDT_SORTED);
    });

    it("does not depend on the order the node gave them in", () => {
        const shuffled = [
            USDT_SORTED[3],
            USDT_SORTED[0],
            USDT_SORTED[6],
            USDT_SORTED[2],
            USDT_SORTED[5],
            USDT_SORTED[1],
            USDT_SORTED[4]
        ].map(q => market(q));
        expect(order(sortMarketsList(shuffled, "XBTSX.USDT"))).toEqual(
            USDT_SORTED
        );
    });

    it("puts the exact symbol, then the symbols that start with the text, then those that contain it", () => {
        const list = [
            market("XBTSX.EUSDT"),
            market("OTHER.USDTPOOL"),
            market("XBTSX.USDTPOOL"),
            market("OTHER.USDT"),
            market("XBTSX.USDT"),
            market("OTHER.AUSDT")
        ];
        expect(order(sortMarketsList(list, "USDT"))).toEqual([
            // the asset is "USDT" (of one asset name the known gateway comes first)
            "XBTSX.USDT",
            "OTHER.USDT",
            // an asset that starts with it
            "XBTSX.USDTPOOL",
            "OTHER.USDTPOOL",
            // an asset that only contains it
            "OTHER.AUSDT",
            "XBTSX.EUSDT"
        ]);
    });

    it("takes a symbol typed in lower case, and lists the one issued by the committee first, then the known gateways", () => {
        const list = [
            market("GDEX.BTC"),
            market("BTC", "1.2.0"),
            market("XBTSX.BTC"),
            market("OTHER.BTC")
        ];
        const sorted = order(sortMarketsList(list, "btc"));
        expect(sorted[0]).toBe("BTC");
        // the known gateways before an unknown one
        expect(sorted.indexOf("OTHER.BTC")).toBe(3);
        expect(sorted.slice(1, 3).sort()).toEqual(["GDEX.BTC", "XBTSX.BTC"]);
    });

    it("lists the exact symbol before a symbol that only starts with the text, even where A to Z would not", () => {
        // "USDT.A" starts with the text but its asset ("A") would sort before "USDT"
        const list = [market("USDT.A"), market("XBTSX.USDT")];
        expect(order(sortMarketsList(list, "USDT"))).toEqual([
            "XBTSX.USDT",
            "USDT.A"
        ]);
        expect(order(sortMarketsList(list.slice().reverse(), "USDT"))).toEqual([
            "XBTSX.USDT",
            "USDT.A"
        ]);
        // typed with the gateway: the whole symbol is the exact one
        const other = [market("XBTSX.USDT.A"), market("XBTSX.USDT")];
        expect(order(sortMarketsList(other, "XBTSX.USDT"))[0]).toBe(
            "XBTSX.USDT"
        );
    });

    it("reads text typed in lower case like the same text in upper case", () => {
        // "AUSDT" sorts before "USDT" A to Z, but only contains the text
        const list = [market("XBTSX.AUSDT"), market("XBTSX.USDT")];
        expect(order(sortMarketsList(list, "usdt"))).toEqual([
            "XBTSX.USDT",
            "XBTSX.AUSDT"
        ]);
        expect(order(sortMarketsList(list, "xbtsx.usdt"))).toEqual([
            "XBTSX.USDT",
            "XBTSX.AUSDT"
        ]);
    });

    it("matches the typed symbol whatever the case of the symbol itself (some end in lower case, like ...xbtsio)", () => {
        // upper-case letters sort before lower-case ones: without the match "...LPA" would come first
        const list = [
            market("XBTSX.USDTBNBLPA"),
            market("XBTSX.USDTBNBLPxbtsio")
        ];
        expect(order(sortMarketsList(list, "XBTSX.USDTBNBLPXBTSIO"))).toEqual([
            "XBTSX.USDTBNBLPxbtsio",
            "XBTSX.USDTBNBLPA"
        ]);
    });

    it("keeps the old reading of a typed BIT prefix (BITUSD looks for USD)", () => {
        const list = [market("USDX"), market("USD"), market("AUSD")];
        expect(order(sortMarketsList(list, "BITUSD"))).toEqual([
            "USD",
            "USDX",
            "AUSD"
        ]);
    });

    it("gives the same order through the search itself (assetFilter), without the symbol that is the market's own", () => {
        const found = Immutable.List(
            USDT_POOLS.map(symbol => ({
                symbol,
                issuer: "1.2.9",
                options: {description: ""}
            }))
        );
        const asset = (symbol: string) => ({get: () => symbol});
        let result: Array<[string, any]> = [];
        assetFilter(
            {
                searchAssets: found,
                marketPickerAsset: "BTS",
                baseAsset: asset("BTS"),
                quoteAsset: asset("BTS")
            },
            {inputValue: "XBTSX.USDT", lookupQuote: "XBTSX.USDT"},
            () => undefined,
            (list: any) => {
                result = list;
            }
        );
        expect(order(result)).toEqual(USDT_SORTED);
    });
});
