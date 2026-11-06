// Trading strategies as a bot runs them, for a calculator, a test on past prices and a paper bot: a GRID (buy orders under the
// price, sell orders over it, each pair earning the step between two lines), a MARKET MAKER (a bid and an ask around the price,
// earning the spread) and a DOLLAR-COST AVERAGE (a fixed amount bought at a fixed interval). Nothing here places an order: the
// engine moves a pretend account along a series of candles, the way the chain would have filled limit orders.
//
// Prices are "priced-in asset per trade asset" (BTS in CNY: 0.2 means one BTS is 0.2 CNY). The numbers are plain floats - a
// calculator and a test, not an accounting book.
//
// How a fill is paid, as on the chain: the MARKET FEE of an asset is taken from what the order receives (a buy gets the trade asset
// less the fee, a sell gets the priced-in asset less the fee), and the NETWORK FEE is paid for each order that is placed.

export type StrategyKind = "grid" | "maker" | "dca";

export const MAX_GRID_LINES = 200;

export interface Candle {
    /** when it opened (ms since the epoch) */
    t: number;
    open: number;
    high: number;
    low: number;
    close: number;
}

export interface Costs {
    /** the market fee of a fill, in percent of what the order receives */
    feePercent: number;
    /** the network fee of an order that is placed, in the priced-in asset */
    orderFee: number;
}

export interface GridParams {
    lower: number;
    upper: number;
    /** the lines (orders sit on them): the steps between them are lines - 1 */
    lines: number;
    spacing: "geometric" | "arithmetic";
    /** all the grid is funded with, in the priced-in asset */
    investment: number;
}

export interface MakerParams {
    /** distance between the bid and the ask, in percent of the price */
    spreadPercent: number;
    /** what each of the two orders buys or sells, in the trade asset */
    size: number;
    /** funds, in the priced-in asset: half is kept in it, half is bought at the start */
    investment: number;
    /** the quotes are placed again around the price every so many candles */
    requoteEvery: number;
}

export interface DcaParams {
    /** bought each time, in the priced-in asset */
    amount: number;
    everyHours: number;
}

export interface StrategySpec {
    kind: StrategyKind;
    grid: GridParams;
    maker: MakerParams;
    dca: DcaParams;
    costs: Costs;
}

export type SpecError =
    | "fee"
    | "grid_range"
    | "grid_lines"
    | "grid_investment"
    | "maker_spread"
    | "maker_size"
    | "maker_investment"
    | "maker_requote"
    | "dca_amount"
    | "dca_every";

const positive = (n: number) => Number.isFinite(n) && n > 0;

/** What is wrong with a spec (a key for the words), or null when it can run. */
export function specError(spec: StrategySpec): SpecError | null {
    const {feePercent, orderFee} = spec.costs;
    if (
        !Number.isFinite(feePercent) ||
        feePercent < 0 ||
        feePercent >= 50 ||
        !Number.isFinite(orderFee) ||
        orderFee < 0
    ) {
        return "fee";
    }
    if (spec.kind === "grid") {
        const g = spec.grid;
        if (!positive(g.lower) || !positive(g.upper) || g.upper <= g.lower) {
            return "grid_range";
        }
        if (
            !Number.isInteger(g.lines) ||
            g.lines < 2 ||
            g.lines > MAX_GRID_LINES
        ) {
            return "grid_lines";
        }
        if (
            !positive(g.investment) ||
            g.investment <= (g.lines - 1) * 2 * orderFee
        ) {
            return "grid_investment";
        }
    } else if (spec.kind === "maker") {
        const m = spec.maker;
        if (!positive(m.spreadPercent) || m.spreadPercent >= 100) {
            return "maker_spread";
        }
        if (!positive(m.size)) return "maker_size";
        if (!positive(m.investment) || m.investment <= 2 * orderFee) {
            return "maker_investment";
        }
        if (
            !Number.isInteger(m.requoteEvery) ||
            m.requoteEvery < 1 ||
            m.requoteEvery > 1000
        ) {
            return "maker_requote";
        }
    } else {
        const d = spec.dca;
        if (!positive(d.amount) || d.amount <= orderFee) return "dca_amount";
        if (!positive(d.everyHours)) return "dca_every";
    }
    return null;
}

/** The prices the grid's orders sit on, lowest first. */
export function gridLines(g: GridParams): number[] {
    const n = Math.floor(g.lines);
    const out: number[] = [];
    for (let i = 0; i < n; i++) {
        const x = n > 1 ? i / (n - 1) : 0;
        out.push(
            g.spacing === "arithmetic"
                ? g.lower + (g.upper - g.lower) * x
                : g.lower * Math.pow(g.upper / g.lower, x)
        );
    }
    return out;
}

const fraction = (costs: Costs) => costs.feePercent / 100;

// ------------------------------------------------------------------ the engine

export interface TradeEvent {
    t: number;
    side: "buy" | "sell";
    price: number;
    /** the trade asset that was received (a buy) or sold (a sell) */
    size: number;
    /** a sell of a grid: what the pair earned after fees */
    profit?: number;
}

interface Slot {
    /** holds the asset and waits to sell at the line above */
    holding: boolean;
    qty: number;
    /** what the asset in it cost */
    cost: number;
}

interface Account {
    /** the price it began at, and when */
    start: number;
    startedAt: number;
    /** the last price and candle it has seen */
    last: number;
    at: number;
    cash: number;
    asset: number;
    /** market fees (valued in the priced-in asset) and network fees paid */
    fees: number;
    fills: number;
    /** what was put in, in the priced-in asset (a DCA adds to it with each buy) */
    capital: number;
}

export interface GridState extends Account {
    kind: "grid";
    lines: number[];
    /** the trade asset each line's order is for (before the fee) */
    size: number;
    slots: Slot[];
    cycles: number;
    realized: number;
}

export interface MakerState extends Account {
    kind: "maker";
    bid: number | null;
    ask: number | null;
    /** candles since the quotes were placed */
    since: number;
    buys: number;
    sells: number;
}

export interface DcaState extends Account {
    kind: "dca";
    nextAt: number;
    buys: number;
}

export type EngineState = GridState | MakerState | DcaState;

/** The state a strategy begins in at `price` (and `t`, ms), with what its first orders cost. */
export function startState(
    spec: StrategySpec,
    price: number,
    t: number
): EngineState {
    const f = fraction(spec.costs);
    const fee = spec.costs.orderFee;
    const base = {start: price, startedAt: t, last: price, at: t, fills: 0};
    if (spec.kind === "grid") {
        const lines = gridLines(spec.grid);
        const steps = lines.length - 1;
        // a step whose lower line is under the price waits to buy there; one at or over it holds the asset, bought now
        let cashLines = 0;
        let held = 0;
        lines.slice(0, steps).forEach(line => {
            if (line < price) cashLines += line;
            else held++;
        });
        const usable = spec.grid.investment - steps * fee;
        const size = usable / (cashLines + held * price);
        const slots: Slot[] = lines
            .slice(0, steps)
            .map(line =>
                line < price
                    ? {holding: false, qty: 0, cost: 0}
                    : {holding: true, qty: size * (1 - f), cost: size * price}
            );
        return {
            ...base,
            kind: "grid",
            lines,
            size,
            slots,
            cycles: 0,
            realized: 0,
            cash: cashLines * size,
            asset: held * size * (1 - f),
            fees: held * size * f * price + steps * fee,
            capital: spec.grid.investment
        };
    }
    if (spec.kind === "maker") {
        const m = spec.maker;
        const half = (m.investment - 2 * fee) / 2;
        const gross = half / price;
        const h = m.spreadPercent / 200;
        return {
            ...base,
            kind: "maker",
            bid: price * (1 - h),
            ask: price * (1 + h),
            since: 0,
            buys: 0,
            sells: 0,
            cash: half,
            asset: gross * (1 - f),
            fees: gross * f * price + 2 * fee,
            capital: m.investment
        };
    }
    // the first purchase is made at once
    const d = spec.dca;
    const gross = d.amount / price;
    return {
        ...base,
        kind: "dca",
        nextAt: t + d.everyHours * 3600 * 1000,
        buys: 1,
        cash: 0,
        asset: gross * (1 - f),
        fees: gross * f * price + fee,
        // (the network fee of an order is part of what the bot put in)
        capital: d.amount + fee,
        fills: 1
    };
}

/** The prices a candle went through, in the order assumed: up candles dip first, down candles rise first. */
function path(from: number, candle: Candle): number[] {
    const up = candle.close >= candle.open;
    const points = up
        ? [from, candle.open, candle.low, candle.high, candle.close]
        : [from, candle.open, candle.high, candle.low, candle.close];
    return points.filter((p, i) => i === 0 || p !== points[i - 1]);
}

function gridMove(
    s: GridState,
    spec: StrategySpec,
    a: number,
    b: number,
    t: number,
    events: TradeEvent[]
): void {
    const f = fraction(spec.costs);
    const fee = spec.costs.orderFee;
    if (b < a) {
        // down: the buy orders on the way are filled, the highest first
        for (let i = s.slots.length - 1; i >= 0; i--) {
            const line = s.lines[i];
            const slot = s.slots[i];
            if (slot.holding || line > a || line < b) continue;
            const spend = Math.min(line * s.size, s.cash);
            if (!(spend > 0)) continue;
            const gross = spend / line;
            const qty = gross * (1 - f);
            s.cash -= spend + fee;
            s.asset += qty;
            s.fees += gross * f * line + fee;
            s.fills++;
            s.slots[i] = {holding: true, qty, cost: spend};
            events.push({t, side: "buy", price: line, size: qty});
        }
    } else if (b > a) {
        // up: the sell orders on the way are filled, the lowest first
        for (let i = 0; i < s.slots.length; i++) {
            const line = s.lines[i + 1];
            const slot = s.slots[i];
            if (!slot.holding || line <= a || line > b) continue;
            const gross = slot.qty * line;
            const net = gross * (1 - f);
            const profit = net - slot.cost - fee * 2;
            s.cash += net - fee;
            s.asset -= slot.qty;
            s.fees += gross * f + fee;
            s.fills++;
            s.cycles++;
            s.realized += profit;
            s.slots[i] = {holding: false, qty: 0, cost: 0};
            events.push({
                t,
                side: "sell",
                price: line,
                size: slot.qty,
                profit
            });
        }
    }
}

function makerMove(
    s: MakerState,
    spec: StrategySpec,
    a: number,
    b: number,
    t: number,
    events: TradeEvent[]
): void {
    const f = fraction(spec.costs);
    const size = spec.maker.size;
    if (b < a && s.bid !== null && s.bid <= a && s.bid >= b) {
        const bought = Math.min(size, s.cash / s.bid);
        if (bought > size * 0.01) {
            const qty = bought * (1 - f);
            s.cash -= bought * s.bid;
            s.asset += qty;
            s.fees += bought * f * s.bid;
            s.fills++;
            s.buys++;
            events.push({t, side: "buy", price: s.bid, size: qty});
        }
        s.bid = null;
    } else if (b > a && s.ask !== null && s.ask > a && s.ask <= b) {
        const sold = Math.min(size, s.asset);
        if (sold > size * 0.01) {
            const gross = sold * s.ask;
            s.cash += gross * (1 - f);
            s.asset -= sold;
            s.fees += gross * f;
            s.fills++;
            s.sells++;
            events.push({t, side: "sell", price: s.ask, size: sold});
        }
        s.ask = null;
    }
}

/**
 * Moves the state along one candle (it is CHANGED, not copied) and says what was filled. The candles come in time order;
 * a gap between one candle's close and the next one's open is a move too.
 */
export function stepCandle(
    state: EngineState,
    spec: StrategySpec,
    candle: Candle
): TradeEvent[] {
    const events: TradeEvent[] = [];
    if (state.kind === "dca") {
        const f = fraction(spec.costs);
        const interval = spec.dca.everyHours * 3600 * 1000;
        while (candle.t >= state.nextAt) {
            const gross = spec.dca.amount / candle.open;
            const qty = gross * (1 - f);
            state.asset += qty;
            state.fees += gross * f * candle.open + spec.costs.orderFee;
            state.capital += spec.dca.amount + spec.costs.orderFee;
            state.buys++;
            state.fills++;
            state.nextAt += interval;
            events.push({
                t: candle.t,
                side: "buy",
                price: candle.open,
                size: qty
            });
        }
    } else {
        if (state.kind === "maker") {
            if (state.since >= spec.maker.requoteEvery) {
                // new quotes around the last price (each costs a network fee)
                const h = spec.maker.spreadPercent / 200;
                state.bid = state.last * (1 - h);
                state.ask = state.last * (1 + h);
                state.since = 0;
                state.cash -= 2 * spec.costs.orderFee;
                state.fees += 2 * spec.costs.orderFee;
            }
        }
        const points = path(state.last, candle);
        for (let i = 1; i < points.length; i++) {
            if (state.kind === "grid") {
                gridMove(
                    state,
                    spec,
                    points[i - 1],
                    points[i],
                    candle.t,
                    events
                );
            } else {
                makerMove(
                    state,
                    spec,
                    points[i - 1],
                    points[i],
                    candle.t,
                    events
                );
            }
        }
    }
    if (state.kind === "maker") state.since++;
    state.last = candle.close;
    state.at = candle.t;
    return events;
}

// ------------------------------------------------------------------ what it earned

export interface Summary {
    /** funds + assets at `price`, in the priced-in asset */
    equity: number;
    /** what was put in */
    capital: number;
    pnl: number;
    pnlPercent: number;
    fees: number;
    fills: number;
    /** the same funds put into the asset at the start and left there */
    holdPnl: number;
    holdPercent: number;
    /** a grid: pairs completed and what they earned; a DCA: what the asset cost on average and its break-even price */
    cycles?: number;
    realized?: number;
    averageCost?: number;
    breakEven?: number;
}

/** What the strategy has earned if the asset is valued at `price`. */
export function summarize(
    state: EngineState,
    spec: StrategySpec,
    price: number
): Summary {
    const f = fraction(spec.costs);
    const equity = state.cash + state.asset * price;
    const capital = state.capital;
    const pnl = equity - capital;
    const hold = ((capital * (1 - f)) / state.start) * price - capital;
    const out: Summary = {
        equity,
        capital,
        pnl,
        pnlPercent: capital > 0 ? (pnl / capital) * 100 : 0,
        fees: state.fees,
        fills: state.fills,
        holdPnl: hold,
        holdPercent: capital > 0 ? (hold / capital) * 100 : 0
    };
    if (state.kind === "grid") {
        out.cycles = state.cycles;
        out.realized = state.realized;
    } else if (state.kind === "dca" && state.asset > 0) {
        out.averageCost = state.capital / state.asset;
        // selling costs the market fee again
        out.breakEven = out.averageCost / (1 - f);
    }
    return out;
}

export interface BacktestResult {
    summary: Summary;
    events: TradeEvent[];
    /** pnl of the strategy and of holding, a few hundred points at most, oldest first */
    curve: Array<{t: number; pnl: number; hold: number}>;
    from: number;
    to: number;
    candles: number;
    state: EngineState;
}

const CURVE_POINTS = 240;

/** The strategy run over past candles, from the first one's open. Null with no candles. */
export function backtest(
    spec: StrategySpec,
    candles: Candle[]
): BacktestResult | null {
    if (!candles.length) return null;
    const first = candles[0];
    const state = startState(spec, first.open, first.t);
    const events: TradeEvent[] = [];
    const every = Math.max(1, Math.ceil(candles.length / CURVE_POINTS));
    const curve: BacktestResult["curve"] = [];
    candles.forEach((candle, i) => {
        stepCandle(state, spec, candle).forEach(e => events.push(e));
        if (i % every === 0 || i === candles.length - 1) {
            const s = summarize(state, spec, candle.close);
            curve.push({t: candle.t, pnl: s.pnl, hold: s.holdPnl});
        }
    });
    const last = candles[candles.length - 1];
    return {
        summary: summarize(state, spec, last.close),
        events,
        curve,
        from: first.t,
        to: last.t,
        candles: candles.length,
        state
    };
}

// ------------------------------------------------------------------ the calculator

export interface GridCalc {
    steps: number;
    /** the step between two lines in percent: the smallest and the largest */
    stepMin: number;
    stepMax: number;
    /** below which a step loses money on each pair (fees only), in percent */
    breakEvenStep: number;
    /** what each order is for, in the trade asset, at `price` */
    size: number;
    /** the steps that lose money on each pair, the fees counted */
    losingSteps: number;
    /** if every step is traded once: what it earns in all, and per step */
    perRound: number;
    perStep: number;
    perRoundPercent: number;
    below: number;
    above: number;
    inRange: boolean;
}

/** What a grid earns in a round (every step bought and sold once) at `price`. */
export function gridCalc(spec: StrategySpec, price: number): GridCalc {
    const f = fraction(spec.costs);
    const fee = spec.costs.orderFee;
    const lines = gridLines(spec.grid);
    const state = startState({...spec, kind: "grid"}, price, 0) as GridState;
    const ratios = lines.slice(1).map((line, i) => line / lines[i]);
    let perRound = 0;
    let losing = 0;
    ratios.forEach((ratio, i) => {
        const cost = state.size * lines[i];
        const profit = cost * (ratio * (1 - f) * (1 - f) - 1) - 2 * fee;
        perRound += profit;
        if (profit <= 0) losing++;
    });
    return {
        steps: ratios.length,
        stepMin: (Math.min(...ratios) - 1) * 100,
        stepMax: (Math.max(...ratios) - 1) * 100,
        breakEvenStep: (1 / ((1 - f) * (1 - f)) - 1) * 100,
        size: state.size,
        losingSteps: losing,
        perRound,
        perStep: ratios.length ? perRound / ratios.length : 0,
        perRoundPercent: (perRound / spec.grid.investment) * 100,
        below: state.slots.filter(s => !s.holding).length,
        above: state.slots.filter(s => s.holding).length,
        inRange: price >= lines[0] && price <= lines[lines.length - 1]
    };
}

export interface MakerCalc {
    /** a bid filled, then the ask: what that earns after fees, in percent of the bid and in the priced-in asset */
    tripPercent: number;
    trip: number;
    /** the spread (percent) under which a round trip loses money */
    breakEvenSpread: number;
    perDay: number;
    perDayPercent: number;
    yearlyPercent: number;
}

/** What a market maker earns in a round trip at `price`, and per day if it makes `tripsPerDay` of them. */
export function makerCalc(
    spec: StrategySpec,
    price: number,
    tripsPerDay: number
): MakerCalc {
    const f = fraction(spec.costs);
    const fee = spec.costs.orderFee;
    const h = spec.maker.spreadPercent / 200;
    const bid = price * (1 - h);
    const ask = price * (1 + h);
    const cost = bid * spec.maker.size;
    // (each trip needs two orders placed)
    const trip = cost * ((ask / bid) * (1 - f) * (1 - f) - 1) - 2 * fee;
    const perDay = trip * tripsPerDay;
    return {
        tripPercent: cost > 0 ? (trip / cost) * 100 : 0,
        trip,
        // the spread at which ask/bid = 1 / (1-f)^2, for h on both sides
        breakEvenSpread: (() => {
            const r = 1 / ((1 - f) * (1 - f));
            return ((r - 1) / (r + 1)) * 2 * 100;
        })(),
        perDay,
        perDayPercent: (perDay / spec.maker.investment) * 100,
        yearlyPercent: ((perDay * 365) / spec.maker.investment) * 100
    };
}

export interface DcaCalc {
    buys: number;
    invested: number;
    fees: number;
    /** how far the price has to rise from the average cost to cover the fee of selling too, in percent */
    breakEvenRise: number;
    /** the asset bought in all, at `price` */
    asset: number;
}

/** What `buys` purchases cost at a steady `price`, and what has to happen before they pay. */
export function dcaCalc(
    spec: StrategySpec,
    price: number,
    buys: number
): DcaCalc {
    const f = fraction(spec.costs);
    const d = spec.dca;
    const gross = (d.amount / price) * buys;
    return {
        buys,
        invested: (d.amount + spec.costs.orderFee) * buys,
        fees: gross * f * price + spec.costs.orderFee * buys,
        breakEvenRise:
            ((d.amount + spec.costs.orderFee) / (d.amount * (1 - f) * (1 - f)) -
                1) *
            100,
        asset: gross * (1 - f)
    };
}
