import {normalizeBars} from "../../lib/common/normalizeBars";

const bar = (time: number, close = 1, extra: any = {}) => ({
    time,
    open: close,
    high: close,
    low: close,
    close,
    ...extra
});

describe("normalizeBars", () => {
    it("sorts into ascending time", () => {
        expect(
            normalizeBars([bar(30), bar(10), bar(20)]).map(b => b.time)
        ).toEqual([10, 20, 30]);
    });

    it("keeps one bar per time, the later one", () => {
        const result = normalizeBars([bar(10, 1), bar(20, 2), bar(10, 3)]);
        expect(result.map(b => [b.time, b.close])).toEqual([
            [10, 3],
            [20, 2]
        ]);
    });

    it("drops bars with no price or no time", () => {
        const result = normalizeBars([
            bar(10),
            bar(20, 1, {open: null}),
            bar(30, NaN),
            {...bar(40), time: NaN},
            bar(50)
        ] as any);
        expect(result.map(b => b.time)).toEqual([10, 50]);
    });

    it("copes with nothing", () => {
        expect(normalizeBars(null)).toEqual([]);
        expect(normalizeBars(undefined)).toEqual([]);
        expect(normalizeBars([])).toEqual([]);
    });
});
