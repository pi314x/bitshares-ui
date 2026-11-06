import {
    DCA_SLIPPAGE_PERCENT,
    MAX_ORDERS,
    OrderPlan,
    TestedStrategy,
    orderOperations,
    placementGate,
    planOrders,
    specKey
} from "../../lib/common/strategyOrders";
import {StrategySpec, Summary} from "../../lib/common/strategies";

const BTS = {id: "1.3.0", symbol: "BTS", precision: 5};
const USD = {id: "1.3.121", symbol: "USD", precision: 4};

const spec = (over: Partial<StrategySpec> = {}): StrategySpec => ({
    kind: "grid",
    grid: {
        lower: 90,
        upper: 110,
        lines: 3,
        spacing: "arithmetic",
        investment: 1000
    },
    maker: {spreadPercent: 2, size: 1, investment: 1000, requoteEvery: 1},
    dca: {amount: 100, everyHours: 24},
    costs: {feePercent: 0, orderFee: 0},
    ...over
});

// plenty of both
const RICH = {trade: BigInt("1000000000000"), priced: BigInt("1000000000000")};
const plan = (s: StrategySpec, price = 100, holdings = RICH): OrderPlan => {
    const result = planOrders(s, BTS, USD, price, holdings);
    if (!result.ok) throw new Error(result.error);
    return result.plan;
};

// human amount of units
const human = (units: bigint, precision: number) =>
    Number(units) / Math.pow(10, precision);

describe("lib/common/strategyOrders", () => {
    describe("planOrders", () => {
        it("places a grid's buys under the price and its sells over it, on the lines, with the size the engine sized", () => {
            const p = plan(spec());
            // lines 90 100 110 at price 100: a buy at 90, a sell at 110 (the held step sells at the line above it)
            expect(p.orders.map(o => [o.side, o.price])).toEqual([
                ["sell", 110],
                ["buy", 90]
            ]);
            const unit = 1000 / 190;
            const sell = p.orders[0];
            expect(sell.sell.asset).toBe(BTS.id);
            expect(sell.receive.asset).toBe(USD.id);
            expect(human(sell.sell.amount, 5)).toBeCloseTo(unit, 5);
            expect(human(sell.receive.amount, 4)).toBeCloseTo(110 * unit, 3);
            const buy = p.orders[1];
            expect(buy.sell.asset).toBe(USD.id);
            expect(buy.receive.asset).toBe(BTS.id);
            expect(human(buy.receive.amount, 5)).toBeCloseTo(unit, 5);
            expect(human(buy.sell.amount, 4)).toBeCloseTo(90 * unit, 3);
            expect(p.skipped).toEqual([]);
        });

        it("never lets a buy pay more than its line or a sell take less, whatever the rounding", () => {
            // odd sizes and prices, precisions that differ: check every order against its own line
            const odd = spec({
                grid: {
                    lower: 0.0123456,
                    upper: 0.0456789,
                    lines: 12,
                    spacing: "geometric",
                    investment: 777.77
                }
            });
            const p = plan(odd, 0.031);
            expect(p.orders.length).toBeGreaterThan(5);
            p.orders.forEach(o => {
                const sellHuman = human(
                    o.sell.amount,
                    o.sell.asset === BTS.id ? 5 : 4
                );
                const receiveHuman = human(
                    o.receive.amount,
                    o.receive.asset === BTS.id ? 5 : 4
                );
                if (o.side === "buy") {
                    // pays priced, gets trade: the price paid is priced / trade, at most the line
                    expect(sellHuman / receiveHuman).toBeLessThanOrEqual(
                        o.price * (1 + 1e-12)
                    );
                } else {
                    // gives trade, gets priced: at least the line
                    expect(receiveHuman / sellHuman).toBeGreaterThanOrEqual(
                        o.price * (1 - 1e-12)
                    );
                }
            });
        });

        it("places a market maker's bid and ask around the price", () => {
            const p = plan(spec({kind: "maker"}));
            expect(p.orders.map(o => [o.side, o.price])).toEqual([
                ["sell", 101],
                ["buy", 99]
            ]);
            // a size of 1 BTS: sells 1 BTS for at least 101 USD, buys 1 BTS for at most 99 USD
            expect(p.orders[0].sell.amount).toBe(BigInt(100000));
            expect(p.orders[0].receive.amount).toBe(BigInt(1010000));
            expect(p.orders[1].receive.amount).toBe(BigInt(100000));
            expect(p.orders[1].sell.amount).toBe(BigInt(990000));
        });

        it("places one buy for a DCA, up to a limit over the price, paying the amount", () => {
            const p = plan(spec({kind: "dca"}));
            expect(p.orders).toHaveLength(1);
            const o = p.orders[0];
            const limit = 100 * (1 + DCA_SLIPPAGE_PERCENT / 100);
            expect(o.side).toBe("buy");
            expect(o.price).toBeCloseTo(limit, 9);
            expect(o.sell).toEqual({asset: USD.id, amount: BigInt(1000000)});
            // 100 USD at 101 or better: at least 0.99009901 BTS
            expect(human(o.receive.amount, 5)).toBeGreaterThanOrEqual(
                100 / limit
            );
            expect(human(o.receive.amount, 5)).toBeLessThan(100 / limit + 1e-5);
        });

        it("funds the orders nearest the price first and says which it left out for want of funds", () => {
            // a grid of ten lines: buys under 100, sells over it
            const g = spec({
                grid: {
                    lower: 50,
                    upper: 150,
                    lines: 11,
                    spacing: "arithmetic",
                    investment: 1000
                }
            });
            const all = plan(g);
            expect(all.skipped).toEqual([]);
            const buys = all.orders.filter(o => o.side === "buy");
            expect(buys.length).toBe(5);
            // priced for only three of the five buys: the nearest three
            const three = buys
                .sort((a, b) => b.price - a.price)
                .slice(0, 3)
                .reduce((sum, o) => sum + o.sell.amount, BigInt(0));
            const short = plan(g, 100, {trade: RICH.trade, priced: three});
            const placed = short.orders.filter(o => o.side === "buy");
            expect(placed.map(o => o.price)).toEqual([90, 80, 70]);
            expect(short.skipped.map(s => [s.side, s.price, s.reason])).toEqual(
                expect.arrayContaining([
                    ["buy", 60, "funds"],
                    ["buy", 50, "funds"]
                ])
            );
            expect(short.spends.priced).toBe(three);
        });

        it("leaves out the sells when none of the trade asset is held", () => {
            const p = plan(spec(), 100, {
                trade: BigInt(0),
                priced: RICH.priced
            });
            expect(p.orders.map(o => o.side)).toEqual(["buy"]);
            expect(p.skipped.map(s => [s.side, s.reason])).toEqual([
                ["sell", "funds"]
            ]);
            expect(p.spends.trade).toBe(BigInt(0));
        });

        it("leaves out an order that rounds to nothing", () => {
            const tiny = spec({
                kind: "maker",
                maker: {...spec().maker, size: 0.000001}
            });
            const p = plan(tiny);
            expect(p.orders).toEqual([]);
            expect(p.skipped.map(s => s.reason)).toEqual(["tiny", "tiny"]);
        });

        it("adds up what the orders spend", () => {
            const p = plan(spec({kind: "maker"}));
            expect(p.spends).toEqual({
                trade: BigInt(100000),
                priced: BigInt(990000)
            });
        });

        it("refuses what it cannot place: a spec that cannot run, no price, too many orders, amounts too large", () => {
            const bad = (s: StrategySpec, price = 100) =>
                planOrders(s, BTS, USD, price, RICH);
            expect(bad(spec({costs: {feePercent: 90, orderFee: 0}}))).toEqual({
                ok: false,
                error: "spec"
            });
            expect(bad(spec(), 0)).toEqual({ok: false, error: "price"});
            expect(bad(spec(), NaN)).toEqual({ok: false, error: "price"});
            const many = spec({
                grid: {...spec().grid, lines: MAX_ORDERS + 2}
            });
            expect(bad(many)).toEqual({ok: false, error: "too_many"});
            const huge = spec({
                kind: "maker",
                maker: {...spec().maker, size: 1e30, investment: 1e31}
            });
            expect(bad(huge)).toEqual({ok: false, error: "range"});
        });
    });

    describe("orderOperations", () => {
        it("is a limit_order_create for each order, for the account, with the amounts as the chain takes them", () => {
            const p = plan(spec({kind: "maker"}));
            const expiration = new Date(Date.UTC(2026, 11, 4, 12, 30, 45, 999));
            const ops = orderOperations(p, "1.2.77", expiration);
            expect(ops).toHaveLength(2);
            expect(ops[0]).toEqual([
                "limit_order_create",
                {
                    fee: {amount: 0, asset_id: "1.3.0"},
                    seller: "1.2.77",
                    amount_to_sell: {amount: "100000", asset_id: BTS.id},
                    min_to_receive: {amount: "1010000", asset_id: USD.id},
                    expiration: "2026-12-04T12:30:45",
                    fill_or_kill: false,
                    extensions: []
                }
            ]);
            expect(ops[1][1].amount_to_sell).toEqual({
                amount: "990000",
                asset_id: USD.id
            });
        });
    });

    describe("placementGate", () => {
        const summary = (over: Partial<Summary> = {}): Summary => ({
            equity: 1010,
            capital: 1000,
            pnl: 10,
            pnlPercent: 1,
            fees: 1,
            fills: 4,
            holdPnl: 5,
            holdPercent: 0.5,
            ...over
        });
        const tested = (
            over: Partial<TestedStrategy> = {}
        ): TestedStrategy => ({
            spec: spec(),
            tradeId: BTS.id,
            pricedId: USD.id,
            summary: summary(),
            candles: 100,
            ...over
        });
        const gate = (t: TestedStrategy | null, s = spec()) =>
            placementGate(t, s, BTS.id, USD.id);

        it("lets a strategy through that was tested as it is and ended in profit after fees", () => {
            expect(gate(tested())).toEqual({ok: true});
        });

        it("wants a test first", () => {
            expect(gate(null)).toEqual({ok: false, reason: "no_test"});
        });

        it("wants the same market", () => {
            expect(placementGate(tested(), spec(), BTS.id, "1.3.5")).toEqual({
                ok: false,
                reason: "market"
            });
            expect(placementGate(tested(), spec(), null, null)).toEqual({
                ok: false,
                reason: "market"
            });
        });

        it("wants the same settings: a change of any number of the strategy, or of the fees, needs a new test", () => {
            const changed = (s: StrategySpec) => gate(tested(), s);
            expect(changed(spec({grid: {...spec().grid, lines: 4}}))).toEqual({
                ok: false,
                reason: "changed"
            });
            expect(
                changed(spec({grid: {...spec().grid, spacing: "geometric"}}))
            ).toEqual({ok: false, reason: "changed"});
            expect(
                changed(spec({costs: {feePercent: 0.2, orderFee: 0}}))
            ).toEqual({ok: false, reason: "changed"});
            expect(changed(spec({kind: "maker"}))).toEqual({
                ok: false,
                reason: "changed"
            });
        });

        it("does not mind a change in the settings of a kind that is not the strategy", () => {
            expect(
                gate(
                    tested(),
                    spec({maker: {...spec().maker, spreadPercent: 9}})
                )
            ).toEqual({ok: true});
        });

        it("wants a test that traded and ended in profit", () => {
            expect(gate(tested({summary: summary({pnl: -1})}))).toEqual({
                ok: false,
                reason: "loss"
            });
            expect(gate(tested({summary: summary({pnl: 0})}))).toEqual({
                ok: false,
                reason: "loss"
            });
            expect(gate(tested({summary: summary({fills: 0})}))).toEqual({
                ok: false,
                reason: "no_fills"
            });
            // a DCA's first buy is a fill at once: it needs a second
            const dca = spec({kind: "dca"});
            expect(
                gate(tested({spec: dca, summary: summary({fills: 1})}), dca)
            ).toEqual({ok: false, reason: "no_fills"});
            expect(
                gate(tested({spec: dca, summary: summary({fills: 2})}), dca)
            ).toEqual({ok: true});
        });

        it("is not for a grid with more orders than one placement holds", () => {
            const big = spec({grid: {...spec().grid, lines: MAX_ORDERS + 2}});
            expect(gate(tested({spec: big}), big)).toEqual({
                ok: false,
                reason: "too_many"
            });
            const edge = spec({grid: {...spec().grid, lines: MAX_ORDERS + 1}});
            expect(gate(tested({spec: edge}), edge)).toEqual({ok: true});
        });

        it("names a strategy by its kind, its settings and its fees only", () => {
            expect(specKey(spec())).toBe(
                specKey(spec({maker: {...spec().maker, size: 5}}))
            );
            expect(specKey(spec())).not.toBe(specKey(spec({kind: "dca"})));
        });
    });
});
