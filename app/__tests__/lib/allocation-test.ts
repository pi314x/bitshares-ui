import {
    allocationSlices,
    arcPath,
    pointOnCircle
} from "../../lib/common/allocation";

const parts = (values: Array<number | null>) =>
    values.map((value, i) => ({key: `k${i}`, label: `L${i}`, value}));

describe("allocationSlices", () => {
    it("takes the parts above zero, biggest first, with their shares", () => {
        const {slices, total} = allocationSlices(
            parts([10, 30, 0, null, -5, 60])
        );
        expect(total).toBe(100);
        expect(slices.map(s => s.label)).toEqual(["L5", "L1", "L0"]);
        expect(slices.map(s => s.share)).toEqual([0.6, 0.3, 0.1]);
    });

    it("starts each slice where the one before ends, the first at the top, all round", () => {
        const {slices} = allocationSlices(parts([50, 30, 20]));
        expect(slices[0].start).toBe(0);
        slices.forEach((s, i) => {
            if (i) expect(s.start).toBeCloseTo(slices[i - 1].end, 9);
        });
        expect(slices[slices.length - 1].end).toBeCloseTo(360, 9);
    });

    it("folds the small ones into one slice after the biggest six", () => {
        const {slices, total} = allocationSlices(
            parts([100, 90, 80, 70, 60, 50, 5, 4, 3])
        );
        expect(total).toBe(462);
        expect(slices).toHaveLength(7);
        const other = slices[6];
        expect(other).toMatchObject({key: "other", value: 12, folded: 3});
        // the shares are still of the whole
        expect(slices.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1, 9);
    });

    it("does not fold a single left-over part: it is shown as itself", () => {
        const {slices} = allocationSlices(parts([100, 90, 80, 70, 60, 50, 5]));
        expect(slices).toHaveLength(7);
        expect(slices.every(s => s.key !== "other")).toBe(true);
    });

    it("is empty when nothing has a value", () => {
        expect(allocationSlices(parts([0, null, -1]))).toEqual({
            slices: [],
            total: 0
        });
        expect(allocationSlices([])).toEqual({slices: [], total: 0});
    });
});

describe("pointOnCircle and arcPath", () => {
    it("measures degrees clockwise from the top", () => {
        const [x0, y0] = pointOnCircle(50, 50, 40, 0);
        expect(x0).toBeCloseTo(50);
        expect(y0).toBeCloseTo(10);
        const [x90, y90] = pointOnCircle(50, 50, 40, 90);
        expect(x90).toBeCloseTo(90);
        expect(y90).toBeCloseTo(50);
        const [x180, y180] = pointOnCircle(50, 50, 40, 180);
        expect(x180).toBeCloseTo(50);
        expect(y180).toBeCloseTo(90);
    });

    it("draws a quarter as one arc, and the large-arc flag only past a half", () => {
        expect(arcPath(50, 50, 40, 0, 90, 0)).toBe(
            "M 50.000 10.000 A 40 40 0 0 1 90.000 50.000"
        );
        expect(arcPath(50, 50, 40, 0, 270, 0)).toMatch(/A 40 40 0 1 1/);
    });

    it("leaves a gap at each end of a slice, and a sliver for a very small one", () => {
        // 5 degrees off each end: it starts at 5 and ends at 85, not at 0 and 90
        const quarter = arcPath(50, 50, 40, 0, 90, 5);
        expect(quarter).toContain("M 53.486 10.152");
        expect(quarter).toContain("89.848 46.514");
        const tiny = arcPath(50, 50, 40, 10, 10.5, 5);
        expect(tiny).toMatch(/^M [\d.]+ [\d.]+ A 40 40 0 0 1 [\d.]+ [\d.]+$/);
    });

    it("draws a whole circle as two half arcs", () => {
        const path = arcPath(50, 50, 40, 0, 360, 0);
        expect((path.match(/A /g) || []).length).toBe(2);
    });
});
