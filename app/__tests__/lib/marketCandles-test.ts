import {
    BUCKETS_PER_CALL,
    bucketRanges,
    candlesFromBuckets
} from "../../lib/common/marketCandles";

const BTS = {id: "1.3.0", symbol: "BTS", precision: 5};
const USD = {id: "1.3.121", symbol: "USD", precision: 4};

const bucket = (
    key: object,
    o: [number, number],
    h: [number, number],
    l: [number, number],
    c: [number, number]
) => ({
    key,
    open_base: o[0],
    open_quote: o[1],
    high_base: h[0],
    high_quote: h[1],
    low_base: l[0],
    low_quote: l[1],
    close_base: c[0],
    close_quote: c[1]
});

describe("lib/common/marketCandles", () => {
    describe("candlesFromBuckets", () => {
        it("reads a bucket stated with the priced asset as the base, precisions applied", () => {
            // 20 / 10^4 USD for 10000 / 10^5 BTS = 0.02 USD per BTS
            const candles = candlesFromBuckets(
                [
                    bucket(
                        {
                            base: USD.id,
                            quote: BTS.id,
                            open: "2026-11-04T10:00:00"
                        },
                        [20, 10000],
                        [22, 10000],
                        [19, 10000],
                        [21, 10000]
                    )
                ] as any,
                BTS,
                USD
            );
            expect(candles).toHaveLength(1);
            expect(candles[0].t).toBe(Date.UTC(2026, 10, 4, 10));
            expect(candles[0].open).toBeCloseTo(0.02, 9);
            expect(candles[0].high).toBeCloseTo(0.022, 9);
            expect(candles[0].low).toBeCloseTo(0.019, 9);
            expect(candles[0].close).toBeCloseTo(0.021, 9);
        });

        it("reads a bucket stated the other way round: the prices turned over, the high and the low from the extremes", () => {
            // BTS as the base: 10000 / 10^5 = 0.1 BTS for 20 / 10^4 = 0.002 USD, so 0.02 USD per BTS
            const candles = candlesFromBuckets(
                [
                    bucket(
                        {
                            base: BTS.id,
                            quote: USD.id,
                            open: "2026-11-04T10:00:00"
                        },
                        [10000, 20],
                        // the highest price in USD per BTS is the LOWEST BTS per USD: the node's "high" here is the other end
                        [10000, 19],
                        [10000, 22],
                        [10000, 21]
                    )
                ] as any,
                BTS,
                USD
            );
            expect(candles[0].open).toBeCloseTo(0.02, 9);
            expect(candles[0].high).toBeCloseTo(0.022, 9);
            expect(candles[0].low).toBeCloseTo(0.019, 9);
            expect(candles[0].close).toBeCloseTo(0.021, 9);
        });

        it("leaves out other markets, buckets without a price or a time, and keeps one candle for each time, oldest first", () => {
            const good = (open: string, price: number) =>
                bucket(
                    {base: USD.id, quote: BTS.id, open},
                    [price, 10000],
                    [price, 10000],
                    [price, 10000],
                    [price, 10000]
                );
            const candles = candlesFromBuckets(
                [
                    good("2026-11-04T11:00:00", 30),
                    good("2026-11-04T10:00:00", 20),
                    good("2026-11-04T10:00:00", 25),
                    bucket(
                        {
                            base: "1.3.5",
                            quote: BTS.id,
                            open: "2026-11-04T09:00:00"
                        },
                        [1, 1],
                        [1, 1],
                        [1, 1],
                        [1, 1]
                    ),
                    bucket(
                        {base: USD.id, quote: BTS.id, open: "not a time"},
                        [1, 1],
                        [1, 1],
                        [1, 1],
                        [1, 1]
                    ),
                    bucket(
                        {
                            base: USD.id,
                            quote: BTS.id,
                            open: "2026-11-04T08:00:00"
                        },
                        [0, 1],
                        [1, 1],
                        [1, 1],
                        [1, 1]
                    ),
                    null,
                    {}
                ] as any,
                BTS,
                USD
            );
            expect(candles.map(c => c.t)).toEqual([
                Date.UTC(2026, 10, 4, 10),
                Date.UTC(2026, 10, 4, 11)
            ]);
            // (the later of two buckets with one opening time)
            expect(candles[0].open).toBeCloseTo(0.025, 9);
            expect(candlesFromBuckets(null as any, BTS, USD)).toEqual([]);
        });
    });

    describe("bucketRanges", () => {
        it("splits a span into requests of at most the number of buckets the node answers", () => {
            const hour = 3600 * 1000;
            const from = Date.UTC(2026, 10, 1);
            const ranges = bucketRanges(from, from + 400 * hour, 3600);
            expect(ranges).toHaveLength(Math.ceil(400 / BUCKETS_PER_CALL));
            expect(ranges[0].start).toBe("2026-11-01T00:00:00");
            // each range ends where the next begins, the last at the end of the span
            ranges
                .slice(1)
                .forEach((range, i) => expect(range.start).toBe(ranges[i].end));
            expect(ranges[ranges.length - 1].end).toBe(
                new Date(from + 400 * hour).toISOString().slice(0, 19)
            );
        });

        it("is no request for an empty span or a size that is not a size", () => {
            expect(bucketRanges(10, 10, 60)).toEqual([]);
            expect(bucketRanges(10, 5, 60)).toEqual([]);
            expect(bucketRanges(0, 1000, 0)).toEqual([]);
        });
    });
});
