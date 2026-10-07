// Redux-backed replacement for the Alt.js MarketsStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../store/reduxStore.ts`'s
// header for the overall migration approach, and `../store/slices/
// marketsSlice.ts`'s header for the full writeup of this store's own
// wrinkles). Preserves the exact Alt-store interface every call site
// already relies on:
//   - `getState()`/`listen(callback)`/`unlisten(callback)` (the standard
//     three, used by `useAltStore(MarketsStore)` call sites and by the
//     still-legacy-shaped direct uses).
//   - `subscribe(id, callback)`/`unsubscribe(id)`/`clearSubs()` - the
//     original's `exportPublicMethods({...})` call. Used directly (not
//     through `useAltStore`) by `Exchange/tradingViewClasses.js`'s
//     TradingView datafeed glue (`subscribe("market_change", ...)`,
//     `subscribe("subscribeBars", ...)`) and by
//     `PriceAlertNotifications.tsx`. This pub-sub map is unrelated to
//     Redux state, so (like `BalanceClaimActiveStore`'s `pubkeys`/
//     `addresses`/`no_balance_address`, batch 2) it stays a plain field
//     on this facade singleton, never touching the slice.
//
// `onGetCollateralPositions`/`borrowMarketState` is dropped - see
// `marketsSlice.ts`'s header for why (never bound, never read anywhere).
//
// Three of the original's `onXxx` handlers were not pure state
// transitions - `onSubscribeMarket`/`onUnSubscribeMarket` called a
// `result.resolve()`/`payload.resolve()` callback (and
// `onSubscribeMarket` additionally called `this.unsubscribe(...)` and
// `this._notifySubscriber(...)`), and both `onSubscribeMarket` (its
// ticker-handling branch) and `onGetMarketStats` called the debounced
// `this._saveMarketStats()` localStorage write. None of that belongs in
// a pure reducer, so (same precedent as `BalanceClaimActiveStore`'s
// `onTransactionBroadcasted`, batch 2) it's reproduced here as plain
// methods on this facade, called directly by `../actions/
// MarketsActions.ts` at the exact point the original dispatched to the
// bound Alt store handler - dispatching the matching `marketsSlice`
// reducer case for the pure part, then running the side effects
// afterwards in the same relative order the original method body did.
import {reduxStore} from "../store/reduxStore";
import {
    selectMarkets,
    onSubscribeMarket as onSubscribeMarketAction,
    onUnSubscribeMarket as onUnSubscribeMarketAction,
    onGetMarketStats as onGetMarketStatsAction,
    MarketsState
} from "../store/slices/marketsSlice";
import ls from "common/localStorage";

const marketStorage = ls("__graphene__");

class MarketsStoreFacade {
    private unsubscribers = new Map<() => void, () => void>();
    private subscribers = new Map<any, any>();
    private saveStatsTimeout: ReturnType<typeof setTimeout> | null = null;

    getState(): MarketsState {
        return selectMarkets(reduxStore.getState());
    }

    listen(callback: () => void) {
        let previous = selectMarkets(reduxStore.getState());
        const unsubscribe = reduxStore.subscribe(() => {
            const next = selectMarkets(reduxStore.getState());
            if (next !== previous) {
                previous = next;
                callback();
            }
        });
        this.unsubscribers.set(callback, unsubscribe);
    }

    unlisten(callback: () => void) {
        const unsubscribe = this.unsubscribers.get(callback);
        if (unsubscribe) {
            unsubscribe();
            this.unsubscribers.delete(callback);
        }
    }

    /**
     *  Add a callback that will be called anytime any object in the cache is updated
     */
    subscribe(id: any, callback: any) {
        if (this.subscribers.has(id) && this.subscribers.get(id) === callback)
            return console.error("Subscribe callback already exists", callback);
        this.subscribers.set(id, callback);
    }

    /**
     *  Remove a callback that was previously added via subscribe
     */
    unsubscribe(id: any) {
        if (this.subscribers.has(id)) {
            this.subscribers.delete(id);
        }
    }

    private _notifySubscriber(id: any, data?: any) {
        if (this.subscribers.has(id)) this.subscribers.get(id)(data);
    }

    clearSubs() {
        this.subscribers.clear();
    }

    private _saveMarketStats() {
        /*
         * Only save stats once every 30s to limit writes and
         * allMarketStats JS conversions
         */
        if (!this.saveStatsTimeout) {
            this.saveStatsTimeout = setTimeout(() => {
                marketStorage.set(
                    "allMarketStats",
                    selectMarkets(reduxStore.getState()).allMarketStats.toJS()
                );
                this.saveStatsTimeout = null;
            }, 1000 * 30);
        }
    }

    // Mirrors MarketsStore.js's onSubscribeMarket - called by
    // MarketsActions.ts's subscribeMarket at the point Alt's dispatcher
    // used to trigger this bound handler.
    onSubscribeMarket(result: any) {
        if (result.switchMarket) {
            reduxStore.dispatch(onSubscribeMarketAction(result));
            return;
        }

        const prev = selectMarkets(reduxStore.getState());
        const newMarket = !!(result.market && result.market !== prev.activeMarket);
        if (newMarket) {
            /*
             * To prevent the callback from DataFeed to be called with new data
             * before subscribeBars in DataFeed has been updated, we clear the
             * callback subscription here
             */
            this.unsubscribe("subscribeBars");
        }

        reduxStore.dispatch(onSubscribeMarketAction(result));

        if (result.ticker) {
            this._saveMarketStats();
        }

        if (result.price) {
            this._notifySubscriber("subscribeBars");
        }

        if (newMarket) {
            const next = selectMarkets(reduxStore.getState());
            this._notifySubscriber(
                "market_change",
                next.quoteAsset.get("symbol") +
                    "_" +
                    next.baseAsset.get("symbol")
            );
        }

        if (result.resolve) result.resolve();
    }

    // Mirrors MarketsStore.js's onUnSubscribeMarket.
    onUnSubscribeMarket(payload: any) {
        reduxStore.dispatch(onUnSubscribeMarketAction(payload));
        if (payload.resolve) payload.resolve();
    }

    // Mirrors MarketsStore.js's onGetMarketStats.
    onGetMarketStats(payload: any) {
        reduxStore.dispatch(onGetMarketStatsAction(payload));
        if (payload && payload.tickers) {
            this._saveMarketStats();
        }
    }
}

export default new MarketsStoreFacade();
