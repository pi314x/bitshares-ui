import {
    MarketFee,
    NO_MARKET_FEE,
    SwapPool,
    marketFee,
    minReceive,
    priceImpact,
    quoteExactIn,
    quoteExactOut
} from "../../lib/common/poolSwap";
import {compareVenues, fillFromOrderBook} from "../../lib/common/priceCompare";

const n = (v: number | string) => BigInt(v);

const pool = (over: Partial<SwapPool> = {}): SwapPool => ({
    balanceIn: n(1000000),
    balanceOut: n(2000000),
    takerFeePercent: 0,
    feeIn: NO_MARKET_FEE,
    feeOut: NO_MARKET_FEE,
    ...over
});

describe("quoteExactIn", () => {
    it("is the constant-product amount, rounded in the pool's favour", () => {
        // k = 2e12; new in 1,100,000; new out = ceil(2e12 / 1.1e6) = 1,818,182
        const q = quoteExactIn(pool(), n(100000))!;
        expect(q.receive).toBe(n(2000000 - 1818182));
        expect(q.poolFee).toBe(n(0));
        expect(q.newBalanceIn).toBe(n(1100000));
        expect(q.newBalanceOut).toBe(n(1818182));
        // the pool's invariant never falls
        expect(
            q.newBalanceIn * q.newBalanceOut >= n(2000000) * n(1000000)
        ).toBe(true);
    });

    it("takes the pool's taker fee (floor) off what leaves the pool", () => {
        // delta = 181,818; 0.2% (20) of it = 363 (floor of 363.6)
        const q = quoteExactIn(pool({takerFeePercent: 20}), n(100000))!;
        expect(q.poolFee).toBe(n(363));
        expect(q.receive).toBe(n(181818 - 363));
    });

    it("takes the maker market fee off what is sold and the taker one off what is received", () => {
        const feeIn: MarketFee = {
            charges: true,
            makerPercent: 100, // 1%
            takerPercent: null,
            max: n(1000000)
        };
        const feeOut: MarketFee = {
            charges: true,
            makerPercent: 50,
            takerPercent: 200, // 2% as a taker
            max: n(10)
        };
        const q = quoteExactIn(pool({feeIn, feeOut}), n(100000))!;
        expect(q.makerMarketFee).toBe(n(1000)); // 1% of 100,000
        // pool receives 99,000: new in 1,099,000, new out ceil(2e12/1.099e6)
        const newOut = (n(2000000000000) + n(1099000) - n(1)) / n(1099000);
        const delta = n(2000000) - newOut;
        expect(q.takerMarketFee).toBe(n(10)); // 2% of delta, capped at 10
        expect(q.receive).toBe(delta - n(10));
    });

    it("returns null for nothing, for a fee as large as the amount, and for stable pools", () => {
        expect(quoteExactIn(pool(), n(0))).toBeNull();
        const eatsAll: MarketFee = {
            charges: true,
            makerPercent: 10000,
            takerPercent: null,
            max: n(1000000)
        };
        expect(quoteExactIn(pool({feeIn: eatsAll}), n(1000))).toBeNull();
        expect(quoteExactIn(pool({stable: true}), n(1000))).toBeNull();
    });

    it("pays nothing for a dust amount (the chain would refuse it)", () => {
        const q = quoteExactIn(
            pool({balanceIn: n(1000000000), balanceOut: n(10)}),
            n(1)
        );
        expect(q === null || q.receive === n(0)).toBe(true);
    });
});

describe("quoteExactOut", () => {
    it("finds the least that pays at least the wanted amount", () => {
        const p = pool({takerFeePercent: 20});
        const want = n(150000);
        const q = quoteExactOut(p, want)!;
        expect(q.receive >= want).toBe(true);
        // one unit less does not
        const less = quoteExactIn(p, q.pay - n(1));
        expect(less === null || less.receive < want).toBe(true);
    });

    it("is null when the pool cannot pay that much", () => {
        expect(quoteExactOut(pool(), n(2000000))).toBeNull();
        expect(quoteExactOut(pool(), n(5000000))).toBeNull();
        expect(quoteExactOut(pool(), n(0))).toBeNull();
    });

    it("inverts quoteExactIn for a range of sizes", () => {
        const p = pool({takerFeePercent: 25});
        for (const pay of [1000, 12345, 250000, 900000]) {
            const forward = quoteExactIn(p, n(pay))!;
            const back = quoteExactOut(p, forward.receive)!;
            expect(back.pay <= n(pay)).toBe(true);
            expect(back.receive >= forward.receive).toBe(true);
        }
    });
});

describe("price impact and slippage", () => {
    it("grows with the size of the trade", () => {
        const p = pool({takerFeePercent: 20});
        const small = priceImpact(quoteExactIn(p, n(1000))!);
        const large = priceImpact(quoteExactIn(p, n(500000))!);
        expect(small).toBeGreaterThan(0.001); // at least the 0.2% fee
        expect(large).toBeGreaterThan(small);
    });

    it("minReceive keeps the share that slippage leaves", () => {
        expect(minReceive(n(10000), 0.005)).toBe(n(9950));
        expect(minReceive(n(10000), 0)).toBe(n(10000));
        expect(minReceive(n(10000), 1)).toBe(n(0));
    });

    it("marketFee is zero for an asset that does not charge", () => {
        expect(marketFee(NO_MARKET_FEE, n(1000), true)).toBe(n(0));
    });
});

describe("order book against the pool", () => {
    // sells USD (receiveAsset) for BTS (payAsset); price = BTS per USD
    const order = (
        usd: number,
        btsPerUsdNum: number,
        btsPerUsdDen: number
    ) => ({
        for_sale: String(usd),
        sell_price: {
            base: {amount: String(btsPerUsdDen), asset_id: "USD"},
            quote: {amount: String(btsPerUsdNum), asset_id: "BTS"}
        }
    });

    it("walks the cheapest orders first and reports a partial last fill", () => {
        // 100 USD at 70 BTS each, 100 USD at 68 BTS each (cheaper)
        const book = [order(100, 70, 1), order(100, 68, 1)];
        // pay 8,000 BTS: 100 USD costs 6,800, the rest buys 1200/70 = 17 USD
        const fill = fillFromOrderBook(book, "BTS", "USD", n(8000));
        expect(fill.gross).toBe(n(117));
        expect(fill.complete).toBe(true);
        expect(fill.levels).toBe(2);
        expect(fill.spent).toBe(n(8000 - 10)); // 17 USD cost 6800 + 1190
    });

    it("is incomplete when the book is not deep enough, and ignores the other side", () => {
        const sellsBts = {
            for_sale: "1000000",
            sell_price: {
                base: {amount: "1", asset_id: "BTS"},
                quote: {amount: "70", asset_id: "USD"}
            }
        };
        const fill = fillFromOrderBook(
            [order(10, 70, 1), sellsBts],
            "BTS",
            "USD",
            n(5000)
        );
        expect(fill.gross).toBe(n(10));
        expect(fill.complete).toBe(false);
    });

    it("compares what each venue pays", () => {
        const book = {
            receive: n(100),
            gross: n(100),
            spent: n(5000),
            complete: true,
            levels: 1
        };
        expect(compareVenues(n(105), book)).toEqual({
            better: "pool",
            advantage: 0.05
        });
        expect(compareVenues(n(95), book).better).toBe("book");
        expect(compareVenues(n(100), book).better).toBe("equal");
        // a book that cannot take the whole amount is not a venue for it
        expect(
            compareVenues(n(1), {...book, complete: false, receive: n(1000)})
                .better
        ).toBe("pool");
    });
});

import {compareSpot} from "../../lib/common/priceCompare";

describe("compareSpot (the market page's hint)", () => {
    it("says the pool is cheaper to buy from and pays more when it does", () => {
        // 100,000 BTS against 1,000 USD: spot 100 BTS per USD; 0.2% fee
        const c = compareSpot(100000, 1000, 20, 100.5, 99.5)!;
        expect(c.poolBuy).toBeCloseTo(100.2004, 3);
        expect(c.poolSell).toBeCloseTo(99.8, 3);
        expect(c.buy!.better).toBe("pool"); // 100.20 < 100.5
        expect(c.sell!.better).toBe("pool"); // 99.8 > 99.5
        expect(c.buy!.advantage).toBeCloseTo(0.003, 3);
    });

    it("says the book is better when its prices are", () => {
        const c = compareSpot(100000, 1000, 20, 100.1, 99.9)!;
        expect(c.buy!.better).toBe("book"); // book ask 100.1 < pool 100.20
        expect(c.sell!.better).toBe("book"); // book bid 99.9 > pool 99.8
    });

    it("has nothing to say without both sides of the pool or without orders", () => {
        expect(compareSpot(0, 1000, 20, 1, 1)).toBeNull();
        const noOrders = compareSpot(100000, 1000, 20, null, null)!;
        expect(noOrders.buy).toBeNull();
        expect(noOrders.sell).toBeNull();
    });
});
