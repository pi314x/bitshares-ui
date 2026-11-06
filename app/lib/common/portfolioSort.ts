// How the balances table orders its rows. The comparators are numbers (-1, 0, 1)
// all the way down: a tie that came back as `true`/`false` (what a bare
// `a.key > b.key` gives) is not a comparator, and with it the order of a long
// list was left to the sort algorithm.

/** Alphabetical, as a comparator. */
export function compareKeys(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * The core asset (BTS) counts as the largest row, so a table that is
 * descending by value, which is how it opens, begins with it: it is the asset of
 * the chain's fees and the one every account holds. 0 when neither row or
 * both rows are it.
 */
export function compareCoreLast(
    aKey: string,
    bKey: string,
    coreKey: string
): number {
    const aCore = aKey === coreKey;
    const bCore = bKey === coreKey;
    return aCore === bCore ? 0 : aCore ? 1 : -1;
}

/**
 * Rising by value. A row without a price (null, undefined, NaN) comes before
 * every row with one - so that a descending table ends with them - and rows
 * that are the same (both without a price, or the same value) go by name.
 */
export function compareValues(
    a: number | null | undefined,
    b: number | null | undefined,
    aKey: string,
    bKey: string
): number {
    const aHas = typeof a === "number" && Number.isFinite(a);
    const bHas = typeof b === "number" && Number.isFinite(b);
    if (aHas && bHas) {
        const diff = (a as number) - (b as number);
        return diff !== 0 ? (diff < 0 ? -1 : 1) : compareKeys(aKey, bKey);
    }
    if (!aHas && bHas) return -1;
    if (aHas && !bHas) return 1;
    return compareKeys(aKey, bKey);
}
