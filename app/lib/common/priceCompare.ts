// Where is the better price - in the liquidity pool or on the order book?
//
// For the same amount sold, `fillFromOrderBook` walks the book's limit orders
// the way a market order would be matched (cheapest first, each at its own
// price) and returns what that yields; `compareVenues` sets it against the
// pool's quote. Only limit orders are walked: margin-call matches and the
// feed-price limits of smartcoins are not in this simulation, so a book that
// is "better" by a hair is a hint, not a promise. Integers throughout, in the
// assets' smallest units.

import {MarketFee, NO_MARKET_FEE, marketFee} from "./poolSwap";

export interface BookOrder {
    for_sale: string | number;
    sell_price: {
        base: {amount: string | number; asset_id: string};
        quote: {amount: string | number; asset_id: string};
    };
}

export interface BookFill {
    /** What the account receives after the received asset's market fee. */
    receive: bigint;
    /** Before that fee. */
    gross: bigint;
    /** What `spent` would have bought had every unit cost what the best order asks (before the fee). */
    ideal: bigint;
    /** How much of the amount offered was used. */
    spent: bigint;
    /** The amount was matched (the book is deep enough), but for dust. */
    complete: boolean;
    /** How many orders were touched. */
    levels: number;
    /**
     * The worst-priced order touched, as the maker priced it (`quote` of the paid asset per `base` of the
     * received one), or null when none was. A limit order matches only the orders at its own price or
     * better, so the order that is sent must allow this price, not just the average of the fill.
     */
    worst?: {base: bigint; quote: bigint} | null;
}

const ZERO = BigInt(0);

function ceilDiv(a: bigint, b: bigint): bigint {
    return (a + b - BigInt(1)) / b;
}

/** An order that sells the received asset for the paid one: `forSale` of it at `quote` of the paid asset per `base`. */
export interface MatchingOrder {
    forSale: bigint;
    base: bigint;
    quote: bigint;
    /** where it was in the list given */
    index: number;
}

/**
 * The orders of a book that an order paying `payAsset` for `receiveAsset` can be matched with, the cheapest
 * first: the least of `payAsset` per unit of `receiveAsset`.
 */
export function matchingOrders(
    orders: BookOrder[],
    payAsset: string,
    receiveAsset: string
): MatchingOrder[] {
    return orders
        .map((o, index) => ({o, index}))
        .filter(
            ({o}) =>
                o.sell_price.base.asset_id === receiveAsset &&
                o.sell_price.quote.asset_id === payAsset &&
                BigInt(o.sell_price.base.amount) > ZERO &&
                BigInt(o.for_sale) > ZERO
        )
        .map(({o, index}) => ({
            forSale: BigInt(o.for_sale),
            base: BigInt(o.sell_price.base.amount),
            quote: BigInt(o.sell_price.quote.amount),
            index
        }))
        .sort((a, b) => {
            const left = a.quote * b.base;
            const right = b.quote * a.base;
            return left < right ? -1 : left > right ? 1 : 0;
        });
}

/**
 * The price a limit order allows: it sells `pay` and asks for at least `receive`, so it is matched only with
 * the orders that ask no more than `pay / receive` of the paid asset per unit of the received one.
 */
export interface PriceLimit {
    pay: bigint;
    receive: bigint;
}

/** What a walk of the book used: for each order touched, how much of it was taken and what that cost. */
export interface BookWalk {
    fill: BookFill;
    taken: Array<{index: number; take: bigint; cost: bigint}>;
}

/**
 * Sells `pay` of `payAsset` into `orders` for `receiveAsset`, cheapest order first, each at its own price, the
 * way the chain matches an order that sells at once. With `limit` the walk stops at the first order whose price
 * is above what the order allows (a limit order is matched only with the orders at its own price or better).
 * `taken` is what was used of each order, by its place in `orders`.
 */
export function walkOrderBook(
    orders: BookOrder[],
    payAsset: string,
    receiveAsset: string,
    pay: bigint,
    receiveFee: MarketFee = NO_MARKET_FEE,
    limit?: PriceLimit
): BookWalk {
    const matching = matchingOrders(orders, payAsset, receiveAsset);

    let remaining = pay;
    let gross = ZERO;
    let levels = 0;
    let worst: {base: bigint; quote: bigint} | null = null;
    let stoppedInside = false;
    const taken: BookWalk["taken"] = [];
    for (const order of matching) {
        if (remaining <= ZERO) break;
        // the order asks more than the limit allows (and so does every one after it)
        if (limit && order.quote * limit.receive > limit.pay * order.base) {
            break;
        }
        const costAll = ceilDiv(order.forSale * order.quote, order.base);
        let take: bigint;
        let cost: bigint;
        if (remaining >= costAll) {
            take = order.forSale;
            cost = costAll;
        } else {
            take = (remaining * order.base) / order.quote;
            if (take <= ZERO) break;
            cost = ceilDiv(take * order.quote, order.base);
            if (cost > remaining) cost = remaining;
        }
        gross += take;
        remaining -= cost;
        levels += 1;
        worst = {base: order.base, quote: order.quote};
        taken.push({index: order.index, take, cost});
        if (take < order.forSale) {
            // this order was only partly used: the amount is spent, but for
            // less than one more unit's price
            stoppedInside = true;
            break;
        }
    }
    const fee = marketFee(receiveFee, gross, false);
    const spent = pay - remaining;
    return {
        fill: {
            receive: gross - fee,
            gross,
            // the price of the first order is what a small trade pays
            ideal: matching.length
                ? (spent * matching[0].base) / matching[0].quote
                : ZERO,
            spent,
            // what cannot be spent for lack of a whole unit is dust
            complete: stoppedInside || remaining * BigInt(1000) <= pay,
            levels,
            worst
        },
        taken
    };
}

/**
 * Sells `pay` of `payAsset` into `orders` for `receiveAsset`. `orders` may be
 * the raw answer of `get_limit_orders` for the pair (both directions); only
 * those that sell `receiveAsset` for `payAsset` can fill this order.
 */
export function fillFromOrderBook(
    orders: BookOrder[],
    payAsset: string,
    receiveAsset: string,
    pay: bigint,
    receiveFee: MarketFee = NO_MARKET_FEE
): BookFill {
    return walkOrderBook(orders, payAsset, receiveAsset, pay, receiveFee).fill;
}

/**
 * How much of `payAsset` it takes to buy everything the book offers for it: the depth of the book
 * on this side, in the asset that is paid (rounded up per order, as a fill is).
 */
export function bookDepth(
    orders: BookOrder[],
    payAsset: string,
    receiveAsset: string
): bigint {
    let total = ZERO;
    for (const o of orders) {
        if (
            o.sell_price.base.asset_id !== receiveAsset ||
            o.sell_price.quote.asset_id !== payAsset
        ) {
            continue;
        }
        const base = BigInt(o.sell_price.base.amount);
        const forSale = BigInt(o.for_sale);
        if (base <= ZERO || forSale <= ZERO) continue;
        total += ceilDiv(forSale * BigInt(o.sell_price.quote.amount), base);
    }
    return total;
}

export interface VenueComparison {
    better: "pool" | "book" | "equal";
    /** How much more the better venue pays, as a fraction of the other. */
    advantage: number;
}

/** The pool's quote against the order book's fill for the same sale. */
export function compareVenues(
    poolReceive: bigint,
    book: BookFill
): VenueComparison {
    // a book that cannot take the whole amount is not a venue for it
    if (!book.complete || book.receive <= ZERO) {
        return {better: "pool", advantage: 0};
    }
    if (poolReceive <= ZERO) return {better: "book", advantage: 0};
    if (poolReceive === book.receive) return {better: "equal", advantage: 0};
    const pool = Number(poolReceive);
    const orders = Number(book.receive);
    return pool > orders
        ? {better: "pool", advantage: (pool - orders) / orders}
        : {better: "book", advantage: (orders - pool) / pool};
}

export interface SpotComparison {
    /** The price of the pool for a small trade, base per quote. */
    poolBuy: number;
    poolSell: number;
    /** Buying the quote asset: where is it cheaper. Null: no ask to compare. */
    buy: VenueComparison | null;
    /** Selling the quote asset: where does it pay more. */
    sell: VenueComparison | null;
}

/**
 * The market page's view: for a small trade, the pool's price (its balance
 * ratio, moved by its taker fee) against the best ask and bid of the order
 * book. Prices are base per quote, as the market page shows them. A big
 * trade moves the pool's price and walks the book; the swap dialog compares
 * the actual amount.
 */
export function compareSpot(
    reserveBase: number,
    reserveQuote: number,
    takerFeePercent: number,
    lowestAsk: number | null,
    highestBid: number | null
): SpotComparison | null {
    if (!(reserveBase > 0) || !(reserveQuote > 0)) return null;
    const fee = takerFeePercent / 10000;
    const spot = reserveBase / reserveQuote;
    const poolBuy = spot / (1 - fee);
    const poolSell = spot * (1 - fee);
    const near = (a: number, b: number) =>
        Math.abs(a - b) / Math.max(a, b) < 1e-4;

    let buy: VenueComparison | null = null;
    if (lowestAsk && lowestAsk > 0) {
        buy = near(poolBuy, lowestAsk)
            ? {better: "equal", advantage: 0}
            : poolBuy < lowestAsk
            ? {better: "pool", advantage: (lowestAsk - poolBuy) / lowestAsk}
            : {better: "book", advantage: (poolBuy - lowestAsk) / poolBuy};
    }
    let sell: VenueComparison | null = null;
    if (highestBid && highestBid > 0) {
        sell = near(poolSell, highestBid)
            ? {better: "equal", advantage: 0}
            : poolSell > highestBid
            ? {better: "pool", advantage: (poolSell - highestBid) / highestBid}
            : {better: "book", advantage: (highestBid - poolSell) / poolSell};
    }
    return {poolBuy, poolSell, buy, sell};
}
