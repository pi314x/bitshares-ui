import {
    FILL_ORDER,
    historySequence,
    newFills,
    newestSequence,
    formatAssetAmount
} from "../../lib/common/fills";

const fill = (n: number, account = "1.2.10") => ({
    id: `1.11.${n}`,
    op: [
        FILL_ORDER,
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

    it("returns the account's fills after the baseline, oldest first", () => {
        const entries = [
            fill(12),
            transfer(11),
            fill(10),
            fill(9, "1.2.99"),
            fill(8)
        ];
        expect(newFills(entries, "1.2.10", 8).map(e => e.id)).toEqual([
            "1.11.10",
            "1.11.12"
        ]);
        expect(newFills(entries, "1.2.10", 12)).toEqual([]);
    });

    it("keeps the newest when there are many", () => {
        const entries = Array.from({length: 8}, (_, i) => fill(100 + i));
        expect(newFills(entries, "1.2.10", 0, 3).map(e => e.id)).toEqual([
            "1.11.105",
            "1.11.106",
            "1.11.107"
        ]);
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
