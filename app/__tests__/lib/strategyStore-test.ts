import {
    KEY,
    MAX_EVENTS,
    MAX_STRATEGIES,
    RUN_SECONDS,
    SavedStrategy,
    advanceRun,
    candleOpen,
    newStrategyId,
    readStrategies,
    startRun,
    validRun,
    validSpec,
    validStrategy,
    writeStrategies
} from "../../lib/common/strategyStore";
import {Candle, StrategySpec} from "../../lib/common/strategies";

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

const strategy = (over: Partial<SavedStrategy> = {}): SavedStrategy => ({
    id: "s1",
    name: "My grid",
    trade: {id: "1.3.0", symbol: "BTS", precision: 5},
    priced: {id: "1.3.121", symbol: "USD", precision: 4},
    spec: spec(),
    savedAt: 5,
    ...over
});

const SECOND = 1000;
const candle = (
    t: number,
    open: number,
    high: number,
    low: number,
    close: number
): Candle => ({t, open, high, low, close});

function memory() {
    const map = new Map<string, string>();
    return {
        map,
        getItem: (k: string) => (map.has(k) ? (map.get(k) as string) : null),
        setItem: (k: string, v: string) => void map.set(k, v)
    };
}

describe("lib/common/strategyStore", () => {
    describe("what is kept", () => {
        it("reads back what was written, with a run in it", () => {
            const storage = memory();
            const run = startRun(spec(), 100, 1_000_000);
            expect(writeStrategies([strategy({run})], storage)).toBe(true);
            const back = readStrategies(storage);
            expect(back).toHaveLength(1);
            expect(back[0].run).toEqual(run);
            expect(back[0].spec).toEqual(spec());
        });

        it("keeps a run of each kind", () => {
            (["grid", "maker", "dca"] as const).forEach(kind => {
                const storage = memory();
                const sp = spec({kind});
                const run = startRun(sp, 100, 1_000_000);
                writeStrategies([strategy({spec: sp, run})], storage);
                expect(readStrategies(storage)[0].run).toEqual(run);
            });
        });

        it("is nothing where nothing is kept, or what is kept is not a list", () => {
            expect(readStrategies(null)).toEqual([]);
            expect(readStrategies(memory())).toEqual([]);
            const storage = memory();
            storage.map.set(KEY, "{not json");
            expect(readStrategies(storage)).toEqual([]);
            storage.map.set(KEY, '{"a":1}');
            expect(readStrategies(storage)).toEqual([]);
        });

        it("drops a strategy that cannot run, one twice, and what is past the limit", () => {
            const storage = memory();
            const broken = strategy({
                id: "s2",
                spec: spec({costs: {feePercent: 80, orderFee: 0}})
            });
            const same = strategy();
            const many = Array.from({length: MAX_STRATEGIES + 5}, (_v, i) =>
                strategy({id: `m${i}`})
            );
            storage.map.set(
                KEY,
                JSON.stringify([same, broken, same, ...many, 7, null])
            );
            const back = readStrategies(storage);
            expect(back).toHaveLength(MAX_STRATEGIES);
            expect(back.map(s => s.id)).not.toContain("s2");
            expect(back.filter(s => s.id === "s1")).toHaveLength(1);
        });

        it("drops a run that does not fit its spec but keeps the strategy", () => {
            const run = startRun(spec(), 100, 1_000_000);
            const raw = JSON.parse(JSON.stringify(strategy({run})));
            // the grid was changed to more lines after the run began
            raw.spec.grid.lines = 5;
            const kept = validStrategy(raw)!;
            expect(kept).not.toBeNull();
            expect(kept.run).toBeUndefined();
            // a number that is not one
            const bad = JSON.parse(JSON.stringify(strategy({run})));
            bad.run.state.cash = "lots";
            expect(validStrategy(bad)!.run).toBeUndefined();
            expect(validRun(null, spec())).toBeNull();
            const kind = JSON.parse(JSON.stringify(run));
            kind.state.kind = "dca";
            expect(validRun(kind, spec())).toBeNull();
        });

        it("needs a trade asset and a priced asset that differ and are real", () => {
            const raw = (over: object) => ({...strategy(), ...over});
            expect(validStrategy(raw({trade: {id: "x"}}))).toBeNull();
            expect(validStrategy(raw({priced: strategy().trade}))).toBeNull();
            expect(validStrategy(raw({id: ""}))).toBeNull();
            expect(validStrategy(raw({name: 5}))!.name).toBe("");
            expect(validStrategy(null)).toBeNull();
        });

        it("rebuilds a spec from numbers only", () => {
            expect(validSpec(spec())).toEqual(spec());
            expect(validSpec({...spec(), kind: "other"})).toBeNull();
            expect(
                validSpec({...spec(), grid: {...spec().grid, lower: "90"}})
            ).toBeNull();
            expect(validSpec(null)).toBeNull();
            // an unknown spacing is the geometric one
            expect(
                validSpec({...spec(), grid: {...spec().grid, spacing: "x"}})!
                    .grid.spacing
            ).toBe("geometric");
        });

        it("says false where nothing can be written", () => {
            expect(writeStrategies([strategy()], null)).toBe(false);
            expect(
                writeStrategies([strategy()], {
                    setItem: () => {
                        throw new Error("full");
                    }
                })
            ).toBe(false);
        });

        it("makes an id no other has", () => {
            const ids = new Set<string>();
            for (let i = 0; i < 50; i++) ids.add(newStrategyId(ids));
            expect(ids.size).toBe(50);
        });
    });

    describe("a paper run", () => {
        // 10:00:00 on a day
        const T0 = Date.UTC(2026, 10, 4, 10, 0, 0);

        it("begins in the candle it is started in and follows the ones after it", () => {
            const run = startRun(spec(), 100, T0 + 90 * SECOND);
            expect(run.seconds).toBe(RUN_SECONDS);
            expect(run.lastT).toBe(candleOpen(T0 + 90 * SECOND, RUN_SECONDS));
            expect(run.lastT).toBe(T0);
            expect(run.running).toBe(true);
            expect(run.events).toEqual([]);
        });

        it("processes the candles that closed, once each, in order", () => {
            const sp = spec();
            const run = startRun(sp, 100, T0 + 10 * SECOND);
            const candles = [
                // the candle it began in: not followed
                candle(T0, 100, 120, 80, 100),
                candle(T0 + 300 * SECOND, 100, 100, 90, 90),
                candle(T0 + 600 * SECOND, 90, 110, 90, 110)
            ];
            const now = T0 + 900 * SECOND;
            const next = advanceRun(run, sp, candles, now);
            expect(next.events.map(e => [e.side, e.price])).toEqual([
                ["buy", 90],
                ["sell", 100],
                ["sell", 110]
            ]);
            expect(next.lastT).toBe(T0 + 600 * SECOND);
            expect(next.price).toBe(110);
            // the run given is not changed, and the same candles again change nothing
            expect(run.events).toEqual([]);
            expect(run.lastT).toBe(T0);
            const again = advanceRun(next, sp, candles, now);
            expect(again.events).toEqual(next.events);
            expect(again.state).toEqual(next.state);
        });

        it("leaves a candle that is still open for the next time", () => {
            const sp = spec();
            const run = startRun(sp, 100, T0 + 10 * SECOND);
            const candles = [candle(T0 + 300 * SECOND, 100, 100, 90, 90)];
            // five seconds before it closes
            const early = advanceRun(run, sp, candles, T0 + 595 * SECOND);
            expect(early.events).toEqual([]);
            expect(early.lastT).toBe(T0);
            const closed = advanceRun(run, sp, candles, T0 + 600 * SECOND);
            expect(closed.events).toHaveLength(1);
        });

        it("keeps the last trades only", () => {
            const sp = spec();
            let run = startRun(sp, 100, T0);
            const candles: Candle[] = [];
            for (let i = 1; i <= 150; i++) {
                candles.push(
                    i % 2
                        ? candle(T0 + i * 300 * SECOND, 100, 100, 90, 90)
                        : candle(T0 + i * 300 * SECOND, 90, 100, 90, 100)
                );
            }
            run = advanceRun(run, sp, candles, T0 + 200 * 300 * SECOND);
            expect(run.events).toHaveLength(MAX_EVENTS);
            expect(run.lastT).toBe(T0 + 150 * 300 * SECOND);
        });

        it("goes on after a reload: what is kept and moved again gives what moving without the break gives", () => {
            const sp = spec();
            const candles = [
                candle(T0 + 300 * SECOND, 100, 100, 90, 90),
                candle(T0 + 600 * SECOND, 90, 110, 90, 110),
                candle(T0 + 900 * SECOND, 110, 110, 95, 95)
            ];
            const start = startRun(sp, 100, T0);
            const whole = advanceRun(start, sp, candles, T0 + 1200 * SECOND);
            const storage = memory();
            const half = advanceRun(
                start,
                sp,
                candles.slice(0, 1),
                T0 + 1200 * SECOND
            );
            writeStrategies([strategy({run: half})], storage);
            const back = readStrategies(storage)[0].run!;
            const resumed = advanceRun(back, sp, candles, T0 + 1200 * SECOND);
            expect(resumed.state).toEqual(whole.state);
            expect(resumed.events).toEqual(whole.events);
        });
    });
});
