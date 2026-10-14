import {
    FILL_ORDER,
    historySequence,
    newFills,
    newestSequence
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
