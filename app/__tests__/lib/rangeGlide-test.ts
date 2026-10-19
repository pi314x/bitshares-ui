import {
    easeInOut,
    glideSpan,
    sameSpan,
    targetSpan
} from "../../lib/common/rangeGlide";

describe("easeInOut", () => {
    it("runs from 0 to 1, gently at both ends", () => {
        expect(easeInOut(0)).toBe(0);
        expect(easeInOut(1)).toBe(1);
        expect(easeInOut(0.5)).toBeCloseTo(0.5, 9);
        expect(easeInOut(0.1)).toBeLessThan(0.1);
        expect(easeInOut(0.9)).toBeGreaterThan(0.9);
        expect(easeInOut(-1)).toBe(0);
        expect(easeInOut(2)).toBe(1);
    });
});

describe("glideSpan", () => {
    const a = {from: 90, to: 100};
    const b = {from: 0, to: 100};

    it("starts at the first span and ends at the second", () => {
        expect(glideSpan(a, b, 0)).toEqual(a);
        const end = glideSpan(a, b, 1);
        expect(end.from).toBeCloseTo(0, 9);
        expect(end.to).toBeCloseTo(100, 9);
    });

    it("widens by a ratio, not by a step: half way is not the far end", () => {
        // 10 -> 100 wide; at the eased half the width is between the two
        const mid = glideSpan(a, b, 0.5);
        const width = mid.to - mid.from;
        expect(width).toBeGreaterThan(10);
        expect(width).toBeLessThan(100);
        expect(width).toBeCloseTo(10 * Math.pow(10, easeInOut(0.5)), 9);
    });

    it("never goes back while widening", () => {
        let last = 0;
        for (let k = 0; k <= 1; k += 0.05) {
            const s = glideSpan(a, b, k);
            const width = s.to - s.from;
            expect(width).toBeGreaterThanOrEqual(last);
            last = width;
        }
    });

    it("moves the right edge in a line", () => {
        const s = glideSpan({from: 0, to: 10}, {from: 0, to: 20}, 1);
        expect(s.to).toBeCloseTo(20, 9);
    });

    it("falls back to a straight line for a span without width", () => {
        const s = glideSpan({from: 5, to: 5}, {from: 0, to: 10}, 1);
        expect(s.from).toBeCloseTo(0, 9);
        expect(s.to).toBeCloseTo(10, 9);
    });
});

describe("sameSpan", () => {
    it("tells spans apart by a hundredth of a bar", () => {
        expect(sameSpan({from: 0, to: 10}, {from: 0.005, to: 10})).toBe(true);
        expect(sameSpan({from: 0, to: 10}, {from: 0.5, to: 10})).toBe(false);
    });
});

describe("targetSpan", () => {
    // a point a day for ten days: bars 0..9
    const times = Array.from({length: 10}, (_, i) => 1000 + i * 86400);

    it("shows the last period, or all of it for period 0", () => {
        expect(targetSpan(times, 3 * 86400, null)).toEqual({
            from: 6 - 0.5,
            to: 9.5
        });
        expect(targetSpan(times, 0, null)).toEqual({from: -0.5, to: 9.5});
        // a period longer than the history: all of it
        expect(targetSpan(times, 99 * 86400, null)).toEqual({
            from: -0.5,
            to: 9.5
        });
    });

    it("holds on the most recent data while older history arrives", () => {
        // the view was first drawn from the 7th day (bar 6 of the first ten)
        const holdFrom = times[6];
        expect(targetSpan(times, 0, holdFrom)).toEqual({from: 5.5, to: 9.5});
        // five older days came in at the left: the same days are in view, 5 bars on
        const older = Array.from({length: 5}, (_, i) => 1000 - (5 - i) * 86400);
        const more = older.concat(times);
        expect(targetSpan(more, 0, holdFrom)).toEqual({from: 10.5, to: 14.5});
        // released: everything
        expect(targetSpan(more, 0, null)).toEqual({from: -0.5, to: 14.5});
    });

    it("does not hold a chosen period back", () => {
        expect(targetSpan(times, 2 * 86400, times[6])).toEqual({
            from: 6.5,
            to: 9.5
        });
    });
});
