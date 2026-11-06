import {feeSpread, feeTierOf} from "../../lib/common/sametOverview";

describe("feeTierOf", () => {
    it("puts a rate into the tier whose bound it does not pass", () => {
        expect(feeTierOf(0).key).toBe("free");
        expect(feeTierOf(1).key).toBe("low");
        expect(feeTierOf(500).key).toBe("low"); // 0.05%
        expect(feeTierOf(501).key).toBe("mid");
        expect(feeTierOf(1000).key).toBe("mid"); // 0.1%
        expect(feeTierOf(10000).key).toBe("high"); // 1%
        expect(feeTierOf(10001).key).toBe("over");
        expect(feeTierOf(1000000).key).toBe("over"); // 100%
    });
});

describe("feeSpread", () => {
    it("sums what each tier holds, in the tiers' order, without the empty ones", () => {
        const spread = feeSpread([
            {rate: 10001, value: 10},
            {rate: 300, value: 60},
            {rate: 300, value: 20},
            {rate: 0, value: 10}
        ]);
        expect(spread.map(s => s.key)).toEqual(["free", "low", "over"]);
        expect(spread.map(s => s.value)).toEqual([10, 80, 10]);
        expect(spread.map(s => s.share)).toEqual([0.1, 0.8, 0.1]);
    });

    it("leaves out funds without a price or a balance", () => {
        const spread = feeSpread([
            {rate: 300, value: null},
            {rate: 300, value: 0},
            {rate: 300, value: NaN},
            {rate: 2000, value: 5}
        ]);
        expect(spread).toHaveLength(1);
        expect(spread[0].key).toBe("high");
        expect(spread[0].share).toBe(1);
    });

    it("is empty when nothing has a value", () => {
        expect(feeSpread([])).toEqual([]);
        expect(feeSpread([{rate: 1, value: null}])).toEqual([]);
    });
});
