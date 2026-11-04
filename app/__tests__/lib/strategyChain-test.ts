const mockExec = jest.fn();
jest.mock("bitsharesjs-ws", () => ({
    Apis: {instance: () => ({db_api: () => ({exec: mockExec})})}
}));

import {
    DCA_ORDER_DAYS,
    ORDER_DAYS,
    loadHeldAssets,
    loadHoldings,
    loadOrderFees,
    reviewOrders
} from "../../lib/chain/strategyChain";
import {StrategySpec} from "../../lib/common/strategies";

beforeEach(() => mockExec.mockReset());

describe("loadHoldings", () => {
    it("reads the balances of the assets asked for as big numbers, and none for an asset not held", async () => {
        mockExec.mockResolvedValue([
            {amount: "123456789012345678", asset_id: "1.3.0"}
        ]);
        const held = await loadHoldings("1.2.5", ["1.3.0", "1.3.121"]);
        expect(mockExec).toHaveBeenCalledWith("get_account_balances", [
            "1.2.5",
            ["1.3.0", "1.3.121"]
        ]);
        expect(held.get("1.3.0")).toBe(BigInt("123456789012345678"));
        expect(held.get("1.3.121")).toBe(BigInt(0));
    });

    it("leaves out rows that are not balances", async () => {
        mockExec.mockResolvedValue([
            null,
            {amount: "x", asset_id: "1.3.0"},
            {amount: "5", asset_id: 3},
            {amount: 7, asset_id: "1.3.2"}
        ]);
        const held = await loadHoldings("1.2.5");
        expect(Array.from(held.entries())).toEqual([["1.3.2", BigInt(7)]]);
    });
});

describe("loadOrderFees", () => {
    const op = ["limit_order_create", {fee: {amount: 0, asset_id: "1.3.0"}}];

    it("adds up the fee of each order, asked for as operation 1 in the core asset", async () => {
        mockExec.mockResolvedValue([
            {amount: 48260, asset_id: "1.3.0"},
            {amount: "48260", asset_id: "1.3.0"}
        ]);
        expect(await loadOrderFees([op as any, op as any])).toBe(BigInt(96520));
        expect(mockExec).toHaveBeenCalledWith("get_required_fees", [
            [
                [1, op[1]],
                [1, op[1]]
            ],
            "1.3.0"
        ]);
    });

    it("is null when the node's answer is not what was asked, and nothing for no orders", async () => {
        mockExec.mockResolvedValue([{amount: 1, asset_id: "1.3.0"}]);
        expect(await loadOrderFees([op as any, op as any])).toBeNull();
        mockExec.mockResolvedValue([{amount: 1, asset_id: "1.3.5"}]);
        expect(await loadOrderFees([op as any])).toBeNull();
        mockExec.mockResolvedValue([{amount: "x", asset_id: "1.3.0"}]);
        expect(await loadOrderFees([op as any])).toBeNull();
        mockExec.mockClear();
        expect(await loadOrderFees([])).toBe(BigInt(0));
        expect(mockExec).not.toHaveBeenCalled();
    });
});

describe("loadHeldAssets", () => {
    it("names the assets the account holds some of", async () => {
        mockExec.mockImplementation(async (method: string) =>
            method === "get_account_balances"
                ? [
                      {amount: "10", asset_id: "1.3.0"},
                      {amount: "0", asset_id: "1.3.5"},
                      {amount: "3", asset_id: "1.3.121"}
                  ]
                : [
                      {id: "1.3.0", symbol: "BTS", precision: 5},
                      {id: "1.3.121", symbol: "USD", precision: 4},
                      null,
                      {id: "1.3.9", symbol: 5}
                  ]
        );
        expect(await loadHeldAssets("1.2.5")).toEqual([
            {id: "1.3.0", symbol: "BTS", precision: 5},
            {id: "1.3.121", symbol: "USD", precision: 4}
        ]);
        const lookup = mockExec.mock.calls.find(
            c => c[0] === "lookup_asset_symbols"
        );
        expect(lookup![1]).toEqual([["1.3.0", "1.3.121"]]);
    });

    it("is nothing for an account that holds nothing, and asks for no symbols", async () => {
        mockExec.mockResolvedValue([]);
        expect(await loadHeldAssets("1.2.5")).toEqual([]);
        expect(mockExec).toHaveBeenCalledTimes(1);
    });
});

describe("reviewOrders", () => {
    const BTS = {id: "1.3.0", symbol: "BTS", precision: 5};
    const USD = {id: "1.3.121", symbol: "USD", precision: 4};
    const spec = (kind: StrategySpec["kind"] = "maker"): StrategySpec => ({
        kind,
        grid: {
            lower: 90,
            upper: 110,
            lines: 3,
            spacing: "arithmetic",
            investment: 1000
        },
        maker: {spreadPercent: 2, size: 1, investment: 1000, requoteEvery: 1},
        dca: {amount: 100, everyHours: 24},
        costs: {feePercent: 0, orderFee: 0}
    });
    // an account with these balances (units); each order costs 48260 units of the core asset
    const chain = (balances: Record<string, string>, fee = 48260) =>
        mockExec.mockImplementation(async (method: string, params: any[]) => {
            if (method === "get_account_balances") {
                return Object.entries(balances).map(([asset_id, amount]) => ({
                    asset_id,
                    amount
                }));
            }
            if (method === "get_required_fees") {
                return (params[0] as any[]).map(() => ({
                    amount: fee,
                    asset_id: "1.3.0"
                }));
            }
            throw new Error(method);
        });
    const NOW = new Date(Date.UTC(2026, 10, 4));
    const review = (over: object = {}, s = spec()) =>
        reviewOrders({
            spec: s,
            trade: BTS,
            priced: USD,
            price: 100,
            accountId: "1.2.5",
            now: NOW,
            ...over
        });

    it("plans the orders from what the account holds, with the fee of all of them", async () => {
        chain({"1.3.0": "1000000000", "1.3.121": "100000000"});
        const result = await review();
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.review.plan.orders.map(o => o.side)).toEqual([
            "sell",
            "buy"
        ]);
        expect(result.review.operations).toHaveLength(2);
        expect(result.review.fee).toBe(BigInt(96520));
        expect(result.review.shortOfCore).toBe(false);
        expect(result.review.price).toBe(100);
        // the orders stay 30 days
        expect(result.review.expiration.getTime()).toBe(
            NOW.getTime() + ORDER_DAYS * 24 * 3600 * 1000
        );
        expect(result.review.operations[0][1].expiration).toBe(
            "2026-12-04T00:00:00"
        );
    });

    it("a DCA buy stays one day", async () => {
        chain({"1.3.0": "1000000000", "1.3.121": "100000000"});
        const result = await review({}, spec("dca"));
        if (!result.ok) throw new Error(result.error);
        expect(result.review.expiration.getTime()).toBe(
            NOW.getTime() + DCA_ORDER_DAYS * 24 * 3600 * 1000
        );
    });

    it("says the account is short of the core asset for the fee", async () => {
        // BTS is the trade asset: 0.1 BTS cannot fund the ask (1 BTS), the bid can be funded, but its fee is 0.48 BTS
        chain({"1.3.0": "10000", "1.3.121": "100000000"});
        const result = await review();
        if (!result.ok) throw new Error(result.error);
        expect(result.review.plan.orders.map(o => o.side)).toEqual(["buy"]);
        expect(result.review.fee).toBe(BigInt(48260));
        expect(result.review.shortOfCore).toBe(true);
        // enough for that one fee: not short
        chain({"1.3.0": "60000", "1.3.121": "100000000"});
        const enough = await review();
        if (!enough.ok) throw new Error(enough.error);
        expect(enough.review.shortOfCore).toBe(false);
    });

    it("keeps the fee back where the core asset is one of the two, so that the orders do not spend it", async () => {
        // exactly the 1 BTS the ask sells: the fee has to come from somewhere else, so the ask is left out
        chain({"1.3.0": "100000", "1.3.121": "100000000"});
        const result = await review();
        if (!result.ok) throw new Error(result.error);
        expect(
            result.review.plan.skipped.map(s => [s.side, s.reason])
        ).toEqual([["sell", "funds"]]);
        // with the fee of both orders on top it is funded (the fee is kept back for both before the ask is counted)
        chain({"1.3.0": "196520", "1.3.121": "100000000"});
        const funded = await review();
        if (!funded.ok) throw new Error(funded.error);
        expect(funded.review.plan.orders.map(o => o.side)).toEqual([
            "sell",
            "buy"
        ]);
    });

    it("has no orders to place when nothing can be funded", async () => {
        chain({"1.3.0": "0", "1.3.121": "0"});
        expect(await review()).toEqual({ok: false, error: "no_orders"});
    });

    it("passes on a plan that cannot be made", async () => {
        chain({"1.3.0": "100000", "1.3.121": "100000000"});
        expect(await review({price: 0})).toEqual({ok: false, error: "price"});
    });

    it("does not say the account is short when the node gives no fee", async () => {
        mockExec.mockImplementation(async (method: string) =>
            method === "get_account_balances"
                ? [{asset_id: "1.3.121", amount: "100000000"}]
                : []
        );
        const result = await review();
        if (!result.ok) throw new Error(result.error);
        expect(result.review.fee).toBeNull();
        expect(result.review.shortOfCore).toBe(false);
    });
});
