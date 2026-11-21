import {
    historySequence,
    newestSequence,
    formatAssetAmount
} from "../../lib/common/fills";

const fill = (n: number, account = "1.2.10") => ({
    id: `1.11.${n}`,
    op: [
        4,
        {
            account_id: account,
            pays: {amount: 100, asset_id: "1.3.0"},
            receives: {amount: 5, asset_id: "1.3.1"}
        }
    ] as [number, any]
});
const transfer = (n: number) => ({
    id: `1.11.${n}`,
    op: [0, {from: "1.2.10"}] as [number, any]
});

describe("fills", () => {
    it("reads the sequence of an operation id", () => {
        expect(historySequence("1.11.42")).toBe(42);
        expect(historySequence("2.0.0")).toBe(-1);
        expect(newestSequence([fill(5), transfer(9), fill(7)])).toBe(9);
        expect(newestSequence([])).toBe(-1);
    });
});

describe("formatAssetAmount", () => {
    it("writes the amount at the asset's precision with its symbol", () => {
        expect(
            formatAssetAmount(
                {amount: "4962021536", asset_id: "1.3.0"},
                {symbol: "BTS", precision: 5},
                "en-US"
            )
        ).toBe("49,620.21536 BTS");
        expect(
            formatAssetAmount(
                {amount: "545967", asset_id: "1.3.120"},
                {symbol: "XBTSX.USDT", precision: 5},
                "en-US"
            )
        ).toBe("5.45967 XBTSX.USDT");
    });

    it("keeps trailing zeros (the precision is the asset's, not the amount's)", () => {
        expect(
            formatAssetAmount(
                {amount: "1000000", asset_id: "1.3.5"},
                {symbol: "USD", precision: 4},
                "en-US"
            )
        ).toBe("100.0000 USD");
    });

    it("knows the core asset without being told", () => {
        expect(
            formatAssetAmount(
                {amount: 100000, asset_id: "1.3.0"},
                null,
                "en-US"
            )
        ).toBe("1.00000 BTS");
    });

    it("falls back to the raw amount for an asset it cannot resolve", () => {
        expect(
            formatAssetAmount({amount: "42", asset_id: "1.3.999"}, null)
        ).toBe("42 1.3.999");
        expect(formatAssetAmount(null, null)).toBe("");
    });
});
