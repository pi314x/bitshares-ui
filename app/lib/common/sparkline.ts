// A small price line for a table row: what the price did over the last days.
// Pure geometry plus the reading of the node's market-history buckets.

export interface Bucket {
    key: {base: string; quote: string; seconds?: number; open?: string};
    close_base: string | number;
    close_quote: string | number;
}

/**
 * Prices (base units per quote unit) from `get_market_history` buckets, oldest
 * first. A bucket is stated in whichever order of the pair the chain keeps; it
 * is turned so that the line reads like the market's price (`base` per
 * `quote`). Only the shape matters here, not the scale, so precisions are not
 * applied.
 */
export function bucketPrices(
    buckets: Bucket[],
    baseId: string,
    quoteId: string
): number[] {
    const sorted = buckets
        .slice()
        .sort((a, b) =>
            String(a.key.open || "").localeCompare(String(b.key.open || ""))
        );
    const prices: number[] = [];
    sorted.forEach(bucket => {
        const closeBase = Number(bucket.close_base);
        const closeQuote = Number(bucket.close_quote);
        if (!(closeBase > 0) || !(closeQuote > 0)) return;
        if (bucket.key.base === baseId && bucket.key.quote === quoteId) {
            prices.push(closeBase / closeQuote);
        } else if (bucket.key.base === quoteId && bucket.key.quote === baseId) {
            prices.push(closeQuote / closeBase);
        }
    });
    return prices;
}

export type Trend = "up" | "down" | "flat";

export function trend(prices: number[]): Trend {
    if (prices.length < 2) return "flat";
    const first = prices[0];
    const last = prices[prices.length - 1];
    if (!(first > 0)) return "flat";
    const change = (last - first) / first;
    return change > 0.001 ? "up" : change < -0.001 ? "down" : "flat";
}

/** An SVG path for `prices` in a `width` x `height` box (y grows downwards),
 * or "" for fewer than two points. A flat series is a line in the middle. */
export function sparkPath(
    prices: number[],
    width: number,
    height: number,
    pad = 2
): string {
    if (prices.length < 2) return "";
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const span = max - min;
    const innerW = width - 2 * pad;
    const innerH = height - 2 * pad;
    return prices
        .map((price, i) => {
            const x = pad + (innerW * i) / (prices.length - 1);
            const y =
                span === 0
                    ? height / 2
                    : pad + innerH * (1 - (price - min) / span);
            return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(" ");
}
