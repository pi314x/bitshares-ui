// A sale sold into the pools of a pair and its order book at once.
//
// Selling into a venue moves its price (a pool along its curve, a book up its orders), so a sale that is large
// for one venue pays more when the part of it that the other venue takes at a better price goes there: the best
// split is where the venues' prices after the sale are equal. That is worked out with the pools' curves and the
// book's prices (floats, market fees left out), and what it gives is then QUOTED exactly the way a single venue
// is quoted (`quoteExactIn`, `fillFromOrderBook`): the split is returned only when those exact quotes pay at
// least a little more than the best single venue, so nothing is promised that the chain would not pay, and a
// split that does not help is not made.
//
// Used by the swap dialog of a pool (the sale is made in one transaction: the pool exchange and a fill-or-kill
// order).
import {
    BookFill,
    BookOrder,
    fillFromOrderBook,
    matchingOrders
} from "./priceCompare";
import {
    MarketFee,
    SwapPool,
    SwapQuote,
    marketFee,
    minReceive,
    quoteExactIn
} from "./poolSwap";

const ZERO = BigInt(0);

/** The split must pay at least this many times less than the best venue alone pays more (1/2000 = 0.05%). */
export const SPLIT_MIN_GAIN = BigInt(2000);
/** and each venue must take at least this part of the sale (1/200 = 0.5%). */
export const SPLIT_MIN_SHARE = BigInt(200);

function ceilDiv(a: bigint, b: bigint): bigint {
    return (a + b - BigInt(1)) / b;
}

export interface SplitPoolInput {
    id: string;
    /** the pool as seen from the sale: `balanceIn` is the asset sold */
    swap: SwapPool;
}

export interface SplitSwapInput {
    pools: SplitPoolInput[];
    /** the open orders of the pair (both directions) */
    book: BookOrder[];
    payAsset: string;
    receiveAsset: string;
    /** what is sold, smallest units */
    pay: bigint;
    /** the market fee of the received asset (the book's) */
    feeOut: MarketFee;
    /** what the best single venue pays for the same sale (null: none can) */
    best: bigint | null;
}

export interface SplitSwapResult {
    /** the pools that take a part, the one that takes most first */
    pools: Array<{id: string; pay: bigint; quote: SwapQuote}>;
    book: {pay: bigint; fill: BookFill};
    /** what the account receives in all, after the market fee of the received asset */
    receive: bigint;
    /** what is sold in all (the dust a book could not take goes to a pool) */
    pay: bigint;
}

/** The split of the sale, or null where one venue alone is as good (or no split can be made). */
export function splitSwap(input: SplitSwapInput): SplitSwapResult | null {
    const {pools, book, payAsset, receiveAsset, pay: available, best} = input;
    const orders = matchingOrders(book, payAsset, receiveAsset);
    const usable = pools.filter(
        p =>
            p.swap.balanceIn > ZERO &&
            p.swap.balanceOut > ZERO &&
            !p.swap.stable
    );
    if (!usable.length || !orders.length || available <= ZERO) return null;

    // the pools: out(y) = keep * c * y * out / (in + c * y) - the marginal rate falls as the sale grows
    const feeIn = usable[0].swap.feeIn;
    const c = feeIn.charges ? 1 - feeIn.makerPercent / 10000 : 1;
    const models = usable.map(p => ({
        rin: Number(p.swap.balanceIn),
        rout: Number(p.swap.balanceOut),
        keep: 1 - p.swap.takerFeePercent / 10000
    }));
    // what the pool takes while its marginal rate is at least `rate`
    const absorb = (m: typeof models[number], rate: number): number => {
        const y = (Math.sqrt((c * m.keep * m.rout * m.rin) / rate) - m.rin) / c;
        return y > 0 ? y : 0;
    };
    const poolsAt = (rate: number) =>
        models.reduce((sum, m) => sum + absorb(m, rate), 0);

    // the book: whole orders, the best first; where the pools' marginal rate meets an order's price the
    // book stops (that order partly)
    const x = Number(available);
    const rates = orders.map(o => Number(o.base) / Number(o.quote));
    const costs = orders.map(o => ceilDiv(o.forSale * o.quote, o.base));
    let before = ZERO;
    let whole = orders.length;
    let part = 0;
    for (let j = 0; j < orders.length; j++) {
        const pools_ = poolsAt(rates[j]);
        const after = before + costs[j];
        if (pools_ + Number(after) >= x) {
            whole = j;
            part = Math.max(0, x - pools_ - Number(before));
            break;
        }
        before = after;
    }
    let bookPay = before;
    if (part > 0 && whole < orders.length) {
        const partial = BigInt(
            Math.floor(Math.min(part, Number(costs[whole])))
        );
        bookPay += partial;
    }
    if (bookPay <= ZERO) return null;
    const fill = fillFromOrderBook(
        book,
        payAsset,
        receiveAsset,
        bookPay,
        input.feeOut
    );
    if (!fill.complete || fill.spent <= ZERO || fill.receive <= ZERO) {
        return null;
    }
    const rest = available - fill.spent;
    // both parts are a part worth an operation of its own (a pool left with the dust of a book is not a split)
    const smallest = available / SPLIT_MIN_SHARE;
    if (rest <= ZERO || rest < smallest || fill.spent < smallest) return null;

    // the pools take the rest: one pool all of it, several where their marginal rates are equal
    const share: number[] = models.map(() => 0);
    if (models.length === 1) {
        share[0] = 1;
    } else {
        let low = 1e-30;
        let high = Math.max(...models.map(m => (m.keep * m.rout) / m.rin)) * 2;
        for (let i = 0; i < 80; i++) {
            const mid = Math.sqrt(low * high);
            if (poolsAt(mid) > Number(rest)) low = mid;
            else high = mid;
        }
        const alloc = models.map(m => absorb(m, high));
        const total = alloc.reduce((a, b) => a + b, 0);
        alloc.forEach((a, i) => (share[i] = total > 0 ? a / total : 0));
    }
    const taking: SplitSwapResult["pools"] = [];
    let given = ZERO;
    const biggest = share.indexOf(Math.max(...share));
    for (let i = 0; i < usable.length; i++) {
        if (i === biggest) continue;
        const pay = BigInt(Math.floor(share[i] * Number(rest)));
        if (pay <= ZERO) continue;
        const quote = quoteExactIn(usable[i].swap, pay);
        if (!quote || quote.receive <= ZERO) return null;
        taking.push({id: usable[i].id, pay, quote});
        given += pay;
    }
    // (the rounding goes to the pool that takes most, which comes first)
    const mainPay = rest - given;
    const main = quoteExactIn(usable[biggest].swap, mainPay);
    if (!main || main.receive <= ZERO) return null;
    taking.unshift({id: usable[biggest].id, pay: mainPay, quote: main});

    const receive =
        taking.reduce((sum, p) => sum + p.quote.receive, ZERO) + fill.receive;
    if (best !== null) {
        const enough = best + best / SPLIT_MIN_GAIN;
        if (receive <= enough || receive <= best + BigInt(1)) return null;
    }
    return {
        pools: taking,
        book: {pay: fill.spent, fill},
        receive,
        pay: given + mainPay + fill.spent
    };
}

export interface SplitSwapOperations {
    /** the pool exchange, then the fill-or-kill order: one transaction */
    operations: Array<[string, any]>;
    /** the least the pool's part may give (its quote less the slippage) */
    poolMin: bigint;
    /** the order's price limit: the worst order its part needs, so that all of it is matched */
    bookLimit: bigint;
    /** the least the two parts give together, the order's at its price limit and after the market fee */
    least: bigint;
}

/**
 * The operations of a split sale: the exchange with the pool for its part (`min_to_receive` is its quote less the
 * slippage the account accepts) and a fill-or-kill order for the book's part, priced at the worst order it needs.
 * A fill-or-kill order that cannot be matched in full is killed by the chain, and a transaction is all or nothing,
 * so both parts are made or neither is. Null where the book's part has no price (nothing was walked).
 */
export function splitSwapOperations(input: {
    accountId: string;
    poolId: string;
    payAsset: string;
    receiveAsset: string;
    split: SplitSwapResult;
    slippage: number;
    feeOut: MarketFee;
    expiration: Date;
}): SplitSwapOperations | null {
    const {split} = input;
    const worst = split.book.fill.worst;
    const part = split.pools[0];
    if (!worst || !part) return null;
    const bookLimit = (split.book.pay * worst.base) / worst.quote;
    const poolMin = minReceive(part.quote.receive, input.slippage);
    const fee = {amount: "0", asset_id: "1.3.0"};
    return {
        poolMin,
        bookLimit,
        least:
            poolMin + (bookLimit - marketFee(input.feeOut, bookLimit, false)),
        operations: [
            [
                "liquidity_pool_exchange",
                {
                    fee,
                    account: input.accountId,
                    pool: input.poolId,
                    amount_to_sell: {
                        amount: part.pay.toString(),
                        asset_id: input.payAsset
                    },
                    min_to_receive: {
                        amount: poolMin.toString(),
                        asset_id: input.receiveAsset
                    },
                    extensions: []
                }
            ],
            [
                "limit_order_create",
                {
                    fee,
                    seller: input.accountId,
                    amount_to_sell: {
                        amount: split.book.pay.toString(),
                        asset_id: input.payAsset
                    },
                    min_to_receive: {
                        amount: bookLimit.toString(),
                        asset_id: input.receiveAsset
                    },
                    expiration: input.expiration.toISOString().slice(0, 19),
                    fill_or_kill: true,
                    extensions: []
                }
            ]
        ]
    };
}
