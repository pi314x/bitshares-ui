// The chart's view moves from one span to another over a short time instead of
// jumping (Dashboard balance chart: a longer period, or older history that has
// just been loaded). A span is in the chart's logical (bar) units.

export interface Span {
    from: number;
    to: number;
}

/** Slow at the start, quick in the middle, settling at the end: 0..1 -> 0..1. */
export function easeInOut(k: number): number {
    const x = Math.min(1, Math.max(0, k));
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/**
 * The span at progress `k` (0..1) between `a` and `b`. The right edge moves in
 * a straight line and the width by a constant ratio, so zooming out from a day
 * to a month looks as even as zooming out from a day to two (a straight line in
 * the width would spend nearly all of the time at the far end).
 */
export function glideSpan(a: Span, b: Span, k: number): Span {
    const e = easeInOut(k);
    const to = a.to + (b.to - a.to) * e;
    const wa = a.to - a.from;
    const wb = b.to - b.from;
    const width =
        wa > 0 && wb > 0 ? wa * Math.pow(wb / wa, e) : wa + (wb - wa) * e;
    return {from: to - width, to};
}

/** Two spans that are the same to a hundredth of a bar need no glide. */
export function sameSpan(a: Span, b: Span): boolean {
    return Math.abs(a.from - b.from) < 0.01 && Math.abs(a.to - b.to) < 0.01;
}

/**
 * The span the chart should show for points at `times` (rising): the last `period`
 * seconds, or the whole history when `period` is 0 - except that while older history is
 * still arriving (`holdFrom` is the time the view was first drawn from) the whole
 * history means only what was there at first, the most recent data, so that the view
 * does not zoom out with every page. Half a bar either side, as the chart fits.
 */
export function targetSpan(
    times: number[],
    period: number,
    holdFrom: number | null
): Span {
    const n = times.length;
    const fromTime = period ? times[n - 1] - period : holdFrom;
    const firstInside =
        fromTime !== null
            ? Math.max(
                  0,
                  times.findIndex(time => time >= fromTime)
              )
            : 0;
    return {from: firstInside - 0.5, to: n - 1 + 0.5};
}
