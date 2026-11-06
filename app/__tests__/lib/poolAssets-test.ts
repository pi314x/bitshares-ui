import {buildPoolAssets, sortSymbols} from "../../lib/chain/poolAssets";

const symbols = {
    "1.3.0": "BTS",
    "1.3.5": "xbtsx.USDT",
    "1.3.6": "CNY",
    "1.3.7": "ABIT",
    "1.3.100": "LP.ONE",
    "1.3.101": "LP.TWO",
    "1.3.102": "LP.THREE"
};

describe("buildPoolAssets", () => {
    const pools = [
        {asset_a: "1.3.0", asset_b: "1.3.5", share_asset: "1.3.100"},
        {asset_a: "1.3.0", asset_b: "1.3.6", share_asset: "1.3.101"},
        {asset_a: "1.3.6", asset_b: "1.3.7", share_asset: "1.3.102"}
    ];

    it("lists each asset that is in a pool once, BTS first and the rest A-Z ignoring case", () => {
        const found = buildPoolAssets(pools, symbols);
        expect(found.assets).toEqual(["BTS", "ABIT", "CNY", "xbtsx.USDT"]);
    });

    it("says which assets each is paired with, in both directions", () => {
        const found = buildPoolAssets(pools, symbols);
        expect(found.partners["BTS"]).toEqual(["CNY", "xbtsx.USDT"]);
        expect(found.partners["CNY"]).toEqual(["BTS", "ABIT"]);
        expect(found.partners["ABIT"]).toEqual(["CNY"]);
        expect(found.partners["xbtsx.USDT"]).toEqual(["BTS"]);
    });

    it("lists the share assets", () => {
        expect(buildPoolAssets(pools, symbols).shares).toEqual([
            "LP.ONE",
            "LP.THREE",
            "LP.TWO"
        ]);
    });

    it("leaves out what it cannot name, and copes with no pools", () => {
        const found = buildPoolAssets(
            [{asset_a: "1.3.0", asset_b: "1.3.999", share_asset: "1.3.100"}],
            symbols
        );
        expect(found.assets).toEqual(["BTS"]);
        expect(found.partners).toEqual({});
        expect(buildPoolAssets([], symbols)).toEqual({
            assets: [],
            partners: {},
            shares: []
        });
    });
});

describe("sortSymbols", () => {
    it("puts the core asset first when there is one", () => {
        expect(sortSymbols(["b", "BTS", "A"], "BTS")).toEqual([
            "BTS",
            "A",
            "b"
        ]);
        expect(sortSymbols(["b", "BTS", "A"], null)).toEqual(["A", "b", "BTS"]);
    });
});
