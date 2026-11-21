// Candles (open, high, low, close) of a market from the buckets the node's market history gives (`get_market_history`), as prices
// in the priced-in asset per trade asset, precisions applied. The node states a bucket in whichever order it keeps the pair, with
// raw amounts; here they are turned into the price a person reads.
import {Candle} from "./strategies";

export interface AssetRef {
    id: string;
    symbol: string;
    precision: number;
}

export interface HistoryBucket {
    key: {base: string; quote: string; seconds?: number | string; open: string};
    open_base: string | number;
    open_quote: string | number;
    high_base: string | number;
    high_quote: string | number;
    low_base: string | number;
    low_quote: string | number;
    close_base: string | number;
    close_quote: string | number;
}

/** When a bucket opened (ms): the node gives UTC time without a zone. */
function openedAt(open: unknown): number | null {
    if (typeof open !== "string") return null;
    const t = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(open) ? open : `${open}Z`);
    return Number.isFinite(t) ? t : null;
}

/** The candles of the buckets that belong to the pair, oldest first, one for each opening time. */
export function candlesFromBuckets(
    buckets: HistoryBucket[],
    trade: AssetRef,
    priced: AssetRef
): Candle[] {
    const scale = Math.pow(10, trade.precision - priced.precision);
    const byTime = new Map<number, Candle>();
    (Array.isArray(buckets) ? buckets : []).forEach(bucket => {
        const key = bucket && bucket.key;
        if (!key) return;
        const tradeIsBase = key.base === trade.id && key.quote === priced.id;
        const pricedIsBase = key.base === priced.id && key.quote === trade.id;
        if (!tradeIsBase && !pricedIsBase) return;
        const t = openedAt(key.open);
        if (t === null) return;
        // the price in that bucket's own amounts: priced-in units per trade-asset unit
        const price = (name: "open" | "high" | "low" | "close") => {
            const base = Number((bucket as any)[`${name}_base`]);
            const quote = Number((bucket as any)[`${name}_quote`]);
            const pricedAmount = pricedIsBase ? base : quote;
            const tradeAmount = pricedIsBase ? quote : base;
            return pricedAmount > 0 && tradeAmount > 0
                ? (pricedAmount / tradeAmount) * scale
                : NaN;
        };
        const open = price("open");
        const close = price("close");
        const high = price("high");
        const low = price("low");
        const all = [open, close, high, low];
        if (!all.every(p => Number.isFinite(p) && p > 0)) return;
        // (a bucket stated the other way round has its high and low swapped: the extremes are taken from all four)
        byTime.set(t, {
            t,
            open,
            close,
            high: Math.max(...all),
            low: Math.min(...all)
        });
    });
    return Array.from(byTime.values()).sort((a, b) => a.t - b.t);
}

/** How many buckets one request asks for (the node answers with a limited number). */
export const BUCKETS_PER_CALL = 150;

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 19);

/** The time ranges to ask for, oldest first, each of at most `BUCKETS_PER_CALL` buckets, as the node writes times. */
export function bucketRanges(
    fromMs: number,
    toMs: number,
    seconds: number
): Array<{start: string; end: string}> {
    const out: Array<{start: string; end: string}> = [];
    if (!(toMs > fromMs) || !(seconds > 0)) return out;
    const span = BUCKETS_PER_CALL * seconds * 1000;
    for (let start = fromMs; start < toMs; start += span) {
        out.push({start: iso(start), end: iso(Math.min(toMs, start + span))});
    }
    return out;
}
