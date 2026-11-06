import {
    Candle,
    DcaState,
    GridState,
    MakerState,
    StrategySpec,
    backtest,
    dcaCalc,
    gridCalc,
    gridLines,
    makerCalc,
    specError,
    startState,
    stepCandle,
    summarize
} from "../../lib/common/strategies";

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

const HOUR = 3600 * 1000;
const candle = (
    t: number,
    open: number,
    high: number,
    low: number,
    close: number
): Candle => ({t, open, high, low, close});

describe("lib/common/strategies", () => {
    describe("specError", () => {
        it("accepts a spec that can run", () => {
            (["grid", "maker", "dca"] as const).forEach(kind =>
                expect(specError(spec({kind}))).toBeNull()
            );
        });

        it("names what is wrong with the fees", () => {
            const bad = (feePercent: number, orderFee: number) =>
                specError(spec({costs: {feePercent, orderFee}}));
            expect(bad(-1, 0)).toBe("fee");
            expect(bad(50, 0)).toBe("fee");
            expect(bad(NaN, 0)).toBe("fee");
            expect(bad(0, -0.1)).toBe("fee");
            expect(bad(0.1, 0.2)).toBeNull();
        });

        it("names what is wrong with a grid: the range, the lines, the funds", () => {
            const grid = (over: object) =>
                specError(spec({grid: {...spec().grid, ...over}}));
            expect(grid({lower: 0})).toBe("grid_range");
            expect(grid({lower: 110})).toBe("grid_range");
            expect(grid({upper: NaN})).toBe("grid_range");
            expect(grid({lines: 1})).toBe("grid_lines");
            expect(grid({lines: 2.5})).toBe("grid_lines");
            expect(grid({lines: 201})).toBe("grid_lines");
            expect(grid({investment: 0})).toBe("grid_investment");
            // the funds do not even pay the network fees of the first orders
            expect(
                specError(
                    spec({
                        grid: {...spec().grid, investment: 1},
                        costs: {feePercent: 0, orderFee: 1}
                    })
                )
            ).toBe("grid_investment");
        });

        it("names what is wrong with a market maker and a DCA", () => {
            const maker = (over: object) =>
                specError(
                    spec({kind: "maker", maker: {...spec().maker, ...over}})
                );
            expect(maker({spreadPercent: 0})).toBe("maker_spread");
            expect(maker({spreadPercent: 100})).toBe("maker_spread");
            expect(maker({size: 0})).toBe("maker_size");
            expect(maker({investment: -5})).toBe("maker_investment");
            expect(maker({requoteEvery: 0})).toBe("maker_requote");
            expect(maker({requoteEvery: 1.5})).toBe("maker_requote");
            const dca = (over: object) =>
                specError(spec({kind: "dca", dca: {...spec().dca, ...over}}));
            expect(dca({amount: 0})).toBe("dca_amount");
            expect(dca({everyHours: 0})).toBe("dca_every");
            // an amount that the network fee of the order takes whole
            expect(
                specError(
                    spec({
                        kind: "dca",
                        costs: {feePercent: 0, orderFee: 100}
                    })
                )
            ).toBe("dca_amount");
        });
    });

    describe("gridLines", () => {
        it("puts the lines evenly apart, or by the same ratio, from the lower price to the upper", () => {
            expect(gridLines(spec().grid)).toEqual([90, 100, 110]);
            const g = gridLines({
                lower: 100,
                upper: 400,
                lines: 3,
                spacing: "geometric",
                investment: 1
            });
            expect(g[0]).toBeCloseTo(100, 9);
            expect(g[1]).toBeCloseTo(200, 9);
            expect(g[2]).toBeCloseTo(400, 9);
            expect(
                gridLines({...spec().grid, lines: 11, spacing: "arithmetic"})
            ).toHaveLength(11);
        });
    });

    describe("a grid", () => {
        it("funds every step: buys at the lines under the price wait with cash, the asset for the lines over it is bought now", () => {
            const s = startState(spec(), 100, 0) as GridState;
            expect(s.kind).toBe("grid");
            expect(s.slots.map(x => x.holding)).toEqual([false, true]);
            // 1000 = 90 * size (cash) + 100 * size (inventory)
            expect(s.size).toBeCloseTo(1000 / 190, 9);
            expect(s.cash).toBeCloseTo((90 * 1000) / 190, 9);
            expect(s.asset).toBeCloseTo(1000 / 190, 9);
            expect(summarize(s, spec(), 100).equity).toBeCloseTo(1000, 9);
            expect(summarize(s, spec(), 100).pnl).toBeCloseTo(0, 9);
        });

        it("holds all asset under the range and all cash over it", () => {
            const under = startState(spec(), 80, 0) as GridState;
            expect(under.slots.every(x => x.holding)).toBe(true);
            expect(under.cash).toBe(0);
            const over = startState(spec(), 120, 0) as GridState;
            expect(over.slots.every(x => !x.holding)).toBe(true);
            expect(over.asset).toBe(0);
        });

        it("buys on the way down and sells on the way up, a pair earning the step between two lines", () => {
            const sp = spec();
            const s = startState(sp, 100, 0) as GridState;
            // 100 -> 90 -> 110 -> 100
            const events = stepCandle(s, sp, candle(1, 100, 110, 90, 100));
            expect(events.map(e => [e.side, e.price])).toEqual([
                ["buy", 90],
                ["sell", 100],
                ["sell", 110],
                ["buy", 100]
            ]);
            const unit = 1000 / 190;
            expect(events[1].profit).toBeCloseTo(10 * unit, 9);
            expect(events[2].profit).toBeCloseTo(10 * unit, 9);
            expect(s.cycles).toBe(2);
            expect(s.realized).toBeCloseTo(20 * unit, 9);
            const sum = summarize(s, sp, 100);
            expect(sum.pnl).toBeCloseTo(20 * unit, 9);
            expect(sum.fills).toBe(4);
            expect(sum.cycles).toBe(2);
        });

        it("fills nothing a candle does not reach, and a sell not on the way up", () => {
            const sp = spec();
            const s = startState(sp, 100, 0) as GridState;
            expect(stepCandle(s, sp, candle(1, 100, 105, 95, 100))).toEqual([]);
            // falling to the buy line sells nothing
            const down = stepCandle(s, sp, candle(2, 100, 100, 90, 90));
            expect(down.map(e => e.side)).toEqual(["buy"]);
        });

        it("fills the orders a gap between two candles jumps over", () => {
            const sp = spec();
            const s = startState(sp, 100, 0) as GridState;
            // the next candle opens at 85: the buy at 90 was passed through
            const events = stepCandle(s, sp, candle(1, 85, 86, 84, 85));
            expect(events.map(e => [e.side, e.price])).toEqual([["buy", 90]]);
        });

        it("takes the market fee out of what a fill receives, and the network fee for each order", () => {
            const sp = spec({costs: {feePercent: 1, orderFee: 0}});
            const s = startState(sp, 100, 0) as GridState;
            const unit = s.size;
            // buy at 90, sell at 100
            stepCandle(s, sp, candle(1, 100, 100, 90, 100));
            // spent 90 * unit, got unit * 0.99; sold for 100 * 0.99 * unit * 0.99
            const profit = unit * (100 * 0.99 * 0.99 - 90);
            expect(s.realized).toBeCloseTo(profit, 9);
            const withFee = spec({costs: {feePercent: 0, orderFee: 0.5}});
            const t = startState(withFee, 100, 0) as GridState;
            const before = t.fees;
            expect(before).toBeCloseTo(2 * 0.5, 9);
            stepCandle(t, withFee, candle(1, 100, 100, 90, 100));
            // a buy and a sell: two orders placed after them
            expect(t.fees - before).toBeCloseTo(2 * 0.5, 9);
        });

        it("cannot spend more than it has", () => {
            const sp = spec({
                grid: {...spec().grid, lines: 5},
                costs: {feePercent: 20, orderFee: 0}
            });
            const s = startState(sp, 120, 0) as GridState;
            // many pairs at a loss (the step is under the fees) drain the cash: it never goes below 0
            for (let i = 1; i <= 30; i++) {
                stepCandle(s, sp, candle(i, 100, 100, 90, 100));
                stepCandle(s, sp, candle(i, 100, 110, 100, 100));
            }
            expect(s.cash).toBeGreaterThanOrEqual(-1e-9);
        });
    });

    describe("a market maker", () => {
        const maker = (over: Partial<StrategySpec["maker"]> = {}) =>
            spec({kind: "maker", maker: {...spec().maker, ...over}});

        it("starts with half in the asset and quotes around the price", () => {
            const sp = maker();
            const s = startState(sp, 100, 0) as MakerState;
            expect(s.cash).toBeCloseTo(500, 9);
            expect(s.asset).toBeCloseTo(5, 9);
            expect(s.bid).toBeCloseTo(99, 9);
            expect(s.ask).toBeCloseTo(101, 9);
        });

        it("earns the spread when the price crosses both quotes", () => {
            const sp = maker();
            const s = startState(sp, 100, 0) as MakerState;
            // an up candle dips first: the bid at 99, then the ask at 101
            const events = stepCandle(s, sp, candle(1, 100, 102, 98, 100));
            expect(events.map(e => [e.side, e.price])).toEqual([
                ["buy", 99],
                ["sell", 101]
            ]);
            expect(summarize(s, sp, 100).pnl).toBeCloseTo(2, 9);
        });

        it("fills the ask first on a candle that rises first", () => {
            const sp = maker();
            const s = startState(sp, 100, 0) as MakerState;
            const events = stepCandle(s, sp, candle(1, 100, 102, 98, 99));
            expect(events.map(e => e.side)).toEqual(["sell", "buy"]);
        });

        it("does not fill a quote twice before it is placed again", () => {
            const sp = maker({requoteEvery: 3});
            const s = startState(sp, 100, 0) as MakerState;
            expect(
                stepCandle(s, sp, candle(1, 100, 102, 98, 100))
            ).toHaveLength(2);
            // the same swing again: the quotes are used up until the third candle
            expect(
                stepCandle(s, sp, candle(2, 100, 102, 98, 100))
            ).toHaveLength(0);
            expect(
                stepCandle(s, sp, candle(3, 100, 102, 98, 100))
            ).toHaveLength(0);
            // placed again around the last price at the start of the fourth
            expect(
                stepCandle(s, sp, candle(4, 100, 102, 98, 100))
            ).toHaveLength(2);
        });

        it("pays the network fee of the two orders each time it quotes again", () => {
            const sp = {
                ...maker(),
                costs: {feePercent: 0, orderFee: 1}
            };
            const s = startState(sp, 100, 0) as MakerState;
            const first = s.fees;
            expect(first).toBeCloseTo(2, 9);
            // (the first candle uses the quotes it began with)
            stepCandle(s, sp, candle(1, 100, 100.5, 99.5, 100));
            expect(s.fees).toBeCloseTo(first, 9);
            stepCandle(s, sp, candle(2, 100, 100.5, 99.5, 100));
            expect(s.fees).toBeCloseTo(first + 2, 9);
        });

        it("sells only what it holds and buys only what it can pay for", () => {
            const sp = maker({size: 100});
            const s = startState(sp, 100, 0) as MakerState;
            // 5 of the asset and 500 of cash against orders for 100
            const events = stepCandle(s, sp, candle(1, 100, 102, 98, 100));
            expect(events[0].side).toBe("buy");
            expect(events[0].size).toBeCloseTo(500 / 99, 9);
            // (then the ask is filled with all it holds, not with 100)
            expect(events[1].side).toBe("sell");
            expect(events[1].size).toBeCloseTo(5 + 500 / 99, 9);
            expect(s.asset).toBeCloseTo(0, 9);
            expect(s.cash).toBeCloseTo((5 + 500 / 99) * 101, 9);
        });
    });

    describe("a dollar-cost average", () => {
        const dca = (over: Partial<StrategySpec["dca"]> = {}) =>
            spec({kind: "dca", dca: {...spec().dca, ...over}});

        it("buys at once, then at each interval at the open of the candle", () => {
            const sp = dca();
            const s = startState(sp, 100, 0) as DcaState;
            expect(s.asset).toBeCloseTo(1, 9);
            expect(s.buys).toBe(1);
            expect(
                stepCandle(s, sp, candle(12 * HOUR, 120, 121, 119, 120))
            ).toEqual([]);
            const events = stepCandle(
                s,
                sp,
                candle(24 * HOUR, 125, 126, 124, 125)
            );
            expect(events).toEqual([
                {t: 24 * HOUR, side: "buy", price: 125, size: 100 / 125}
            ]);
            expect(s.buys).toBe(2);
            expect(s.asset).toBeCloseTo(1 + 0.8, 9);
        });

        it("buys for each interval that went by with no candle", () => {
            const sp = dca();
            const s = startState(sp, 100, 0) as DcaState;
            const events = stepCandle(s, sp, candle(72 * HOUR, 50, 50, 50, 50));
            expect(events).toHaveLength(3);
            expect(s.nextAt).toBe(96 * HOUR);
        });

        it("pays the network fee of each buy: it is part of what it put in and of the fees", () => {
            const sp = {
                ...dca(),
                costs: {feePercent: 1, orderFee: 2}
            };
            const s = startState(sp, 100, 0) as DcaState;
            // 100 bought for 100 + 2, and 1% of it (1) is the market fee
            expect(s.fees).toBeCloseTo(2 + 1, 9);
            expect(s.capital).toBeCloseTo(102, 9);
            stepCandle(s, sp, candle(24 * HOUR, 100, 100, 100, 100));
            expect(s.fees).toBeCloseTo(2 * (2 + 1), 9);
            expect(s.capital).toBeCloseTo(204, 9);
            expect(summarize(s, sp, 100).fees).toBeCloseTo(6, 9);
        });

        it("knows its average cost and the price it has to rise to, the fee of selling counted", () => {
            const sp = {
                ...dca(),
                costs: {feePercent: 1, orderFee: 0}
            };
            const s = startState(sp, 100, 0) as DcaState;
            stepCandle(s, sp, candle(24 * HOUR, 50, 50, 50, 50));
            const sum = summarize(s, sp, 50);
            // 200 spent for 0.99 + 1.98 of the asset
            expect(sum.capital).toBeCloseTo(200, 9);
            expect(sum.averageCost).toBeCloseTo(200 / 2.97, 9);
            expect(sum.breakEven).toBeCloseTo(200 / 2.97 / 0.99, 9);
            expect(sum.pnl).toBeCloseTo(2.97 * 50 - 200, 9);
        });
    });

    describe("summarize", () => {
        it("compares with putting the same funds into the asset at the start", () => {
            const sp = spec();
            const s = startState(sp, 100, 0) as GridState;
            const sum = summarize(s, sp, 120);
            expect(sum.holdPnl).toBeCloseTo(200, 9);
            expect(sum.holdPercent).toBeCloseTo(20, 9);
            // (the grid holds about half the asset: it earns about half of that)
            expect(sum.pnl).toBeGreaterThan(0);
            expect(sum.pnl).toBeLessThan(sum.holdPnl);
            const feed = spec({costs: {feePercent: 1, orderFee: 0}});
            expect(
                summarize(startState(feed, 100, 0), feed, 100).holdPnl
            ).toBeCloseTo(-10, 9);
        });
    });

    describe("backtest", () => {
        const swing = (n: number): Candle[] =>
            Array.from({length: n}, (_v, i) =>
                i % 2 === 0
                    ? candle(i * HOUR, 100, 101, 90, 91)
                    : candle(i * HOUR, 91, 110, 91, 100)
            );

        it("is nothing with no candles", () => {
            expect(backtest(spec(), [])).toBeNull();
        });

        it("runs from the first open and gives the same as stepping by hand", () => {
            const candles = swing(10);
            const result = backtest(spec(), candles)!;
            const sp = spec();
            const s = startState(sp, candles[0].open, candles[0].t);
            const events = candles.flatMap(c => stepCandle(s, sp, c));
            expect(result.events).toEqual(events);
            expect(result.summary).toEqual(
                summarize(s, sp, candles[candles.length - 1].close)
            );
            expect(result.candles).toBe(10);
            expect(result.from).toBe(0);
            expect(result.to).toBe(9 * HOUR);
            expect(result.summary.cycles).toBeGreaterThan(0);
        });

        it("keeps a few hundred points of the curve at most, the last one the end", () => {
            const candles = swing(1000);
            const result = backtest(spec(), candles)!;
            expect(result.curve.length).toBeLessThanOrEqual(241);
            expect(result.curve[result.curve.length - 1].t).toBe(999 * HOUR);
            expect(result.curve[result.curve.length - 1].pnl).toBeCloseTo(
                result.summary.pnl,
                9
            );
        });
    });

    describe("the calculators", () => {
        it("gives the earnings of a grid for a round of every step, and warns of steps under the fees", () => {
            const sp = spec();
            const calc = gridCalc(sp, 100);
            expect(calc.steps).toBe(2);
            expect(calc.stepMin).toBeCloseTo((110 / 100 - 1) * 100, 9);
            expect(calc.stepMax).toBeCloseTo((100 / 90 - 1) * 100, 9);
            expect(calc.below).toBe(1);
            expect(calc.above).toBe(1);
            expect(calc.inRange).toBe(true);
            expect(calc.losingSteps).toBe(0);
            // the same as the simulated round (buy at 90, sell at 100 and 110)
            const s = startState(sp, 100, 0) as GridState;
            stepCandle(s, sp, candle(1, 100, 110, 90, 100));
            expect(calc.perRound).toBeCloseTo(s.realized, 9);
            expect(calc.perStep).toBeCloseTo(calc.perRound / 2, 9);
            expect(calc.perRoundPercent).toBeCloseTo(
                (calc.perRound / 1000) * 100,
                9
            );
            const fee = {costs: {feePercent: 1, orderFee: 0}};
            expect(gridCalc(spec(fee), 100).breakEvenStep).toBeCloseTo(
                (1 / 0.9801 - 1) * 100,
                9
            );
            // steps of 1% against fees of 1% each way lose
            const tight = spec({
                grid: {...sp.grid, lower: 99, upper: 101, lines: 3},
                ...fee
            });
            expect(gridCalc(tight, 100).losingSteps).toBe(2);
            expect(gridCalc(sp, 200).inRange).toBe(false);
        });

        it("calculates a grid whatever kind is chosen", () => {
            const calc = gridCalc(spec({kind: "maker"}), 100);
            expect(calc.steps).toBe(2);
        });

        it("gives the earnings of a market maker's round trip, by day and by year", () => {
            const sp = spec({kind: "maker"});
            const calc = makerCalc(sp, 100, 4);
            // bid 99, ask 101
            expect(calc.trip).toBeCloseTo(2, 9);
            expect(calc.tripPercent).toBeCloseTo((2 / 99) * 100, 9);
            expect(calc.perDay).toBeCloseTo(8, 9);
            expect(calc.perDayPercent).toBeCloseTo(0.8, 9);
            expect(calc.yearlyPercent).toBeCloseTo(0.8 * 365, 6);
            // fees of 1% each way: the spread has to be over about 2%
            const fee = makerCalc(
                spec({kind: "maker", costs: {feePercent: 1, orderFee: 0}}),
                100,
                1
            );
            expect(fee.breakEvenSpread).toBeCloseTo(2.01, 3);
            const atBreakEven = makerCalc(
                spec({
                    kind: "maker",
                    maker: {...sp.maker, spreadPercent: fee.breakEvenSpread},
                    costs: {feePercent: 1, orderFee: 0}
                }),
                100,
                1
            );
            expect(atBreakEven.trip).toBeCloseTo(0, 9);
            // two network fees for a trip
            expect(
                makerCalc(
                    spec({
                        kind: "maker",
                        costs: {feePercent: 0, orderFee: 0.5}
                    }),
                    100,
                    1
                ).trip
            ).toBeCloseTo(1, 9);
        });

        it("gives what a number of DCA buys cost and how far the price has to rise", () => {
            const sp = spec({kind: "dca", costs: {feePercent: 1, orderFee: 0}});
            const calc = dcaCalc(sp, 50, 10);
            expect(calc.invested).toBeCloseTo(1000, 9);
            expect(calc.asset).toBeCloseTo((100 / 50) * 10 * 0.99, 9);
            expect(calc.fees).toBeCloseTo(10 * 100 * 0.01, 9);
            expect(calc.breakEvenRise).toBeCloseTo((1 / 0.9801 - 1) * 100, 9);
            const network = dcaCalc(
                spec({kind: "dca", costs: {feePercent: 0, orderFee: 1}}),
                50,
                10
            );
            expect(network.invested).toBeCloseTo(1010, 9);
            expect(network.breakEvenRise).toBeCloseTo(1, 9);
        });
    });
});
