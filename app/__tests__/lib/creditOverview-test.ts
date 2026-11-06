import {
    OTHER,
    collateralAcceptance,
    foldSlices,
    weightedAverage
} from "../../lib/common/creditOverview";

describe("foldSlices", () => {
    it("orders by size and gives each its share", () => {
        const {slices, total} = foldSlices([
            {key: "A", value: 25},
            {key: "B", value: 75}
        ]);
        expect(total).toBe(100);
        expect(slices).toEqual([
            {key: "B", value: 75, share: 0.75},
            {key: "A", value: 25, share: 0.25}
        ]);
    });

    it("folds what is past the kept slices into one other slice", () => {
        const {slices} = foldSlices(
            [1, 2, 3, 4, 5, 6, 7].map(n => ({key: "K" + n, value: n})),
            3
        );
        expect(slices.map(s => s.key)).toEqual(["K7", "K6", "K5", OTHER]);
        expect(slices[3].value).toBe(1 + 2 + 3 + 4);
        expect(slices.reduce((s, x) => s + x.share, 0)).toBeCloseTo(1);
    });

    it("leaves out what has no value", () => {
        const {slices, total} = foldSlices([
            {key: "A", value: 0},
            {key: "B", value: NaN},
            {key: "C", value: 10}
        ]);
        expect(total).toBe(10);
        expect(slices.map(s => s.key)).toEqual(["C"]);
        expect(foldSlices([])).toEqual({slices: [], total: 0});
    });
});

describe("weightedAverage", () => {
    it("weights each value by its size", () => {
        expect(
            weightedAverage([
                {value: 10, weight: 1},
                {value: 20, weight: 3}
            ])
        ).toBe(17.5);
    });

    it("is null without anything to weigh", () => {
        expect(weightedAverage([])).toBeNull();
        expect(weightedAverage([{value: 5, weight: 0}])).toBeNull();
    });
});

describe("collateralAcceptance", () => {
    it("counts the offers that accept each asset, most first", () => {
        const result = collateralAcceptance([
            {collateral: ["1.3.0", "1.3.1"]},
            {collateral: ["1.3.0"]},
            {collateral: ["1.3.0", "1.3.1", "1.3.1"]},
            {collateral: ["1.3.2"]}
        ]);
        expect(result).toEqual([
            {key: "1.3.0", count: 3, share: 0.75},
            {key: "1.3.1", count: 2, share: 0.5},
            {key: "1.3.2", count: 1, share: 0.25}
        ]);
    });

    it("has nothing for no offers", () => {
        expect(collateralAcceptance([])).toEqual([]);
    });
});
