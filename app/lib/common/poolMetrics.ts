// What the liquidity pool screens show about a pool, derived from the node's
// `liquidity_pool_object` (and its optional `statistics`, the 24h/total ticker
// of the market-history plugin). Pure functions, no chain access: the caller
// supplies the two assets' precisions.
//
// Amounts arrive as integers in the asset's smallest unit - JSON numbers or,
// for 128-bit values, strings - and are converted to display units as plain
// numbers. That is lossy above 2^53 (a pool of 9e15 base units), which is fine
// for showing a figure and sorting by it; nothing here is used to build an
// operation.

export interface PoolStatistics {
    _24h_exchange_a2b_count?: number;
    _24h_exchange_a2b_amount_a?: string | number;
    _24h_exchange_a2b_amount_b?: string | number;
    _24h_exchange_b2a_count?: number;
    _24h_exchange_b2a_amount_a?: string | number;
    _24h_exchange_b2a_amount_b?: string | number;
    _24h_exchange_fee_a?: string | number;
    _24h_exchange_fee_b?: string | number;
    total_exchange_a2b_count?: number;
    total_exchange_b2a_count?: number;
}

export interface PoolLike {
    id: string;
    asset_a: string;
    asset_b: string;
    balance_a: string | number;
    balance_b: string | number;
    share_asset: string;
    taker_fee_percent: number;
    withdrawal_fee_percent: number;
    /** Only on nodes that know StableSwap pools. */
    pool_type?: string | number;
    amplification?: string | number;
    statistics?: PoolStatistics | null;
}

export interface PoolMetrics {
    /** Reserves in display units. */
    reserveA: number;
    reserveB: number;
    /** How much B one unit of A buys at the pool's current balance ratio. */
    priceBPerA: number | null;
    /** The pool's value counted in asset A: A plus B at that ratio. */
    poolValueA: number;
    /** What went through the pool in 24h, counted in asset A. */
    volume24hA: number | null;
    /** The fees collected in 24h, counted in asset A. */
    fees24hA: number | null;
    /** 24h fees as a share of the pool's value (0.01 = 1%). */
    feeYield24h: number | null;
    isStable: boolean;
}

const BTS = "1.3.0";

function num(value: string | number | undefined | null): number {
    if (value === undefined || value === null) return 0;
    const n = typeof value === "number" ? value : parseFloat(value);
    return Number.isFinite(n) ? n : 0;
}

/** Display units from the smallest unit. */
export function toUnits(raw: string | number, precision: number): number {
    return num(raw) / Math.pow(10, precision);
}

export function isStablePool(pool: PoolLike): boolean {
    // 0 / "constant_product" for the original curve; the stable curve is 1 /
    // "stable". A node without StableSwap sends neither field.
    return pool.pool_type === 1 || pool.pool_type === "stable";
}

export function poolMetrics(
    pool: PoolLike,
    precisionA: number,
    precisionB: number
): PoolMetrics {
    const reserveA = toUnits(pool.balance_a, precisionA);
    const reserveB = toUnits(pool.balance_b, precisionB);
    const priceBPerA =
        reserveA > 0 && reserveB > 0 ? reserveB / reserveA : null;
    const poolValueA =
        priceBPerA !== null ? reserveA + reserveB / priceBPerA : reserveA;

    let volume24hA: number | null = null;
    let fees24hA: number | null = null;
    const stats = pool.statistics;
    if (stats) {
        // A -> B exchanges put `amount_a` into the pool, B -> A exchanges take
        // `amount_a` out of it: both count towards the volume in A.
        const inA = toUnits(stats._24h_exchange_a2b_amount_a || 0, precisionA);
        const outA = toUnits(stats._24h_exchange_b2a_amount_a || 0, precisionA);
        volume24hA = inA + outA;
        const feeA = toUnits(stats._24h_exchange_fee_a || 0, precisionA);
        const feeB = toUnits(stats._24h_exchange_fee_b || 0, precisionB);
        fees24hA = feeA + (priceBPerA !== null ? feeB / priceBPerA : 0);
    }

    return {
        reserveA,
        reserveB,
        priceBPerA,
        poolValueA,
        volume24hA,
        fees24hA,
        feeYield24h:
            fees24hA !== null && poolValueA > 0 ? fees24hA / poolValueA : null,
        isStable: isStablePool(pool)
    };
}

/** The pool's value in BTS when BTS is one side of it (BTS, 1.3.0, is always
 * asset A of such a pool), otherwise null: a different unit has no common
 * ground to compare against. */
export function poolValueInBts(
    pool: PoolLike,
    metrics: PoolMetrics
): number | null {
    return pool.asset_a === BTS ? metrics.poolValueA : null;
}

export interface PoolShare {
    /** The holder's part of the pool (0.25 = 25%). */
    fraction: number;
    amountA: number;
    amountB: number;
}

/** What a holder of `shares` (display units of the share asset) of a pool with
 * `supply` shares in circulation can take out, before the withdrawal fee. */
export function shareOfPool(
    shares: number,
    supply: number,
    reserveA: number,
    reserveB: number
): PoolShare {
    if (!(supply > 0) || !(shares > 0)) {
        return {fraction: 0, amountA: 0, amountB: 0};
    }
    const fraction = Math.min(1, shares / supply);
    return {
        fraction,
        amountA: reserveA * fraction,
        amountB: reserveB * fraction
    };
}

export type PoolSortKey = "value" | "volume" | "newest";

export interface SortablePool {
    pool: PoolLike;
    metrics: PoolMetrics;
}

function idNumber(id: string): number {
    return Number(id.split(".")[2]) || 0;
}

/**
 * Orders pools for the list. "value" puts the pools that can be valued in BTS
 * first, largest first, and the rest after them by id; "volume" is the 24h
 * volume counted in each pool's own asset A, with BTS pools first for the same
 * reason; "newest" is the highest pool id first.
 */
export function sortPools<T extends SortablePool>(
    pools: T[],
    key: PoolSortKey
): T[] {
    const list = pools.slice();
    const inBts = (p: T) => p.pool.asset_a === BTS;
    const byIdDesc = (a: T, b: T) => idNumber(b.pool.id) - idNumber(a.pool.id);
    if (key === "newest") return list.sort(byIdDesc);
    const figure = (p: T) =>
        key === "value" ? p.metrics.poolValueA : p.metrics.volume24hA || 0;
    return list.sort((a, b) => {
        if (inBts(a) !== inBts(b)) return inBts(a) ? -1 : 1;
        const d = figure(b) - figure(a);
        return d !== 0 ? d : byIdDesc(a, b);
    });
}

/** A price with a sensible number of digits: 2 above a thousand, 4 above one,
 * and 4 significant digits below. */
export function formatPrice(value: number | null): string {
    if (value === null || !Number.isFinite(value) || value <= 0) return "-";
    if (value >= 1000)
        return value.toLocaleString("en-US", {maximumFractionDigits: 2});
    if (value >= 1)
        return value.toLocaleString("en-US", {maximumFractionDigits: 4});
    const digits = Math.min(10, Math.max(4, 3 - Math.floor(Math.log10(value))));
    return value.toLocaleString("en-US", {maximumFractionDigits: digits});
}

/** An amount, at most `maxDecimals` places, thousands separated; large pools
 * are shortened (1.23M). */
export function formatAmountShort(value: number, maxDecimals = 2): string {
    if (!Number.isFinite(value)) return "-";
    const abs = Math.abs(value);
    if (abs >= 1e9) return (value / 1e9).toFixed(2) + "B";
    if (abs >= 1e6) return (value / 1e6).toFixed(2) + "M";
    return value.toLocaleString("en-US", {maximumFractionDigits: maxDecimals});
}

/** 0.0123 -> "1.23%"; small values get the digits they need ("0.004%"). */
export function formatPercent(fraction: number | null, digits = 2): string {
    if (fraction === null || !Number.isFinite(fraction)) return "-";
    const percent = fraction * 100;
    let places = digits;
    if (percent !== 0 && Math.abs(percent) < 0.1) places = Math.max(digits, 3);
    if (percent !== 0 && Math.abs(percent) < 0.01) places = Math.max(digits, 4);
    return `${percent.toFixed(places)}%`;
}
