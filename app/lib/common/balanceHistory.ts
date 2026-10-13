// Balance of one asset over time, rebuilt from the account's operation history.
//
// The chain does not keep past balances. What a node can give is the account's
// operations, so the history is rebuilt backwards from the one number that is
// known exactly, the balance now: each operation's effect on the balance is
// undone, newest first. That is exact for the operations understood here
// (transfers, fees, fills, cancels, vesting, issuing, margin, pools, HTLC ...)
// and says so for the rest:
//
// - an operation that touches the asset but is not understood is counted in
//   `unresolved` and its effect is missing from the line;
// - an order's deferred fee, which core hands back when an order is cancelled,
//   is not in any operation (a few hundredths of the fee asset, per order);
// - history older than what was loaded is simply not drawn.
//
// Pure functions of plain data (no chain access), so they are tested directly.

// Operation ids (bitsharesjs ChainTypes.operations).
const OP = {
    transfer: 0,
    limit_order_create: 1,
    limit_order_cancel: 2,
    call_order_update: 3,
    fill_order: 4,
    asset_issue: 14,
    asset_reserve: 15,
    asset_fund_fee_pool: 16,
    asset_settle: 17,
    asset_settle_cancel: 42,
    fba_distribute: 44,
    execute_bid: 46,
    vesting_balance_create: 32,
    vesting_balance_withdraw: 33,
    balance_claim: 37,
    htlc_create: 49,
    htlc_redeemed: 51,
    htlc_refund: 53,
    credit_deal_expired: 74
};

// Virtual operations carry no fee of their own.
const VIRTUAL = new Set<number>([
    OP.fill_order,
    OP.asset_settle_cancel,
    OP.fba_distribute,
    OP.execute_bid,
    OP.htlc_redeemed,
    OP.htlc_refund,
    OP.credit_deal_expired
]);

// The field naming the account that pays the fee, per operation. Anything not
// listed falls back to the first of FEE_PAYER_FALLBACK present.
const FEE_PAYER: {[id: number]: string} = {
    0: "from",
    1: "seller",
    2: "fee_paying_account",
    3: "funding_account",
    5: "registrar",
    6: "account",
    7: "authorizing_account",
    8: "account_to_upgrade",
    9: "account_id",
    10: "issuer",
    11: "issuer",
    12: "issuer",
    13: "issuer",
    14: "issuer",
    15: "payer",
    16: "from_account",
    17: "account",
    18: "issuer",
    19: "publisher",
    20: "witness_account",
    21: "witness_account",
    22: "fee_paying_account",
    23: "fee_paying_account",
    24: "fee_paying_account",
    25: "withdraw_from_account",
    26: "withdraw_from_account",
    27: "authorized_account",
    28: "withdraw_from_account",
    29: "committee_member_account",
    30: "committee_member_account",
    32: "creator",
    33: "owner",
    34: "owner",
    35: "payer",
    36: "fee_paying_account",
    37: "deposit_to_account",
    38: "issuer",
    43: "issuer",
    45: "bidder",
    47: "issuer",
    48: "issuer",
    49: "from",
    50: "redeemer",
    52: "update_issuer"
};
const FEE_PAYER_FALLBACK = [
    "account",
    "owner_account",
    "borrower",
    "funding_account",
    "fee_paying_account",
    "from",
    "seller",
    "owner",
    "issuer",
    "creator"
];

export interface HistoryEntry {
    id: string;
    op: [number, any];
    result?: [number, any];
    block_num: number;
}

export interface Resolved {
    delta: bigint;
    /** The operation touches the asset but this code cannot say how much. */
    unresolved: boolean;
}

const big = (v: any): bigint => {
    try {
        return BigInt(v);
    } catch (e) {
        return BigInt(0);
    }
};

const isAsset = (a: any, assetId: string): boolean =>
    !!a && typeof a === "object" && a.asset_id === assetId && a.amount != null;

/** Whether a JSON subtree names the asset in an `asset_id` field. */
function mentions(value: any, assetId: string, depth = 0): boolean {
    if (!value || typeof value !== "object" || depth > 6) return false;
    if (Array.isArray(value)) {
        return value.some(v => mentions(v, assetId, depth + 1));
    }
    if (value.asset_id === assetId) return true;
    return Object.keys(value).some(k => mentions(value[k], assetId, depth + 1));
}

export interface OrderTracker {
    /** order id -> {asset, remaining amount for sale} */
    remaining: {[orderId: string]: {assetId: string; amount: bigint}};
}

export function newOrderTracker(): OrderTracker {
    return {remaining: {}};
}

/**
 * What one operation did to `accountId`'s balance of `assetId`. Call in
 * chronological order (oldest first) with one tracker: expired orders are
 * refunded from what the tracker knows of the order.
 */
export function operationDelta(
    entry: HistoryEntry,
    accountId: string,
    assetId: string,
    orders: OrderTracker
): Resolved {
    const [id, d] = entry.op;
    let delta = BigInt(0);
    let handled = true;
    const add = (amount: any) => {
        delta += big(amount);
    };
    const sub = (amount: any) => {
        delta -= big(amount);
    };

    switch (id) {
        case OP.transfer:
            if (d.from === accountId && isAsset(d.amount, assetId))
                sub(d.amount.amount);
            if (d.to === accountId && isAsset(d.amount, assetId))
                add(d.amount.amount);
            break;
        case OP.limit_order_create: {
            if (d.seller === accountId && isAsset(d.amount_to_sell, assetId))
                sub(d.amount_to_sell.amount);
            // remember what is locked in the order, to refund an expiry
            const orderId =
                entry.result && entry.result[0] === 1 ? entry.result[1] : null;
            if (orderId && d.seller === accountId && d.amount_to_sell) {
                orders.remaining[orderId] = {
                    assetId: d.amount_to_sell.asset_id,
                    amount: big(d.amount_to_sell.amount)
                };
            }
            break;
        }
        case OP.limit_order_cancel: {
            const tracked = orders.remaining[d.order];
            if (entry.result && entry.result[0] === 2) {
                // cancelled by the user: the result is the refunded amount
                if (isAsset(entry.result[1], assetId))
                    add(entry.result[1].amount);
            } else if (tracked) {
                // expired or culled: refund what was still for sale
                if (tracked.assetId === assetId) add(tracked.amount);
            } else {
                handled = false;
            }
            if (tracked) delete orders.remaining[d.order];
            break;
        }
        case OP.fill_order: {
            if (d.account_id !== accountId) break;
            // `receives` is gross; the market fee is taken from it. `pays`
            // left the balance when the order was created.
            if (isAsset(d.receives, assetId)) add(d.receives.amount);
            if (isAsset(d.fee, assetId)) sub(d.fee.amount);
            const tracked = orders.remaining[d.order_id];
            if (tracked && d.pays) {
                tracked.amount -= big(d.pays.amount);
                if (tracked.amount <= BigInt(0))
                    delete orders.remaining[d.order_id];
            }
            break;
        }
        case OP.call_order_update:
            if (d.funding_account === accountId) {
                if (isAsset(d.delta_collateral, assetId))
                    sub(d.delta_collateral.amount);
                if (isAsset(d.delta_debt, assetId)) add(d.delta_debt.amount);
            }
            break;
        case OP.asset_issue:
            if (
                d.issue_to_account === accountId &&
                isAsset(d.asset_to_issue, assetId)
            )
                add(d.asset_to_issue.amount);
            break;
        case OP.asset_reserve:
            if (d.payer === accountId && isAsset(d.amount_to_reserve, assetId))
                sub(d.amount_to_reserve.amount);
            break;
        case OP.asset_fund_fee_pool:
            if (d.from_account === accountId && assetId === "1.3.0")
                sub(d.amount);
            break;
        case OP.asset_settle:
            if (d.account === accountId && isAsset(d.amount, assetId))
                sub(d.amount.amount);
            if (
                d.account === accountId &&
                entry.result &&
                entry.result[0] === 2 &&
                isAsset(entry.result[1], assetId)
            )
                add(entry.result[1].amount);
            break;
        case OP.vesting_balance_create:
            if (d.creator === accountId && isAsset(d.amount, assetId))
                sub(d.amount.amount);
            break;
        case OP.vesting_balance_withdraw:
            if (d.owner === accountId && isAsset(d.amount, assetId))
                add(d.amount.amount);
            break;
        case OP.balance_claim:
            if (
                d.deposit_to_account === accountId &&
                isAsset(d.total_claimed, assetId)
            )
                add(d.total_claimed.amount);
            break;
        case OP.htlc_create:
            if (d.from === accountId && isAsset(d.amount, assetId))
                sub(d.amount.amount);
            break;
        case OP.htlc_redeemed:
            if (d.to === accountId && isAsset(d.amount, assetId))
                add(d.amount.amount);
            break;
        case OP.htlc_refund:
            if (d.to === accountId && isAsset(d.htlc_amount, assetId))
                add(d.htlc_amount.amount);
            break;
        default: {
            // Pools, credit offers and other exchanges report what moved in
            // their result: paid, received and fees.
            const r = entry.result && entry.result[1];
            if (
                r &&
                Array.isArray(r.paid) &&
                Array.isArray(r.received) &&
                (VIRTUAL.has(id) ? false : true)
            ) {
                r.paid.forEach(
                    (a: any) => isAsset(a, assetId) && sub(a.amount)
                );
                r.received.forEach(
                    (a: any) => isAsset(a, assetId) && add(a.amount)
                );
                (r.fees || []).forEach(
                    (a: any) => isAsset(a, assetId) && sub(a.amount)
                );
                // the operation's own fee is part of `fees`
                return {delta, unresolved: false};
            }
            handled = false;
        }
    }

    // The operation's own fee, paid by the account that signs it.
    if (!VIRTUAL.has(id) && d && d.fee && isAsset(d.fee, assetId)) {
        const field =
            FEE_PAYER[id] || FEE_PAYER_FALLBACK.find(f => d[f] !== undefined);
        if (field && d[field] === accountId) sub(d.fee.amount);
    }

    const unresolved = !handled && mentions(d, assetId);
    return {delta, unresolved};
}

export interface SeriesPoint {
    /** Unix seconds. */
    time: number;
    /** Smallest-unit balance after this point. */
    balance: bigint;
}

export interface BalanceSeries {
    points: SeriesPoint[];
    /** Operations that touch the asset and could not be read. */
    unresolved: number;
    /** Operations whose effect was applied. */
    applied: number;
}

/**
 * The balance after each operation, oldest first, ending at `currentBalance`.
 *
 * @param entriesNewestFirst the account's history as the node returns it
 * @param blockTimes block number -> unix seconds
 */
export function buildBalanceSeries(
    entriesNewestFirst: HistoryEntry[],
    currentBalance: bigint,
    accountId: string,
    assetId: string,
    blockTimes: {[block: number]: number},
    nowSec: number
): BalanceSeries {
    const chronological = entriesNewestFirst.slice().reverse();
    const orders = newOrderTracker();
    const deltas = chronological.map(entry => ({
        entry,
        ...operationDelta(entry, accountId, assetId, orders)
    }));

    let unresolved = 0;
    let applied = 0;
    // balance after each entry, from the end backwards
    const after: bigint[] = new Array(deltas.length);
    let running = currentBalance;
    for (let i = deltas.length - 1; i >= 0; i--) {
        after[i] = running;
        running -= deltas[i].delta;
        if (deltas[i].unresolved) unresolved++;
        else if (deltas[i].delta !== BigInt(0)) applied++;
    }

    const points: SeriesPoint[] = [];
    const push = (time: number, balance: bigint) => {
        const last = points[points.length - 1];
        if (last && last.time === time) last.balance = balance;
        else points.push({time, balance});
    };

    // the balance before the oldest loaded operation, at that operation's time
    if (deltas.length) {
        const firstTime = blockTimes[deltas[0].entry.block_num];
        if (firstTime !== undefined) push(firstTime - 1, running);
    }
    deltas.forEach((row, i) => {
        const time = blockTimes[row.entry.block_num];
        if (time !== undefined && row.delta !== BigInt(0)) push(time, after[i]);
    });
    push(
        Math.max(nowSec, points.length ? points[points.length - 1].time : 0),
        currentBalance
    );

    // times must be strictly increasing for the chart
    const strict: SeriesPoint[] = [];
    points.forEach(p => {
        const last = strict[strict.length - 1];
        if (last && p.time <= last.time) last.balance = p.balance;
        else strict.push(p);
    });
    return {points: strict, unresolved, applied};
}
