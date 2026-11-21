// What a swap against a constant-product liquidity pool pays out, computed the
// way the chain computes it (libraries/chain/liquidity_pool_evaluator.cpp,
// `liquidity_pool_exchange_evaluator::do_evaluate`), in integers of the assets'
// smallest units, so the quote on screen is the amount the transaction will
// really yield at the pool's current balances.
//
//   1. the maker market fee of the asset sold is taken off the amount sold;
//   2. the pool's new balance of the sold asset is the old one plus the rest;
//   3. its new balance of the other asset is ceil(k / new balance) (k, the
//      pool's invariant, is balance_a * balance_b);
//   4. the difference to the old balance is what leaves the pool, less the
//      pool's taker fee (floor, in 0.01% units);
//   5. the taker market fee of the asset received comes off that.
//
// Stable pools (a different curve) are not computed here: `quoteExactIn`
// returns null for them and the screen asks for both amounts by hand.
//
// This is display arithmetic. The transaction carries `amount_to_sell` and
// `min_to_receive`; the chain applies its own rules to them.

const HUNDRED_PERCENT = BigInt(10000);

/** What an asset charges as a market fee, from its options. */
export interface MarketFee {
    /** The `charge_market_fee` flag (bit 0 of the options' flags). */
    charges: boolean;
    /** `market_fee_percent`, in 0.01% (also the taker's if it has none). */
    makerPercent: number;
    /** `extensions.taker_fee_percent` when the asset sets one. */
    takerPercent: number | null;
    /** `max_market_fee`, smallest units. */
    max: bigint;
}

export const NO_MARKET_FEE: MarketFee = {
    charges: false,
    makerPercent: 0,
    takerPercent: null,
    max: BigInt(0)
};

export function marketFee(
    fee: MarketFee,
    amount: bigint,
    isMaker: boolean
): bigint {
    if (!fee.charges) return BigInt(0);
    if (isMaker && fee.makerPercent === 0) return BigInt(0);
    if (!isMaker && fee.takerPercent !== null && fee.takerPercent === 0) {
        return BigInt(0);
    }
    const percent = isMaker
        ? fee.makerPercent
        : fee.takerPercent !== null
        ? fee.takerPercent
        : fee.makerPercent;
    const value = (amount * BigInt(percent)) / HUNDRED_PERCENT;
    return value > fee.max ? fee.max : value;
}

export interface SwapPool {
    /** Reserves, smallest units: `balanceIn` of the asset being sold. */
    balanceIn: bigint;
    balanceOut: bigint;
    /** The pool's taker fee, in 0.01% (20 = 0.2%). */
    takerFeePercent: number;
    feeIn: MarketFee;
    feeOut: MarketFee;
    /** The stable curve is not computed here. */
    stable?: boolean;
}

export interface SwapQuote {
    /** What the account receives. */
    receive: bigint;
    /** What the account pays. */
    pay: bigint;
    poolFee: bigint;
    makerMarketFee: bigint;
    takerMarketFee: bigint;
    /** What would have been received at the pool's spot ratio, before any
     * fee or slippage; `receive / ideal` shows what the trade cost. */
    ideal: bigint;
    /** The pool's balances after the swap. */
    newBalanceIn: bigint;
    newBalanceOut: bigint;
}

/** What selling exactly `pay` yields, or null when the swap cannot be made
 * (nothing to sell, a fee as large as the amount, nothing would be paid). */
export function quoteExactIn(pool: SwapPool, pay: bigint): SwapQuote | null {
    if (pool.stable) return null;
    if (pay <= BigInt(0)) return null;
    if (pool.balanceIn <= BigInt(0) || pool.balanceOut <= BigInt(0)) {
        return null;
    }
    const makerMarketFee = marketFee(pool.feeIn, pay, true);
    if (makerMarketFee >= pay) return null;
    const poolReceives = pay - makerMarketFee;

    const k = pool.balanceIn * pool.balanceOut;
    const newIn = pool.balanceIn + poolReceives;
    const newOut = (k + newIn - BigInt(1)) / newIn; // rounded up, pool's favour
    if (newOut > pool.balanceOut) return null;
    const delta = pool.balanceOut - newOut;
    const poolFee = (delta * BigInt(pool.takerFeePercent)) / HUNDRED_PERCENT;
    const poolPays = delta - poolFee;
    const takerMarketFee = marketFee(pool.feeOut, poolPays, false);
    if (takerMarketFee > poolPays) return null;
    const receive = poolPays - takerMarketFee;

    return {
        receive,
        pay,
        poolFee,
        makerMarketFee,
        takerMarketFee,
        ideal: (pay * pool.balanceOut) / pool.balanceIn,
        newBalanceIn: newIn,
        newBalanceOut: pool.balanceOut - poolPays
    };
}

/**
 * The least that has to be sold to receive at least `receive`, or null when
 * the pool cannot pay that much. The chain has no "exact out" operation, so
 * this searches `quoteExactIn` (which only ever grows with the amount sold).
 */
export function quoteExactOut(
    pool: SwapPool,
    receive: bigint
): SwapQuote | null {
    if (pool.stable) return null;
    if (receive <= BigInt(0)) return null;
    if (receive >= pool.balanceOut) return null;

    // grow the upper bound until it pays enough, or give up
    let high = receive + BigInt(1);
    let found: SwapQuote | null = null;
    for (let i = 0; i < 200; i++) {
        const q = quoteExactIn(pool, high);
        if (q && q.receive >= receive) {
            found = q;
            break;
        }
        high *= BigInt(2);
        if (high > pool.balanceIn * BigInt(1000000) + receive * BigInt(4)) {
            return null;
        }
    }
    if (!found) return null;
    let low = BigInt(0); // pays too little (or is not valid)
    while (high - low > BigInt(1)) {
        const mid = (low + high) / BigInt(2);
        const q = quoteExactIn(pool, mid);
        if (q && q.receive >= receive) {
            high = mid;
            found = q;
        } else {
            low = mid;
        }
    }
    return found;
}

/** How much worse than the pool's spot ratio the swap is (0.01 = 1%): the
 * price impact of the size plus the fees. */
export function priceImpact(quote: SwapQuote): number {
    if (quote.ideal <= BigInt(0)) return 0;
    const lost = Number(quote.ideal - quote.receive);
    return Math.max(0, lost / Number(quote.ideal));
}

/** The least to accept for `receive` with `slippage` (0.005 = 0.5%) allowed
 * on top of what the quote says: what goes into `min_to_receive`. */
export function minReceive(receive: bigint, slippage: number): bigint {
    const basis = BigInt(Math.round(slippage * 10000)); // 0.5% -> 50
    const kept =
        HUNDRED_PERCENT - (basis > HUNDRED_PERCENT ? HUNDRED_PERCENT : basis);
    return (receive * kept) / HUNDRED_PERCENT;
}
