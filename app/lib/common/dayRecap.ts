// What happened to the account in the last 24 hours, counted from its operation history (the same history the balance
// chart is drawn from): transfers in and out, order fills (what was sold and what came back), orders placed and
// cancelled, pool swaps and liquidity changes, flash loans, and the network fees the account paid. A summary of what
// the chain recorded, not of what the account is worth: nothing here is priced.
//
// Pure: the history, the times of its blocks and the clock are given.
import {startedByAccount} from "./accountActivity";
import {HistoryEntry, newOrderTracker, operationDelta} from "./balanceHistory";

/** The window (24 hours). */
export const DAY_SECONDS = 24 * 60 * 60;

/** Smallest units of each asset, by asset id. */
export type Totals = Map<string, bigint>;

export interface DayRecap {
    /** unix seconds: the start of the window */
    since: number;
    /** operations in the window */
    operations: number;
    transfersIn: {count: number; total: Totals};
    transfersOut: {count: number; total: Totals};
    fills: {count: number; sold: Totals; got: Totals};
    orders: {placed: number; cancelled: number};
    pools: {swaps: number; liquidity: number};
    loans: number;
    /** the network fees of what the account started, by the asset they were paid in */
    fees: Totals;
    /**
     * What the account holds of each token now against 24 hours ago, in smallest units (a token that did not change
     * is not in it). Transfers, fills, pool swaps, fees and refunds are all in it: what was gained or lost.
     */
    net: Totals;
    /** the history loaded reaches back past the start of the window (or holds all the account has) */
    covered: boolean;
}

export interface RecapEntry {
    id: string;
    op: [number, any];
    block_num: number;
    /** what the operation produced (the id of an order that was placed) */
    result?: [number, any];
}

export interface RecapInput {
    /** newest first, as the node gives it */
    entries: RecapEntry[];
    /** block number -> unix seconds */
    times: {[block: number]: number};
    /** all of the account's operations are loaded (there are no older ones) */
    complete: boolean;
    accountId: string;
    nowSec: number;
    /** the operation's name by its number ("transfer") */
    opName: (code: number) => string | undefined;
}

const big = (value: unknown): bigint => {
    try {
        return BigInt(value as string);
    } catch (e) {
        return BigInt(0);
    }
};

function add(totals: Totals, amount: any) {
    if (!amount || typeof amount.asset_id !== "string") return;
    totals.set(
        amount.asset_id,
        (totals.get(amount.asset_id) || BigInt(0)) + big(amount.amount)
    );
}

const emptyTotals = (): Totals => new Map();

export function recapOf(input: RecapInput): DayRecap {
    const since = input.nowSec - DAY_SECONDS;
    const recap: DayRecap = {
        since,
        operations: 0,
        transfersIn: {count: 0, total: emptyTotals()},
        transfersOut: {count: 0, total: emptyTotals()},
        fills: {count: 0, sold: emptyTotals(), got: emptyTotals()},
        orders: {placed: 0, cancelled: 0},
        pools: {swaps: 0, liquidity: 0},
        loans: 0,
        fees: emptyTotals(),
        net: emptyTotals(),
        covered: input.complete
    };
    for (const entry of input.entries) {
        const time = input.times[entry.block_num];
        // a block whose time is not known yet cannot be placed: left out
        if (time === undefined) continue;
        if (time < since) {
            // an older operation is loaded: the window is all there
            recap.covered = true;
            break;
        }
        recap.operations++;
        const code = entry.op[0];
        const data = entry.op[1] || {};
        const name = input.opName(code);
        switch (name) {
            case "transfer":
                if (data.to === input.accountId) {
                    recap.transfersIn.count++;
                    add(recap.transfersIn.total, data.amount);
                }
                if (data.from === input.accountId) {
                    recap.transfersOut.count++;
                    add(recap.transfersOut.total, data.amount);
                }
                break;
            case "fill_order":
                if (data.account_id === input.accountId) {
                    recap.fills.count++;
                    add(recap.fills.sold, data.pays);
                    add(recap.fills.got, data.receives);
                }
                break;
            case "limit_order_create":
                recap.orders.placed++;
                break;
            case "limit_order_cancel":
                recap.orders.cancelled++;
                break;
            case "liquidity_pool_exchange":
                recap.pools.swaps++;
                break;
            case "liquidity_pool_deposit":
            case "liquidity_pool_withdraw":
                recap.pools.liquidity++;
                break;
            case "samet_fund_borrow":
                recap.loans++;
                break;
            default:
                break;
        }
        if (data.fee && startedByAccount(name, data, input.accountId)) {
            add(recap.fees, data.fee);
        }
    }
    recap.net = netChange(input, since, recapAssets(recap));
    return recap;
}

/**
 * The change of the balances (available and locked in orders) of `assets` since `since`: every operation of the loaded
 * history is replayed oldest first, as the balance chart does, so that an order placed before the window and
 * cancelled or expired in it is refunded as it was locked; only what happened since `since` is added up.
 */
export function netChange(
    input: RecapInput,
    since: number,
    assets: string[]
): Totals {
    const net: Totals = new Map();
    const chronological = input.entries.slice().reverse();
    assets.forEach(assetId => {
        const orders = newOrderTracker();
        let total = BigInt(0);
        for (const entry of chronological) {
            const resolved = operationDelta(
                entry as HistoryEntry,
                input.accountId,
                assetId,
                orders
            );
            const time = input.times[entry.block_num];
            if (time !== undefined && time >= since) {
                total += resolved.delta + resolved.locked;
            }
        }
        if (total !== BigInt(0)) net.set(assetId, total);
    });
    return net;
}

/** The asset ids a recap names, to be looked up before it is written out. */
export function recapAssets(recap: DayRecap): string[] {
    const ids = new Set<string>();
    [
        recap.transfersIn.total,
        recap.transfersOut.total,
        recap.fills.sold,
        recap.fills.got,
        recap.fees,
        recap.net
    ].forEach(totals => totals.forEach((_amount, id) => ids.add(id)));
    return Array.from(ids);
}

/** The largest few totals first (by their size in smallest units, which is as good as any order without prices). */
export function largest(
    totals: Totals,
    count: number
): {shown: Array<[string, bigint]>; more: number} {
    const rows = Array.from(totals.entries()).filter(
        ([, amount]) => amount > BigInt(0)
    );
    rows.sort((a, b) => (a[1] > b[1] ? -1 : a[1] < b[1] ? 1 : 0));
    return {
        shown: rows.slice(0, count),
        more: Math.max(0, rows.length - count)
    };
}

/** Nothing happened in the window (and the window is all there). */
export const isQuiet = (recap: DayRecap): boolean =>
    recap.operations === 0 && recap.covered;
