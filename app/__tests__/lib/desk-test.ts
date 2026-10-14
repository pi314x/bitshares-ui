import {
    holdingRows,
    positionRisk,
    orderSummary,
    expiryMs,
    attentionItems,
    PositionInput
} from "../../lib/common/desk";

describe("holdingRows", () => {
    it("sorts by value, puts unpriced last, and gives shares of the priced total", () => {
        const {rows, total, unpriced} = holdingRows([
            {
                assetId: "1.3.2",
                symbol: "AAA",
                precision: 2,
                units: 500,
                value: null
            },
            {
                assetId: "1.3.0",
                symbol: "BTS",
                precision: 5,
                units: 3000000,
                value: 30
            },
            {
                assetId: "1.3.1",
                symbol: "USD",
                precision: 4,
                units: 10000,
                value: 70
            },
            {assetId: "1.3.9", symbol: "ZERO", precision: 4, units: 0, value: 0}
        ]);
        expect(rows.map(r => r.symbol)).toEqual(["USD", "BTS", "AAA"]);
        expect(total).toBe(100);
        expect(unpriced).toBe(1);
        expect(rows[0].share).toBeCloseTo(0.7);
        expect(rows[1].amount).toBe(30);
        expect(rows[2].share).toBeNull();
    });
});

describe("positionRisk", () => {
    const base: PositionInput = {
        id: "1.8.1",
        debtAssetId: "1.3.1",
        collateralAssetId: "1.3.0",
        debtUnits: 1000000, // 100.0000 USD
        debtPrecision: 4,
        collateralUnits: 500000000, // 5000.00000 BTS
        collateralPrecision: 5,
        // 0.0634 USD per BTS
        feed: {
            baseUnits: 634,
            baseAssetId: "1.3.1",
            quoteUnits: 100000,
            quoteAssetId: "1.3.0"
        },
        mcrPermille: 1750
    };

    it("computes the collateral ratio at the feed and the distance to the call", () => {
        const r = positionRisk(base);
        expect(r.ratio).toBeCloseTo(3.17, 2);
        expect(r.mcr).toBe(1.75);
        expect(r.distance).toBeCloseTo(1 - 1.75 / 3.17, 3);
        expect(r.risk).toBe("ok");
    });

    it("reads a feed stated the other way round", () => {
        const flipped = {
            ...base,
            feed: {
                baseUnits: 100000,
                baseAssetId: "1.3.0",
                quoteUnits: 634,
                quoteAssetId: "1.3.1"
            }
        };
        expect(positionRisk(flipped).ratio).toBeCloseTo(3.17, 2);
    });

    it("flags watch, danger and called", () => {
        // ratio 2.0 -> distance 12.5%
        const watch = positionRisk({...base, collateralUnits: 315457413});
        expect(watch.ratio).toBeCloseTo(2.0, 1);
        expect(watch.risk).toBe("watch");
        // ratio 1.9 -> distance ~7.9%
        const danger = positionRisk({...base, collateralUnits: 299684542});
        expect(danger.risk).toBe("danger");
        // below the maintenance ratio: already called
        const called = positionRisk({...base, collateralUnits: 200000000});
        expect(called.distance).toBeLessThan(0);
        expect(called.risk).toBe("danger");
    });

    it("says nothing it does not know", () => {
        expect(positionRisk({...base, feed: null}).ratio).toBeNull();
        expect(positionRisk({...base, debtUnits: 0}).ratio).toBeNull();
        const noMcr = positionRisk({...base, mcrPermille: null});
        expect(noMcr.ratio).not.toBeNull();
        expect(noMcr.distance).toBeNull();
    });
});

describe("orders", () => {
    const now = Date.UTC(2026, 9, 14, 12, 0, 0);

    it("treats the chain's far-future time as no expiry", () => {
        expect(expiryMs("2106-02-07T06:28:15")).toBeNull();
        expect(expiryMs("2026-10-15T00:00:00")).toBe(
            Date.UTC(2026, 9, 15, 0, 0, 0)
        );
        expect(expiryMs("")).toBeNull();
    });

    it("counts, finds the next expiry and the ones within a day", () => {
        const s = orderSummary(
            [
                {id: "1.7.1", expiration: "2106-02-07T06:28:15"},
                {id: "1.7.2", expiration: "2026-10-15T08:00:00"},
                {id: "1.7.3", expiration: "2026-10-20T08:00:00"}
            ],
            now
        );
        expect(s.count).toBe(3);
        expect(s.nextExpiryMs).toBe(Date.UTC(2026, 9, 15, 8, 0, 0));
        expect(s.expiringSoon).toBe(1);
    });
});

describe("attentionItems", () => {
    it("orders by urgency and drops what is fine", () => {
        const items = attentionItems({
            risks: [
                {
                    id: "a",
                    symbol: "USD",
                    ratio: 3,
                    mcr: 1.75,
                    distance: 0.4,
                    risk: "ok"
                },
                {
                    id: "b",
                    symbol: "CNY",
                    ratio: 2,
                    mcr: 1.75,
                    distance: 0.12,
                    risk: "watch"
                },
                {
                    id: "c",
                    symbol: "EUR",
                    ratio: 1.5,
                    mcr: 1.75,
                    distance: -0.1,
                    risk: "danger"
                }
            ],
            expiringOrders: 2,
            blockAgeSeconds: 400
        });
        expect(items.map(i => i.kind)).toEqual([
            "called",
            "margin",
            "stale",
            "expiring"
        ]);
        expect(items[0].level).toBe("danger");
        expect(items[2].params.minutes).toBe(6);
    });

    it("is empty when all is well", () => {
        expect(
            attentionItems({
                risks: [],
                expiringOrders: 0,
                blockAgeSeconds: 3
            })
        ).toEqual([]);
    });
});
