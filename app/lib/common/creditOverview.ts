// The numbers behind the credit offers overview: how the credit on offer is
// spread over assets, what rate it comes at, and which collateral the offers
// accept. Plain arithmetic on what the offers list holds; the prices that turn
// amounts into the user's currency come from the caller.

export const OTHER = "other";

export interface Slice {
    key: string;
    value: number;
    /** 0..1 of the total */
    share: number;
}

/**
 * Parts of a whole, largest first: the `keep` largest stay, the tail is folded
 * into one "other" slice (a colour per class stops being readable past about
 * six). Entries without a value are left out; shares are of what is counted.
 */
export function foldSlices(
    entries: Array<{key: string; value: number}>,
    keep = 5
): {slices: Slice[]; total: number} {
    const counted = entries
        .filter(e => Number.isFinite(e.value) && e.value > 0)
        .sort((a, b) => b.value - a.value);
    const total = counted.reduce((sum, e) => sum + e.value, 0);
    if (!total) return {slices: [], total: 0};
    const kept = counted.slice(0, keep);
    const rest = counted.slice(keep).reduce((sum, e) => sum + e.value, 0);
    const parts = rest > 0 ? [...kept, {key: OTHER, value: rest}] : kept;
    return {
        slices: parts.map(p => ({...p, share: p.value / total})),
        total
    };
}

/** The mean of `value` weighted by `weight`; null when nothing has weight. */
export function weightedAverage(
    items: Array<{value: number; weight: number}>
): number | null {
    let weights = 0;
    let sum = 0;
    items.forEach(item => {
        if (
            Number.isFinite(item.value) &&
            Number.isFinite(item.weight) &&
            item.weight > 0
        ) {
            weights += item.weight;
            sum += item.value * item.weight;
        }
    });
    return weights > 0 ? sum / weights : null;
}

export interface Acceptance {
    key: string;
    /** how many offers accept it */
    count: number;
    /** 0..1 of the offers */
    share: number;
}

/** Which collateral the offers accept, the most accepted first. */
export function collateralAcceptance(
    offers: Array<{collateral: string[]}>
): Acceptance[] {
    const counts: {[assetId: string]: number} = {};
    offers.forEach(offer => {
        new Set(offer.collateral).forEach(id => {
            counts[id] = (counts[id] || 0) + 1;
        });
    });
    return Object.keys(counts)
        .map(key => ({
            key,
            count: counts[key],
            share: offers.length ? counts[key] / offers.length : 0
        }))
        .sort((a, b) => b.count - a.count || (a.key < b.key ? -1 : 1));
}
