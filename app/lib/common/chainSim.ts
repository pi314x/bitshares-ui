// What the chain would do with the operations of one transaction, worked out from the operations alone (not
// from the quotes they were planned from): the same rules the chain applies, on the pools, the order books and
// the balances as they were read. The operations are applied one after the other, each on what the one before
// left, and the first that the chain would refuse stops it.
//
// Supported: `limit_order_create` (fill or kill or not), `liquidity_pool_exchange`, `samet_fund_borrow` and
// `samet_fund_repay`. Anything else is "unsupported" (the caller decides). Not simulated: the network fee (the
// caller takes it off), margin calls and the feed-price limits of smart coins in the order book, an order that
// rests on the book after a partial fill (it is only reported), stable pools, and authorisations (the lists of
// assets that limit who may hold them). Checked against the chain's own code (a private chain made with core's witness_node).
import {BookOrder, PriceLimit, walkOrderBook} from "./priceCompare";
import {MarketFee, NO_MARKET_FEE, quoteExactIn} from "./poolSwap";

const ZERO = BigInt(0);

export interface SimPool {
    assetA: string;
    assetB: string;
    balanceA: bigint;
    balanceB: bigint;
    /** in 0.01% */
    takerFeePercent: number;
}

export interface SimState {
    assets: Map<string, {fee: MarketFee}>;
    pools: Map<string, SimPool>;
    /** the open orders of a pair (both directions), by the two asset ids in order, "a|b" with a < b */
    books: Map<string, BookOrder[]>;
    /** what the account holds */
    balances: Map<string, bigint>;
}

export type SimFailure =
    | "unsupported"
    | "wrong_account"
    | "unknown_asset"
    | "unknown_pool"
    | "same_asset"
    | "nothing_to_sell"
    | "insufficient_balance"
    /** a fill-or-kill order that cannot sell all it offers ("Killing limit order ... due to unable to fill") */
    | "killed"
    /** a pool exchange that pays less than its `min_to_receive` ("Unable to exchange at expected price") */
    | "below_minimum"
    | "cannot_swap"
    | "loan_not_repaid";

export interface SimStep {
    index: number;
    kind: "order" | "pool" | "borrow" | "repay";
    sold: bigint;
    received: bigint;
    /** an order that is not fill or kill and is not sold in full leaves this much on the book */
    rests: bigint;
}

export type SimOutcome =
    | {
          ok: true;
          /** what the account holds after the last operation */
          balances: Map<string, bigint>;
          /** the pools and the order books after the last operation */
          pools: Map<string, SimPool>;
          books: Map<string, BookOrder[]>;
          steps: SimStep[];
      }
    | {
          ok: false;
          /** the operation (its place in the list) that the chain would refuse */
          index: number;
          reason: SimFailure;
          steps: SimStep[];
      };

/** The key of a pair, the same for either order of the two assets. */
export const simPairKey = (a: string, b: string) =>
    a < b ? `${a}|${b}` : `${b}|${a}`;

/** Applies `operations` of `account` to a copy of `state` and says what the chain would do. */
export function simulateOperations(
    state: SimState,
    account: string,
    operations: Array<[string, any]>
): SimOutcome {
    const balances = new Map(state.balances);
    const pools = new Map(state.pools);
    const books = new Map(state.books);
    const steps: SimStep[] = [];
    const loans = new Map<string, bigint>();
    const held = (asset: string) => balances.get(asset) || ZERO;
    const feeOf = (asset: string): MarketFee => {
        const row = state.assets.get(asset);
        return row ? row.fee : NO_MARKET_FEE;
    };

    for (let index = 0; index < operations.length; index++) {
        const [name, op] = operations[index];
        const refuse = (reason: SimFailure): SimOutcome => ({
            ok: false,
            index,
            reason,
            steps
        });

        if (name === "limit_order_create") {
            if (op.seller !== account) return refuse("wrong_account");
            const sellAsset: string = op.amount_to_sell.asset_id;
            const buyAsset: string = op.min_to_receive.asset_id;
            if (!state.assets.has(sellAsset) || !state.assets.has(buyAsset)) {
                return refuse("unknown_asset");
            }
            if (sellAsset === buyAsset) return refuse("same_asset");
            const sell = BigInt(op.amount_to_sell.amount);
            const least = BigInt(op.min_to_receive.amount);
            if (sell <= ZERO) return refuse("nothing_to_sell");
            if (held(sellAsset) < sell) return refuse("insufficient_balance");
            const key = simPairKey(sellAsset, buyAsset);
            const book = books.get(key) || [];
            const limit: PriceLimit = {pay: sell, receive: least};
            const walk = walkOrderBook(
                book,
                sellAsset,
                buyAsset,
                sell,
                feeOf(buyAsset),
                limit
            );
            const fillOrKill = !!op.fill_or_kill;
            if (fillOrKill && !walk.fill.complete) return refuse("killed");
            // what is used of the orders is gone for the operations after this one
            if (walk.taken.length) {
                const used = new Map(walk.taken.map(t => [t.index, t.take]));
                const next: BookOrder[] = [];
                book.forEach((order, i) => {
                    const take = used.get(i);
                    if (take === undefined) {
                        next.push(order);
                        return;
                    }
                    const left = BigInt(order.for_sale) - take;
                    if (left > ZERO)
                        next.push({...order, for_sale: String(left)});
                });
                books.set(key, next);
            }
            // a fill-or-kill order sells what the walk could spend (a dust that cannot buy a unit stays
            // with the account); another order escrows all it offers and leaves what is not sold on the book
            const sold = fillOrKill ? walk.fill.spent : sell;
            balances.set(sellAsset, held(sellAsset) - sold);
            balances.set(buyAsset, held(buyAsset) + walk.fill.receive);
            steps.push({
                index,
                kind: "order",
                sold: walk.fill.spent,
                received: walk.fill.receive,
                rests: fillOrKill ? ZERO : sell - walk.fill.spent
            });
        } else if (name === "liquidity_pool_exchange") {
            if (op.account !== account) return refuse("wrong_account");
            const pool = pools.get(op.pool);
            if (!pool) return refuse("unknown_pool");
            const sellAsset: string = op.amount_to_sell.asset_id;
            const buyAsset: string = op.min_to_receive.asset_id;
            const selling =
                sellAsset === pool.assetA && buyAsset === pool.assetB
                    ? "a"
                    : sellAsset === pool.assetB && buyAsset === pool.assetA
                    ? "b"
                    : null;
            if (!selling) return refuse("unknown_asset");
            const sell = BigInt(op.amount_to_sell.amount);
            const least = BigInt(op.min_to_receive.amount);
            if (sell <= ZERO) return refuse("nothing_to_sell");
            if (held(sellAsset) < sell) return refuse("insufficient_balance");
            const quote = quoteExactIn(
                {
                    balanceIn: selling === "a" ? pool.balanceA : pool.balanceB,
                    balanceOut: selling === "a" ? pool.balanceB : pool.balanceA,
                    takerFeePercent: pool.takerFeePercent,
                    feeIn: feeOf(sellAsset),
                    feeOut: feeOf(buyAsset)
                },
                sell
            );
            if (!quote) return refuse("cannot_swap");
            // the chain compares what the account receives, after the market fee of the received asset
            if (quote.receive < least) return refuse("below_minimum");
            pools.set(op.pool, {
                ...pool,
                balanceA:
                    selling === "a" ? quote.newBalanceIn : quote.newBalanceOut,
                balanceB:
                    selling === "a" ? quote.newBalanceOut : quote.newBalanceIn
            });
            balances.set(sellAsset, held(sellAsset) - sell);
            balances.set(buyAsset, held(buyAsset) + quote.receive);
            steps.push({
                index,
                kind: "pool",
                sold: sell,
                received: quote.receive,
                rests: ZERO
            });
        } else if (name === "samet_fund_borrow") {
            if (op.borrower !== account) return refuse("wrong_account");
            const asset: string = op.borrow_amount.asset_id;
            const amount = BigInt(op.borrow_amount.amount);
            if (amount <= ZERO) return refuse("nothing_to_sell");
            balances.set(asset, held(asset) + amount);
            loans.set(op.fund_id, (loans.get(op.fund_id) || ZERO) + amount);
            steps.push({
                index,
                kind: "borrow",
                sold: ZERO,
                received: amount,
                rests: ZERO
            });
        } else if (name === "samet_fund_repay") {
            if (op.account !== account) return refuse("wrong_account");
            const asset: string = op.repay_amount.asset_id;
            const amount = BigInt(op.repay_amount.amount);
            const feeAmount = BigInt(op.fund_fee.amount);
            if (held(asset) < amount + feeAmount) {
                return refuse("insufficient_balance");
            }
            balances.set(asset, held(asset) - amount - feeAmount);
            loans.set(op.fund_id, (loans.get(op.fund_id) || ZERO) - amount);
            steps.push({
                index,
                kind: "repay",
                sold: amount + feeAmount,
                received: ZERO,
                rests: ZERO
            });
        } else {
            return refuse("unsupported");
        }
    }
    // a loan has to be repaid within the transaction
    for (const owed of loans.values()) {
        if (owed > ZERO) {
            return {
                ok: false,
                index: operations.length - 1,
                reason: "loan_not_repaid",
                steps
            };
        }
    }
    return {ok: true, balances, pools, books, steps};
}
