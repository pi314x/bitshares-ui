// The strategies the user defined, kept in this browser, and the paper run each one can have. A run is the engine's state
// (`strategies.ts`) with how far along the candles it is: it is moved forward from the candles the node has, so a run goes on
// where it was when the page was closed for a while - the candles that closed meanwhile are processed when the page opens.
import {AssetRef} from "./marketCandles";
import {
    Candle,
    DcaState,
    EngineState,
    GridState,
    MakerState,
    StrategySpec,
    TradeEvent,
    specError,
    startState,
    stepCandle
} from "./strategies";

export const KEY = "__graphene__strategies";
export const MAX_STRATEGIES = 20;
/** How many trades a run keeps to show. */
export const MAX_EVENTS = 100;
/** The candles a paper run follows: five minutes. */
export const RUN_SECONDS = 300;

export interface Run {
    startedAt: number;
    seconds: number;
    state: EngineState;
    /** the opening time of the newest candle that was processed (the start: the open of the candle it began in) */
    lastT: number;
    /** the price of the newest candle processed */
    price: number;
    events: TradeEvent[];
    running: boolean;
}

export interface SavedStrategy {
    id: string;
    name: string;
    trade: AssetRef;
    priced: AssetRef;
    spec: StrategySpec;
    savedAt: number;
    run?: Run;
}

const num = (v: unknown): number | null =>
    typeof v === "number" && Number.isFinite(v) ? v : null;

/** All of `keys` as finite numbers of `o`, or null where one is not. */
function numbers<K extends string>(
    o: any,
    keys: readonly K[]
): Record<K, number> | null {
    const out: any = {};
    for (const key of keys) {
        const n = num(o && o[key]);
        if (n === null) return null;
        out[key] = n;
    }
    return out;
}

export function validAsset(v: any): AssetRef | null {
    if (
        !v ||
        typeof v.id !== "string" ||
        !/^1\.3\.\d+$/.test(v.id) ||
        typeof v.symbol !== "string" ||
        !v.symbol ||
        v.symbol.length > 64 ||
        !Number.isInteger(v.precision) ||
        v.precision < 0 ||
        v.precision > 12
    ) {
        return null;
    }
    return {id: v.id, symbol: v.symbol, precision: v.precision};
}

/** A spec that can run, rebuilt from what was kept (null: it cannot). */
export function validSpec(v: any): StrategySpec | null {
    if (!v || (v.kind !== "grid" && v.kind !== "maker" && v.kind !== "dca")) {
        return null;
    }
    const grid = numbers(v.grid, ["lower", "upper", "lines", "investment"]);
    const maker = numbers(v.maker, [
        "spreadPercent",
        "size",
        "investment",
        "requoteEvery"
    ]);
    const dca = numbers(v.dca, ["amount", "everyHours"]);
    const costs = numbers(v.costs, ["feePercent", "orderFee"]);
    if (!grid || !maker || !dca || !costs) return null;
    const spec: StrategySpec = {
        kind: v.kind,
        grid: {
            ...grid,
            spacing:
                v.grid.spacing === "arithmetic" ? "arithmetic" : "geometric"
        },
        maker,
        dca,
        costs
    };
    return specError(spec) === null ? spec : null;
}

const ACCOUNT = [
    "start",
    "startedAt",
    "last",
    "at",
    "cash",
    "asset",
    "fees",
    "fills",
    "capital"
] as const;

/** An engine state rebuilt from what was kept, for the spec it runs (null: it does not fit). */
export function validState(v: any, spec: StrategySpec): EngineState | null {
    if (!v || v.kind !== spec.kind) return null;
    const account = numbers(v, ACCOUNT);
    if (!account) return null;
    if (v.kind === "grid") {
        const own = numbers(v, ["size", "cycles", "realized"]);
        if (!own || !Array.isArray(v.lines) || !Array.isArray(v.slots)) {
            return null;
        }
        if (
            v.lines.length !== spec.grid.lines ||
            v.slots.length !== v.lines.length - 1 ||
            !v.lines.every((n: unknown) => num(n) !== null)
        ) {
            return null;
        }
        const slots = [];
        for (const slot of v.slots) {
            const s = numbers(slot, ["qty", "cost"]);
            if (!s || typeof slot.holding !== "boolean") return null;
            slots.push({holding: slot.holding, ...s});
        }
        const state: GridState = {
            ...account,
            ...own,
            kind: "grid",
            lines: v.lines.slice(),
            slots
        };
        return state;
    }
    if (v.kind === "maker") {
        const own = numbers(v, ["since", "buys", "sells"]);
        const quote = (n: unknown) => (n === null ? null : num(n));
        if (!own) return null;
        const bid = quote(v.bid);
        const ask = quote(v.ask);
        if (
            (v.bid !== null && bid === null) ||
            (v.ask !== null && ask === null)
        ) {
            return null;
        }
        const state: MakerState = {
            ...account,
            ...own,
            kind: "maker",
            bid,
            ask
        };
        return state;
    }
    const own = numbers(v, ["nextAt", "buys"]);
    if (!own) return null;
    const state: DcaState = {...account, ...own, kind: "dca"};
    return state;
}

function validEvents(v: any): TradeEvent[] {
    if (!Array.isArray(v)) return [];
    const out: TradeEvent[] = [];
    for (const e of v) {
        const n = numbers(e, ["t", "price", "size"]);
        if (n && (e.side === "buy" || e.side === "sell")) {
            const event: TradeEvent = {...n, side: e.side};
            const profit = num(e.profit);
            if (profit !== null) event.profit = profit;
            out.push(event);
        }
    }
    return out.slice(-MAX_EVENTS);
}

export function validRun(v: any, spec: StrategySpec): Run | null {
    const n = numbers(v, ["startedAt", "seconds", "lastT", "price"]);
    const state = validState(v && v.state, spec);
    if (!n || !state || n.seconds <= 0 || n.price <= 0) return null;
    return {
        ...n,
        state,
        events: validEvents(v.events),
        running: v.running === true
    };
}

export function validStrategy(v: any): SavedStrategy | null {
    if (!v || typeof v.id !== "string" || !v.id || v.id.length > 40)
        return null;
    const trade = validAsset(v.trade);
    const priced = validAsset(v.priced);
    const spec = validSpec(v.spec);
    if (!trade || !priced || !spec || trade.id === priced.id) return null;
    const out: SavedStrategy = {
        id: v.id,
        name: typeof v.name === "string" ? v.name.slice(0, 80) : "",
        trade,
        priced,
        spec,
        savedAt: num(v.savedAt) || 0
    };
    const run = v.run ? validRun(v.run, spec) : null;
    if (run) out.run = run;
    return out;
}

function defaultStorage(): Storage | null {
    try {
        return typeof window !== "undefined" ? window.localStorage : null;
    } catch (e) {
        return null;
    }
}

export function readStrategies(
    storage: Pick<Storage, "getItem"> | null = defaultStorage()
): SavedStrategy[] {
    if (!storage) return [];
    try {
        const parsed = JSON.parse(storage.getItem(KEY) || "[]");
        if (!Array.isArray(parsed)) return [];
        const seen = new Set<string>();
        const out: SavedStrategy[] = [];
        for (const entry of parsed) {
            const s = validStrategy(entry);
            if (s && !seen.has(s.id)) {
                seen.add(s.id);
                out.push(s);
            }
        }
        return out.slice(0, MAX_STRATEGIES);
    } catch (e) {
        return [];
    }
}

export function writeStrategies(
    strategies: SavedStrategy[],
    storage: Pick<Storage, "setItem"> | null = defaultStorage()
): boolean {
    if (!storage) return false;
    try {
        storage.setItem(
            KEY,
            JSON.stringify(strategies.slice(0, MAX_STRATEGIES))
        );
        return true;
    } catch (e) {
        // not kept: the strategies are still on the page
        return false;
    }
}

/** An id no other strategy has. */
export function newStrategyId(taken: Iterable<string> = []): string {
    const used = new Set(taken);
    for (;;) {
        const id = `s${Date.now().toString(36)}${Math.random()
            .toString(36)
            .slice(2, 6)}`;
        if (!used.has(id)) return id;
    }
}

// ------------------------------------------------------------------ the paper run

/** The opening time of the candle `now` is in. */
export function candleOpen(now: number, seconds: number): number {
    const size = seconds * 1000;
    return Math.floor(now / size) * size;
}

/** A run that begins now at `price`. */
export function startRun(
    spec: StrategySpec,
    price: number,
    now: number,
    seconds = RUN_SECONDS
): Run {
    return {
        startedAt: now,
        seconds,
        state: startState(spec, price, now),
        // (the candle it began in is not followed: only the ones after it)
        lastT: candleOpen(now, seconds),
        price,
        events: [],
        running: true
    };
}

/**
 * The run moved along the candles that closed since it was last moved (a candle that is still open is left for the next
 * time). The run given is not changed.
 */
export function advanceRun(
    run: Run,
    spec: StrategySpec,
    candles: Candle[],
    now: number
): Run {
    const state: EngineState = JSON.parse(JSON.stringify(run.state));
    const events = run.events.slice();
    let lastT = run.lastT;
    let price = run.price;
    for (const candle of candles) {
        if (candle.t <= lastT || candle.t + run.seconds * 1000 > now) continue;
        stepCandle(state, spec, candle).forEach(e => events.push(e));
        lastT = candle.t;
        price = candle.close;
    }
    return {
        ...run,
        state,
        lastT,
        price,
        events: events.slice(-MAX_EVENTS)
    };
}
