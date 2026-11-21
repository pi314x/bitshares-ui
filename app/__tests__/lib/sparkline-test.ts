import {bucketPrices, sparkPath, trend} from "../../lib/common/sparkline";

const bucket = (
    base: string,
    quote: string,
    open: string,
    cb: number,
    cq: number
) => ({
    key: {base, quote, open},
    close_base: cb,
    close_quote: cq
});

describe("bucketPrices", () => {
    it("orders by open time and reads base per quote", () => {
        const prices = bucketPrices(
            [
                bucket("1.3.0", "1.3.1", "2026-10-14T06:00:00", 400, 100),
                bucket("1.3.0", "1.3.1", "2026-10-14T00:00:00", 200, 100)
            ],
            "1.3.0",
            "1.3.1"
        );
        expect(prices).toEqual([2, 4]);
    });

    it("turns buckets kept the other way round and skips empty ones", () => {
        const prices = bucketPrices(
            [
                bucket("1.3.1", "1.3.0", "2026-10-14T00:00:00", 100, 200),
                bucket("1.3.1", "1.3.0", "2026-10-14T06:00:00", 0, 0)
            ],
            "1.3.0",
            "1.3.1"
        );
        expect(prices).toEqual([2]);
    });
});

describe("trend and sparkPath", () => {
    it("tells up, down and flat", () => {
        expect(trend([1, 2])).toBe("up");
        expect(trend([2, 1])).toBe("down");
        expect(trend([1, 1.0001])).toBe("flat");
        expect(trend([1])).toBe("flat");
    });

    it("draws the low at the bottom and the high at the top", () => {
        const path = sparkPath([1, 3], 60, 20, 2);
        expect(path).toBe("M2.0 18.0 L58.0 2.0");
    });

    it("is a middle line for a flat series and empty for one point", () => {
        expect(sparkPath([5, 5, 5], 60, 20)).toBe(
            "M2.0 10.0 L30.0 10.0 L58.0 10.0"
        );
        expect(sparkPath([5], 60, 20)).toBe("");
    });
});
