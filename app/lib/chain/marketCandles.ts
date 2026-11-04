// The candles of a market from the node's market history, a few requests at a time (the node answers a request with a limited
// number of buckets). The history plugin keeps buckets of 15 s, 1 min, 5 min, 1 h and 1 day on the public nodes: a size it does not
// keep answers with nothing.
import {Apis} from "bitsharesjs-ws";
import {Candle} from "../common/strategies";
import {
    AssetRef,
    HistoryBucket,
    bucketRanges,
    candlesFromBuckets
} from "../common/marketCandles";

/** The candles of `trade` priced in `priced` that opened from `fromMs` to `toMs`, oldest first. */
export async function loadCandles(
    trade: AssetRef,
    priced: AssetRef,
    seconds: number,
    fromMs: number,
    toMs: number
): Promise<Candle[]> {
    const history = (Apis as any).instance().history_api();
    const all: HistoryBucket[] = [];
    for (const range of bucketRanges(fromMs, toMs, seconds)) {
        const rows = (await history.exec("get_market_history", [
            trade.id,
            priced.id,
            seconds,
            range.start,
            range.end
        ])) as HistoryBucket[];
        if (Array.isArray(rows)) all.push(...rows);
    }
    return candlesFromBuckets(all, trade, priced);
}

/** An asset by symbol (or id): its id, precision and symbol as the chain has them; null where there is none. */
export async function lookupAsset(
    symbolOrId: string
): Promise<AssetRef | null> {
    const rows = (await (Apis as any)
        .instance()
        .db_api()
        .exec("lookup_asset_symbols", [[symbolOrId.trim()]])) as any[];
    const row = rows && rows[0];
    if (!row || typeof row.id !== "string") return null;
    return {
        id: row.id,
        symbol: String(row.symbol),
        precision: Number(row.precision)
    };
}

/** The price of the latest trade: from the last hours' 5-minute candles, else the last week's hourly ones; null with none. */
export async function loadLastPrice(
    trade: AssetRef,
    priced: AssetRef
): Promise<number | null> {
    const now = Date.now();
    const looks: Array<[number, number]> = [
        [300, 3 * 3600 * 1000],
        [3600, 7 * 24 * 3600 * 1000]
    ];
    for (const [seconds, span] of looks) {
        const candles = await loadCandles(
            trade,
            priced,
            seconds,
            now - span,
            now
        );
        if (candles.length) return candles[candles.length - 1].close;
    }
    return null;
}
