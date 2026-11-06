import {
    PoolLike,
    formatPrice,
    poolMetrics,
    poolValueInBts,
    shareOfPool,
    sortPools
} from "../../lib/common/poolMetrics";

const pool = (over: Partial<PoolLike> = {}): PoolLike => ({
    id: "1.19.5",
    asset_a: "1.3.0",
    asset_b: "1.3.121",
    balance_a: "20000000000", // 200,000.00000 BTS (precision 5)
    balance_b: "270000", // 27.0000 USD (precision 4) -> wait: 27.0000
    share_asset: "1.3.9000",
    taker_fee_percent: 20,
    withdrawal_fee_percent: 0,
    ...over
});

describe("poolMetrics", () => {
    it("reads reserves in display units, the price and the pool's value in A", () => {
        const m = poolMetrics(pool(), 5, 4);
        expect(m.reserveA).toBe(200000);
        expect(m.reserveB).toBe(27);
        expect(m.priceBPerA).toBeCloseTo(27 / 200000, 12);
        // 200,000 A plus 27 B at 27/200,000 B per A = 2 x 200,000
        expect(m.poolValueA).toBeCloseTo(400000, 6);
        expect(m.volume24hA).toBeNull();
        expect(m.isStable).toBe(false);
    });

    it("counts 24h volume and fees in A from the statistics", () => {
        const m = poolMetrics(
            pool({
                statistics: {
                    _24h_exchange_a2b_amount_a: "1000000000", // 10,000 A in
                    _24h_exchange_b2a_amount_a: "500000000", // 5,000 A out
                    _24h_exchange_fee_a: "2000000", // 20 A
                    _24h_exchange_fee_b: "27" // 0.0027 B = 20 A at the pool's ratio
                }
            }),
            5,
            4
        );
        expect(m.volume24hA).toBeCloseTo(15000, 6);
        expect(m.fees24hA).toBeCloseTo(40, 4);
        expect(m.feeYield24h).toBeCloseTo(40 / 400000, 10);
    });

    it("has no price for an empty pool and flags a stable one", () => {
        const empty = poolMetrics(pool({balance_a: 0, balance_b: 0}), 5, 4);
        expect(empty.priceBPerA).toBeNull();
        expect(empty.poolValueA).toBe(0);
        expect(poolMetrics(pool({pool_type: 1}), 5, 4).isStable).toBe(true);
        expect(poolMetrics(pool({pool_type: "stable"}), 5, 4).isStable).toBe(
            true
        );
    });

    it("values a pool in BTS only when BTS is one side", () => {
        const withBts = pool();
        expect(poolValueInBts(withBts, poolMetrics(withBts, 5, 4))).toBeCloseTo(
            400000,
            6
        );
        const without = pool({asset_a: "1.3.121", asset_b: "1.3.113"});
        expect(poolValueInBts(without, poolMetrics(without, 4, 4))).toBeNull();
    });
});

describe("shareOfPool", () => {
    it("is the holder's fraction of both reserves", () => {
        expect(shareOfPool(25, 100, 1000, 40)).toEqual({
            fraction: 0.25,
            amountA: 250,
            amountB: 10
        });
    });

    it("is nothing without shares or supply", () => {
        expect(shareOfPool(0, 100, 1000, 40).fraction).toBe(0);
        expect(shareOfPool(5, 0, 1000, 40).fraction).toBe(0);
    });
});

describe("sortPools", () => {
    const entry = (id: string, a: string, value: number, volume: number) => ({
        pool: pool({id, asset_a: a}),
        metrics: {
            ...poolMetrics(pool(), 5, 4),
            poolValueA: value,
            volume24hA: volume
        }
    });
    const list = [
        entry("1.19.1", "1.3.121", 9e9, 9e9), // large, but not in BTS
        entry("1.19.2", "1.3.0", 100, 5),
        entry("1.19.3", "1.3.0", 900, 1),
        entry("1.19.4", "1.3.0", 500, 50)
    ];

    it("puts the pools valued in BTS first, largest first", () => {
        expect(sortPools(list, "value").map(p => p.pool.id)).toEqual([
            "1.19.3",
            "1.19.4",
            "1.19.2",
            "1.19.1"
        ]);
    });

    it("sorts by volume and by newest", () => {
        expect(sortPools(list, "volume").map(p => p.pool.id)).toEqual([
            "1.19.4",
            "1.19.2",
            "1.19.3",
            "1.19.1"
        ]);
        expect(sortPools(list, "newest").map(p => p.pool.id)).toEqual([
            "1.19.4",
            "1.19.3",
            "1.19.2",
            "1.19.1"
        ]);
    });
});

describe("formatPrice", () => {
    it("uses more digits for small prices", () => {
        expect(formatPrice(68.71974)).toBe("68.7197");
        expect(formatPrice(0.000135)).toBe("0.000135");
        expect(formatPrice(12345.678)).toBe("12,345.68");
        expect(formatPrice(null)).toBe("-");
    });
});
