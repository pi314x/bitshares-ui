// Seven days of price shape for a handful of markets: hourly buckets from the
// node's market history (the node keeps 15s, 1m, 5m, 30m, 1h and 1d buckets; an
// in-between size such as 6h answers with nothing), fetched a few at a time and
// kept for a few minutes so that switching tabs does not ask again.
import * as React from "react";
import {Apis} from "bitsharesjs-ws";
import {ChainStore} from "bitsharesjs";
import {bucketPrices} from "../../lib/common/sparkline";

const BUCKET_SECONDS = 3600;
const DAYS = 7;
const TTL_MS = 5 * 60 * 1000;
const CONCURRENCY = 3;

const cache = new Map<string, {at: number; prices: number[]}>();

export interface SparkMarket {
    base: string;
    quote: string;
}

const keyOf = (m: SparkMarket) => `${m.quote}_${m.base}`;

async function load(market: SparkMarket): Promise<number[]> {
    const base: any = (ChainStore as any).getAsset(market.base);
    const quote: any = (ChainStore as any).getAsset(market.quote);
    if (!base || !quote || typeof base.get !== "function") return [];
    const baseId: string = base.get("id");
    const quoteId: string = quote.get("id");
    const end = new Date();
    const start = new Date(end.getTime() - DAYS * 24 * 3600 * 1000);
    const iso = (d: Date) => d.toISOString().slice(0, 19);
    const buckets = await (Apis as any)
        .instance()
        .history_api()
        .exec("get_market_history", [
            baseId,
            quoteId,
            BUCKET_SECONDS,
            iso(start),
            iso(end)
        ]);
    return bucketPrices(buckets || [], baseId, quoteId);
}

/** Price shapes by `quote_base` market name; missing until loaded. */
export function useSparklines(
    markets: SparkMarket[]
): {[market: string]: number[]} {
    const wanted = markets.map(keyOf).join(",");
    const [, setTick] = React.useState(0);

    React.useEffect(() => {
        let cancelled = false;
        const todo = markets.filter(m => {
            const hit = cache.get(keyOf(m));
            return !hit || Date.now() - hit.at > TTL_MS;
        });
        const worker = async () => {
            while (todo.length && !cancelled) {
                const market = todo.shift() as SparkMarket;
                try {
                    const prices = await load(market);
                    cache.set(keyOf(market), {at: Date.now(), prices});
                } catch (e) {
                    cache.set(keyOf(market), {at: Date.now(), prices: []});
                }
                if (!cancelled) setTick(n => n + 1);
            }
        };
        for (let i = 0; i < CONCURRENCY; i++) worker();
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line
    }, [wanted]);

    const out: {[market: string]: number[]} = {};
    markets.forEach(m => {
        const hit = cache.get(keyOf(m));
        if (hit && hit.prices.length) out[keyOf(m)] = hit.prices;
    });
    return out;
}
