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
    /** How much of the amount offered was used. */
    spent: bigint;
    /** The amount was matched (the book is deep enough), but for dust. */
    complete: boolean;
    /** How many orders were touched. */
    levels: number;
}

const ZERO = BigInt(0);

function ceilDiv(a: bigint, b: bigint): bigint {
    return (a + b - BigInt(1)) / b;
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
    const matching = orders
        .filter(
            o =>
                o.sell_price.base.asset_id === receiveAsset &&
                o.sell_price.quote.asset_id === payAsset &&
                BigInt(o.sell_price.base.amount) > ZERO &&
                BigInt(o.for_sale) > ZERO
        )
        .map(o => ({
            forSale: BigInt(o.for_sale),
            base: BigInt(o.sell_price.base.amount),
            quote: BigInt(o.sell_price.quote.amount)
        }))
        // cheapest first: the least of `payAsset` per unit of `receiveAsset`
        .sort((a, b) => {
            const left = a.quote * b.base;
            const right = b.quote * a.base;
            return left < right ? -1 : left > right ? 1 : 0;
        });

    let remaining = pay;
    let gross = ZERO;
    let levels = 0;
    let stoppedInside = false;
    for (const order of matching) {
        if (remaining <= ZERO) break;
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
        if (take < order.forSale) {
            // this order was only partly used: the amount is spent, but for
            // less than one more unit's price
            stoppedInside = true;
            break;
        }
    }
    const fee = marketFee(receiveFee, gross, false);
    return {
        receive: gross - fee,
        gross,
        spent: pay - remaining,
        // what cannot be spent for lack of a whole unit is dust
        complete: stoppedInside || remaining * BigInt(1000) <= pay,
        levels
    };
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
