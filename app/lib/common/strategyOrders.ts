// The real orders of a strategy: the limit orders that put it on the book NOW, as integer amounts the chain takes
// (`limit_order_create`), and the gate that lets them be placed only after a test of the same strategy on past prices
// ended well. Pure: what is read from the chain (balances, fees) and what is sent is `lib/chain/strategyChain.ts` and the page.
//
// What is placed is the strategy's FIRST set of orders, once: a grid's buys under the price and sells over it, a market
// maker's bid and ask, a DCA's one buy. Nothing places the order on the other side when one is filled - that is a bot that
// keeps signing, and this is not one.
//
// Rounding is always the safe way for the person: a buy never pays more than its line (what it wants is rounded up to a unit and
// what it pays for that is rounded down), a sell never takes less than its line (what it wants for what it gives is rounded up).
import {AssetRef} from "./marketCandles";
import {
    GridState,
    StrategySpec,
    Summary,
    specError,
    startState
} from "./strategies";

/** The most orders one placement holds (one transaction). */
export const MAX_ORDERS = 50;
/** How far over the last price a DCA buy may go, in percent: it fills against what is there, up to this. */
export const DCA_SLIPPAGE_PERCENT = 1;

export const CORE_ID = "1.3.0";

export interface PlannedOrder {
    side: "buy" | "sell";
    /** the line, in the priced asset per trade asset */
    price: number;
    sell: {asset: string; amount: bigint};
    /** the least the order takes (a buy: what it wants exactly) */
    receive: {asset: string; amount: bigint};
}

export interface SkippedOrder {
    side: "buy" | "sell";
    price: number;
    reason: "funds" | "tiny";
}

export interface OrderPlan {
    orders: PlannedOrder[];
    skipped: SkippedOrder[];
    /** what the orders sell in all, by asset */
    spends: {trade: bigint; priced: bigint};
}

export type PlanError = "spec" | "price" | "too_many" | "range";

const ZERO = BigInt(0);

/** Units of an asset (precision `p`) for an amount; null when it is not a safe integer. */
function units(
    x: number,
    precision: number,
    how: "floor" | "round" | "ceil"
): bigint | null {
    const scaled = x * Math.pow(10, precision);
    const n = Math[how](scaled);
    return Number.isSafeInteger(n) && n >= 0 ? BigInt(n) : null;
}

/** The size in units of the asset is within 5% of the size meant: a size of a tenth of a unit is not an order of one unit. */
function sizeKept(size: number, asset: AssetRef, amount: bigint): boolean {
    const meant = size * Math.pow(10, asset.precision);
    return Math.abs(Number(amount) - meant) <= 0.05 * meant;
}

interface Candidate {
    side: "buy" | "sell";
    price: number;
    /** the amount of the trade asset the order is for */
    size: number;
}

/**
 * The orders of the strategy at `price`, funded from `holdings` (units): the orders nearest the price are funded first, and an
 * order the account cannot pay for is left out (and said to be).
 */
export function planOrders(
    spec: StrategySpec,
    trade: AssetRef,
    priced: AssetRef,
    price: number,
    holdings: {trade: bigint; priced: bigint}
): {ok: true; plan: OrderPlan} | {ok: false; error: PlanError} {
    if (specError(spec) !== null) return {ok: false, error: "spec"};
    if (!(price > 0) || !Number.isFinite(price)) {
        return {ok: false, error: "price"};
    }
    const candidates: Candidate[] = [];
    if (spec.kind === "grid") {
        const state = startState(
            {...spec, kind: "grid"},
            price,
            0
        ) as GridState;
        state.slots.forEach((slot, i) =>
            candidates.push(
                slot.holding
                    ? {
                          side: "sell",
                          price: state.lines[i + 1],
                          size: state.size
                      }
                    : {side: "buy", price: state.lines[i], size: state.size}
            )
        );
    } else if (spec.kind === "maker") {
        const h = spec.maker.spreadPercent / 200;
        candidates.push(
            {side: "buy", price: price * (1 - h), size: spec.maker.size},
            {side: "sell", price: price * (1 + h), size: spec.maker.size}
        );
    } else {
        const limit = price * (1 + DCA_SLIPPAGE_PERCENT / 100);
        candidates.push({
            side: "buy",
            price: limit,
            size: spec.dca.amount / limit
        });
    }
    if (candidates.length > MAX_ORDERS) return {ok: false, error: "too_many"};

    const built: Array<{candidate: Candidate; order: PlannedOrder | null}> = [];
    for (const c of candidates) {
        let order: PlannedOrder | null = null;
        if (c.side === "buy") {
            // wants the size (rounded up to a unit), pays at most the line for exactly that: rounded down
            const want = units(c.size, trade.precision, "ceil");
            if (want === null) return {ok: false, error: "range"};
            const pay =
                spec.kind === "dca"
                    ? units(spec.dca.amount, priced.precision, "floor")
                    : units(
                          c.price *
                              (Number(want) / Math.pow(10, trade.precision)),
                          priced.precision,
                          "floor"
                      );
            if (pay === null) return {ok: false, error: "range"};
            if (pay > ZERO && want > ZERO && sizeKept(c.size, trade, want)) {
                order = {
                    side: "buy",
                    price: c.price,
                    sell: {asset: priced.id, amount: pay},
                    receive: {asset: trade.id, amount: want}
                };
            }
        } else {
            // gives the size (to a unit), takes at least the line for exactly that: rounded up
            const give = units(c.size, trade.precision, "round");
            if (give === null) return {ok: false, error: "range"};
            const want = units(
                c.price * (Number(give) / Math.pow(10, trade.precision)),
                priced.precision,
                "ceil"
            );
            if (want === null) return {ok: false, error: "range"};
            if (give > ZERO && want > ZERO && sizeKept(c.size, trade, give)) {
                order = {
                    side: "sell",
                    price: c.price,
                    sell: {asset: trade.id, amount: give},
                    receive: {asset: priced.id, amount: want}
                };
            }
        }
        built.push({candidate: c, order});
    }

    // fund the orders nearest the price first
    const byDistance = built
        .map((b, index) => ({...b, index}))
        .sort(
            (a, b) =>
                Math.abs(a.candidate.price - price) -
                    Math.abs(b.candidate.price - price) || a.index - b.index
        );
    let tradeLeft = holdings.trade;
    let pricedLeft = holdings.priced;
    const funded = new Set<number>();
    const skipped: SkippedOrder[] = [];
    const spends = {trade: ZERO, priced: ZERO};
    for (const b of byDistance) {
        const {candidate, order} = b;
        if (!order) {
            skipped.push({
                side: candidate.side,
                price: candidate.price,
                reason: "tiny"
            });
        } else if (order.side === "buy") {
            if (order.sell.amount <= pricedLeft) {
                pricedLeft -= order.sell.amount;
                spends.priced += order.sell.amount;
                funded.add(b.index);
            } else {
                skipped.push({
                    side: "buy",
                    price: order.price,
                    reason: "funds"
                });
            }
        } else if (order.sell.amount <= tradeLeft) {
            tradeLeft -= order.sell.amount;
            spends.trade += order.sell.amount;
            funded.add(b.index);
        } else {
            skipped.push({side: "sell", price: order.price, reason: "funds"});
        }
    }
    // (in the order of the lines, the highest first)
    const orders = built
        .filter((_b, i) => funded.has(i))
        .map(b => b.order as PlannedOrder)
        .sort((a, b) => b.price - a.price);
    return {ok: true, plan: {orders, skipped, spends}};
}

const isoSeconds = (date: Date) => date.toISOString().slice(0, 19);

/** The `limit_order_create` operations of a plan, for the account; the orders stay until `expiration`. */
export function orderOperations(
    plan: OrderPlan,
    account: string,
    expiration: Date
): Array<[string, any]> {
    return plan.orders.map(order => [
        "limit_order_create",
        {
            fee: {amount: 0, asset_id: CORE_ID},
            seller: account,
            amount_to_sell: {
                amount: order.sell.amount.toString(),
                asset_id: order.sell.asset
            },
            min_to_receive: {
                amount: order.receive.amount.toString(),
                asset_id: order.receive.asset
            },
            expiration: isoSeconds(expiration),
            fill_or_kill: false,
            extensions: []
        }
    ]);
}

// ------------------------------------------------------------------ the gate

/** What a test of a strategy on past prices left behind, for the gate. */
export interface TestedStrategy {
    spec: StrategySpec;
    tradeId: string;
    pricedId: string;
    summary: Summary;
    candles: number;
}

export type Gate =
    | {ok: true}
    | {
          ok: false;
          reason:
              | "no_test"
              | "changed"
              | "market"
              | "loss"
              | "no_fills"
              | "too_many";
      };

/** The part of a spec that makes the strategy what it is: its kind, the settings of that kind, the fees. */
export function specKey(spec: StrategySpec): string {
    return JSON.stringify([spec.kind, spec[spec.kind], spec.costs]);
}

/**
 * Real orders only after a test of THIS strategy (the same settings, the same market) that traded and ended in profit after
 * the fees, and for a strategy that is no more orders than one placement holds.
 */
export function placementGate(
    tested: TestedStrategy | null,
    spec: StrategySpec,
    tradeId: string | null,
    pricedId: string | null
): Gate {
    if (!tested) return {ok: false, reason: "no_test"};
    if (tested.tradeId !== tradeId || tested.pricedId !== pricedId) {
        return {ok: false, reason: "market"};
    }
    if (specKey(tested.spec) !== specKey(spec)) {
        return {ok: false, reason: "changed"};
    }
    if (spec.kind === "grid" && spec.grid.lines - 1 > MAX_ORDERS) {
        return {ok: false, reason: "too_many"};
    }
    const needed = spec.kind === "dca" ? 2 : 1;
    if (tested.summary.fills < needed) return {ok: false, reason: "no_fills"};
    if (!(tested.summary.pnl > 0)) return {ok: false, reason: "loss"};
    return {ok: true};
}
