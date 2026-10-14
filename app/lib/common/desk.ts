// The arithmetic behind the dashboard's desk cards (holdings, positions,
// attention strip). Pure: chain objects are read by the callers and passed in
// as plain numbers, so everything here is testable without a chain.
//
// Amounts are in the asset's smallest units unless a name says otherwise.
// Values are in the unit the user chose (BTS by default); a value is `null`
// when no market price connects the asset to the unit - never 0, which would
// read as "worth nothing".

// ---------------------------------------------------------------- holdings

export interface HoldingInput {
    assetId: string;
    symbol: string;
    precision: number;
    /** smallest units */
    units: number;
    /** in the chosen unit, or null without a price */
    value: number | null;
}

export interface HoldingRow extends HoldingInput {
    /** units / 10^precision */
    amount: number;
    /** value / total, or null without a price or a total */
    share: number | null;
}

/** Rows for the holdings table: biggest value first, unpriced last. */
export function holdingRows(
    inputs: HoldingInput[]
): {rows: HoldingRow[]; total: number; unpriced: number} {
    const held = inputs.filter(input => input.units > 0);
    const total = held.reduce(
        (sum, input) => sum + (input.value !== null ? input.value : 0),
        0
    );
    const rows: HoldingRow[] = held.map(input => ({
        ...input,
        amount: input.units / Math.pow(10, input.precision),
        share: input.value !== null && total > 0 ? input.value / total : null
    }));
    rows.sort((a, b) => {
        if (a.value === null && b.value === null) {
            return a.symbol.localeCompare(b.symbol);
        }
        if (a.value === null) return 1;
        if (b.value === null) return -1;
        return b.value - a.value;
    });
    return {rows, total, unpriced: rows.filter(r => r.value === null).length};
}

// -------------------------------------------------------- borrow positions

export interface PositionInput {
    id: string;
    debtAssetId: string;
    collateralAssetId: string;
    debtUnits: number;
    collateralUnits: number;
    debtPrecision: number;
    collateralPrecision: number;
    /** the feed's settlement price, as the chain states it: `base` and
     * `quote` amounts of two assets (the smart asset and its collateral) */
    feed: {
        baseUnits: number;
        baseAssetId: string;
        quoteUnits: number;
        quoteAssetId: string;
    } | null;
    /** maintenance collateral ratio in 0.1% (1750 = 175%) */
    mcrPermille: number | null;
}

export type Risk = "ok" | "watch" | "danger";

export interface PositionRisk {
    id: string;
    /** collateral value / debt value at the feed, or null without a feed */
    ratio: number | null;
    /** the ratio at which the position is called (1.75), or null */
    mcr: number | null;
    /** how far the collateral's price may fall before the call (0.3 = 30%);
     * negative when the position is already below the ratio */
    distance: number | null;
    risk: Risk;
}

export function positionRisk(position: PositionInput): PositionRisk {
    const {feed} = position;
    const mcr =
        position.mcrPermille && position.mcrPermille > 0
            ? position.mcrPermille / 1000
            : null;
    const none: PositionRisk = {
        id: position.id,
        ratio: null,
        mcr,
        distance: null,
        risk: "ok"
    };
    if (!feed || !(position.debtUnits > 0) || !(position.collateralUnits > 0)) {
        return none;
    }
    const debt = position.debtUnits / Math.pow(10, position.debtPrecision);
    const collateral =
        position.collateralUnits / Math.pow(10, position.collateralPrecision);

    // debt-asset units per collateral unit
    let debtPerCollateral: number;
    if (
        feed.baseAssetId === position.debtAssetId &&
        feed.quoteAssetId === position.collateralAssetId
    ) {
        const base = feed.baseUnits / Math.pow(10, position.debtPrecision);
        const quote =
            feed.quoteUnits / Math.pow(10, position.collateralPrecision);
        debtPerCollateral = base / quote;
    } else if (
        feed.baseAssetId === position.collateralAssetId &&
        feed.quoteAssetId === position.debtAssetId
    ) {
        const base =
            feed.baseUnits / Math.pow(10, position.collateralPrecision);
        const quote = feed.quoteUnits / Math.pow(10, position.debtPrecision);
        debtPerCollateral = quote / base;
    } else {
        return none;
    }
    if (!Number.isFinite(debtPerCollateral) || !(debtPerCollateral > 0)) {
        return none;
    }

    const ratio = (collateral * debtPerCollateral) / debt;
    if (!mcr) return {...none, ratio};
    const distance = 1 - mcr / ratio;
    const risk: Risk =
        distance < 0.1 ? "danger" : distance < 0.25 ? "watch" : "ok";
    return {id: position.id, ratio, mcr, distance, risk};
}

// ------------------------------------------------------------- open orders

export interface OrderInput {
    id: string;
    /** "2026-10-14T12:00:00" (UTC, no zone) */
    expiration: string;
}

export interface OrderSummary {
    count: number;
    /** the earliest expiry that is not "good till cancelled", or null */
    nextExpiryMs: number | null;
    /** orders that expire within a day */
    expiringSoon: number;
}

/** The chain's "never": orders placed good-till-cancelled carry a far-future
 * time (2106). Anything past 2100 is not an expiry. */
const FOREVER_MS = Date.UTC(2100, 0, 1);
const DAY_MS = 24 * 3600 * 1000;

export function expiryMs(expiration: string): number | null {
    if (!expiration) return null;
    const ms = Date.parse(
        /Z$|[+-]\d\d:\d\d$/.test(expiration) ? expiration : expiration + "Z"
    );
    if (!Number.isFinite(ms) || ms >= FOREVER_MS) return null;
    return ms;
}

export function orderSummary(
    orders: OrderInput[],
    nowMs: number
): OrderSummary {
    let nextExpiryMs: number | null = null;
    let expiringSoon = 0;
    orders.forEach(order => {
        const ms = expiryMs(order.expiration);
        if (ms === null) return;
        if (nextExpiryMs === null || ms < nextExpiryMs) nextExpiryMs = ms;
        if (ms - nowMs <= DAY_MS) expiringSoon++;
    });
    return {count: orders.length, nextExpiryMs, expiringSoon};
}

// ------------------------------------------------------------------ vesting

/** A vesting balance as the node returns it (`get_vesting_balances`). */
export interface VestingBalance {
    id: string;
    balance: {amount: number | string; asset_id: string};
    policy?: [number, any];
}

export interface VestingClaim {
    id: string;
    assetId: string;
    /** what can be withdrawn now, smallest units */
    units: number;
    /** 0..1 of the balance */
    percent: number;
}

/**
 * What of a vesting balance can be claimed at `nowSec`. The chain evaluates the
 * policy when a claim is made; this mirrors the page's own estimate
 * (AccountVesting): policy 0 is linear with a cliff, policy 1 is coin-days.
 */
export function vestingClaim(
    item: VestingBalance,
    nowSec: number
): VestingClaim {
    const balance = Number(item.balance.amount);
    const base = {id: item.id, assetId: item.balance.asset_id};
    const at = (iso: string) =>
        Math.floor(new Date(iso + "Z").getTime() / 1000);
    let percent = 1;
    const policy = item.policy;
    if (policy && policy[0] === 1) {
        const p = policy[1];
        const start = at(p.start_claim);
        if (start > 0) {
            percent = nowSec - start < p.vesting_seconds ? 0 : 1;
        } else {
            const earned =
                parseFloat(p.coin_seconds_earned) +
                balance * (nowSec - at(p.coin_seconds_earned_last_update));
            percent =
                p.vesting_seconds === 0 || balance === 0
                    ? 1
                    : Math.min(1, earned / (p.vesting_seconds * balance));
        }
    } else if (policy && policy[0] === 0) {
        const p = policy[1];
        const elapsed = Math.max(nowSec - at(p.begin_timestamp), 0);
        const vested =
            elapsed >= p.vesting_duration_seconds
                ? 1
                : elapsed < p.vesting_cliff_seconds
                ? 0
                : elapsed / p.vesting_duration_seconds;
        const claimed = p.begin_balance > 0 ? 1 - balance / p.begin_balance : 0;
        percent = Math.max(vested - claimed, 0);
    }
    if (!Number.isFinite(percent)) percent = 0;
    return {...base, units: Math.floor(balance * percent), percent};
}

// ---------------------------------------------------------------- attention

export type AttentionLevel = "danger" | "warn" | "info";

export interface AttentionItem {
    key: string;
    level: AttentionLevel;
    kind: "margin" | "called" | "expiring" | "vesting" | "stale";
    /** values for the message */
    params: {[name: string]: string | number};
}

const LEVEL_ORDER: {[level in AttentionLevel]: number} = {
    danger: 0,
    warn: 1,
    info: 2
};

export function attentionItems(input: {
    risks: Array<PositionRisk & {symbol: string}>;
    expiringOrders: number;
    vesting: Array<{symbol: string; amount: number}>;
    blockAgeSeconds: number | null;
}): AttentionItem[] {
    const items: AttentionItem[] = [];
    input.risks.forEach(r => {
        if (r.ratio === null || r.distance === null || r.risk === "ok") return;
        if (r.distance < 0) {
            items.push({
                key: `called-${r.id}`,
                level: "danger",
                kind: "called",
                params: {symbol: r.symbol, ratio: r.ratio}
            });
        } else {
            items.push({
                key: `margin-${r.id}`,
                level: r.risk === "danger" ? "danger" : "warn",
                kind: "margin",
                params: {
                    symbol: r.symbol,
                    ratio: r.ratio,
                    distance: r.distance
                }
            });
        }
    });
    if (input.expiringOrders > 0) {
        items.push({
            key: "expiring",
            level: "info",
            kind: "expiring",
            params: {count: input.expiringOrders}
        });
    }
    // one line, however many balances: an account can hold dozens of tiny ones
    const claimable = input.vesting.filter(v => v.amount > 0);
    if (claimable.length === 1) {
        items.push({
            key: "vesting",
            level: "info",
            kind: "vesting",
            params: {
                count: 1,
                symbol: claimable[0].symbol,
                amount: claimable[0].amount
            }
        });
    } else if (claimable.length > 1) {
        items.push({
            key: "vesting",
            level: "info",
            kind: "vesting",
            params: {count: claimable.length}
        });
    }
    if (input.blockAgeSeconds !== null && input.blockAgeSeconds > 120) {
        items.push({
            key: "stale",
            level: "warn",
            kind: "stale",
            params: {minutes: Math.floor(input.blockAgeSeconds / 60)}
        });
    }
    return items.sort((a, b) => LEVEL_ORDER[a.level] - LEVEL_ORDER[b.level]);
}
