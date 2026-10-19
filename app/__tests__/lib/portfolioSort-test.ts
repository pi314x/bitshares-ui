import {
    compareCoreLast,
    compareKeys,
    compareValues
} from "../../lib/common/portfolioSort";

describe("compareKeys", () => {
    it("is a comparator: -1, 0 or 1", () => {
        expect(compareKeys("A", "B")).toBe(-1);
        expect(compareKeys("B", "A")).toBe(1);
        expect(compareKeys("A", "A")).toBe(0);
    });
});

describe("compareValues", () => {
    type Row = {key: string; value: number | null | undefined};
    const sorted = (rows: Row[]) =>
        [...rows]
            .sort((a, b) => compareValues(a.value, b.value, a.key, b.key))
            .map(r => r.key);

    it("orders by value, rising", () => {
        expect(
            sorted([
                {key: "B", value: 30},
                {key: "A", value: 5},
                {key: "C", value: 1000000},
                {key: "D", value: 0.5}
            ])
        ).toEqual(["D", "A", "B", "C"]);
    });

    it("puts rows without a price first, so a descending table ends with them", () => {
        const rows: Row[] = [
            {key: "B", value: 30},
            {key: "X", value: null},
            {key: "A", value: 5},
            {key: "Y", value: undefined},
            {key: "Z", value: NaN}
        ];
        const rising = sorted(rows);
        expect(rising.slice(0, 3)).toEqual(["X", "Y", "Z"]);
        expect(rising.slice(3)).toEqual(["A", "B"]);
        expect(
            rising
                .slice()
                .reverse()
                .slice(0, 2)
        ).toEqual(["B", "A"]);
    });

    it("counts a priced zero as a value, above no price", () => {
        expect(
            sorted([
                {key: "Z", value: 0},
                {key: "A", value: null},
                {key: "M", value: 7}
            ])
        ).toEqual(["A", "Z", "M"]);
    });

    it("orders the same value by name, and gives the same answer however the list starts", () => {
        const rows: Row[] = [];
        for (let i = 0; i < 60; i++) {
            rows.push({
                key: "K" + String(i).padStart(2, "0"),
                value: i % 7 === 0 ? null : (i * 37) % 11
            });
        }
        const expected = sorted(rows);
        const shuffled = [...rows].sort((a, b) => (a.key < b.key ? 1 : -1));
        expect(sorted(shuffled)).toEqual(expected);
    });

    it("is antisymmetric", () => {
        const vals = [null, 0, 1, 2.5, NaN];
        vals.forEach(a =>
            vals.forEach(b => {
                expect(compareValues(a, b, "A", "B")).toBe(
                    -compareValues(b, a, "B", "A")
                );
            })
        );
    });
});

describe("compareCoreLast", () => {
    it("counts the core asset as the largest row and leaves the others alone", () => {
        expect(compareCoreLast("BTS", "USD", "BTS")).toBe(1);
        expect(compareCoreLast("USD", "BTS", "BTS")).toBe(-1);
        expect(compareCoreLast("USD", "CNY", "BTS")).toBe(0);
        expect(compareCoreLast("BTS", "BTS", "BTS")).toBe(0);
    });

    it("puts BTS first in a table that is descending by value", () => {
        const rows = [
            {key: "USD", value: 70},
            {key: "BTS", value: 30},
            {key: "CNY", value: 5}
        ];
        const compare = (a: any, b: any) =>
            compareCoreLast(a.key, b.key, "BTS") ||
            compareValues(a.value, b.value, a.key, b.key);
        // what the table does: sort rising, then turn it round
        const shown = [...rows].sort(compare).reverse();
        expect(shown.map(r => r.key)).toEqual(["BTS", "USD", "CNY"]);
    });
});
