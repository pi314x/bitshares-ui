export interface PriceBar {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume?: number;
}

/**
 * What a chart library can be given: bars in strictly ascending time, one per
 * time, with finite open / high / low / close. The market store's price data
 * arrives in the order the node answered and may repeat a bucket or hold a
 * bar with no price; the TradingView datafeed logged "time order violation"
 * and "Value is null" for that.
 */
export function normalizeBars<T extends PriceBar>(
    bars: T[] | null | undefined
): T[] {
    const usable = (bars || []).filter(
        bar =>
            bar &&
            Number.isFinite(bar.time) &&
            Number.isFinite(bar.open) &&
            Number.isFinite(bar.high) &&
            Number.isFinite(bar.low) &&
            Number.isFinite(bar.close)
    );
    const sorted = usable.slice().sort((a, b) => a.time - b.time);
    // the later bar of a repeated time wins (it is the newer update)
    const result: T[] = [];
    sorted.forEach(bar => {
        if (result.length && result[result.length - 1].time === bar.time) {
            result[result.length - 1] = bar;
        } else {
            result.push(bar);
        }
    });
    return result;
}
