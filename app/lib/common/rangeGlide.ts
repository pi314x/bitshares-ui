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
