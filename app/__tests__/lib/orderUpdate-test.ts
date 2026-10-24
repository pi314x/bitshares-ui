import "../../lib/chain/extraOperations";
import {ops} from "bitsharesjs";
import {
    OrderFacts,
    chainTime,
    currentPrice,
    planOrderUpdate,
    toUnits
} from "../../lib/common/orderUpdate";

// 10 BTS (precision 5) on offer for 5 USD (precision 4): 0.5 USD per BTS
const facts: OrderFacts = {
    sellAssetId: "1.3.0",
    receiveAssetId: "1.3.121",
    sellPrecision: 5,
    receivePrecision: 4,
    forSale: 1000000,
    priceBase: 1000000,
    priceQuote: 50000
};
const now = Date.UTC(2030, 0, 1, 0, 0, 0);
const base = {seller: "1.2.100", orderId: "1.7.9", facts, now};

describe("currentPrice / toUnits / chainTime", () => {
    it("reads the order's price in human figures", () => {
        expect(currentPrice(facts)).toBeCloseTo(0.5, 12);
    });

    it("turns a human amount into whole steps, or says it is not one", () => {
        expect(toUnits(1.23456, 5)).toBe(123456);
        expect(toUnits(0.1 + 0.2, 5)).toBe(30000);
        expect(toUnits(-1, 5)).toBeNull();
        expect(toUnits(NaN, 5)).toBeNull();
        expect(toUnits(1e20, 5)).toBeNull();
    });

    it("writes a time the way the chain does", () => {
        expect(chainTime(now)).toBe("2030-01-01T00:00:00");
    });
});

describe("planOrderUpdate", () => {
    it("is nothing when nothing is changed", () => {
        expect(
            planOrderUpdate({
                ...base,
                amount: null,
                price: null,
                expiresIn: null
            })
        ).toEqual({ok: false, error: "nothing_changed"});
        // the same figures typed again are no change either
        expect(
            planOrderUpdate({...base, amount: 10, price: 0.5, expiresIn: null})
        ).toEqual({ok: false, error: "nothing_changed"});
    });

    it("sends the change of amount, not the new amount", () => {
        const plan = planOrderUpdate({
            ...base,
            amount: 12.5,
            price: null,
            expiresIn: null
        });
        expect(plan.ok && plan.op.delta_amount_to_sell).toEqual({
            amount: 250000,
            asset_id: "1.3.0"
        });
        expect(plan.ok && plan.op.new_price).toBeUndefined();
        const smaller = planOrderUpdate({
            ...base,
            amount: 4,
            price: null,
            expiresIn: null
        });
        expect(smaller.ok && smaller.op.delta_amount_to_sell?.amount).toBe(
            -600000
        );
    });

    it("sends a new price on the amount the order will hold", () => {
        const plan = planOrderUpdate({
            ...base,
            amount: 8,
            price: 0.75,
            expiresIn: null
        });
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        // base = the new amount (8 BTS), quote = 8 * 0.75 = 6 USD
        expect(plan.op.new_price).toEqual({
            base: {amount: 800000, asset_id: "1.3.0"},
            quote: {amount: 60000, asset_id: "1.3.121"}
        });
        expect(plan.receiveUnits).toBe(60000);
    });

    it("keeps the assets of the order in a new price and its base within the amount", () => {
        const plan = planOrderUpdate({
            ...base,
            amount: null,
            price: 0.6,
            expiresIn: null
        });
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        expect(plan.op.new_price?.base.asset_id).toBe(facts.sellAssetId);
        expect(plan.op.new_price?.quote.asset_id).toBe(facts.receiveAssetId);
        expect(plan.op.new_price?.base.amount).toBeLessThanOrEqual(
            facts.forSale
        );
    });

    it("sets an expiration from now", () => {
        const plan = planOrderUpdate({
            ...base,
            amount: null,
            price: null,
            expiresIn: 86400
        });
        expect(plan.ok && plan.op.new_expiration).toBe("2030-01-02T00:00:00");
    });

    it("refuses what the chain would", () => {
        expect(
            planOrderUpdate({...base, amount: 0, price: null, expiresIn: null})
        ).toEqual({ok: false, error: "amount_invalid"});
        expect(
            planOrderUpdate({...base, amount: null, price: -1, expiresIn: null})
        ).toEqual({ok: false, error: "price_invalid"});
        expect(
            planOrderUpdate({
                ...base,
                amount: null,
                price: 1e-12,
                expiresIn: null
            })
        ).toEqual({ok: false, error: "too_small"});
    });

    it("builds an operation the serializer takes", () => {
        const plan = planOrderUpdate({
            ...base,
            amount: 8,
            price: 0.75,
            expiresIn: 3600
        });
        expect(plan.ok).toBe(true);
        if (!plan.ok) return;
        const operation = (ops as any).operation;
        const back = operation.toObject(operation.fromObject([77, plan.op]));
        expect(back[0]).toBe(77);
        expect(back[1].order).toBe("1.7.9");
        expect(back[1].new_expiration).toBe("2030-01-01T01:00:00");
    });
});
