// Redux-backed replacement for the Alt.js MarketsActions
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../store/reduxStore.ts`'s
// header for the overall migration approach). Preserves every method
// name and the exact transaction-building/validation logic the original
// action creators ran - per AGENTS.md, the `WalletDb.process_transaction(
// ...)` calls below (`createLimitOrder`/`createLimitOrder2`/
// `createPredictionShort`/`cancelLimitOrder`/`cancelLimitOrders`) are
// byte-for-byte the same operation fields/promise chains as the
// original; only the Alt-dispatch mechanics change.
//
// Of this file's methods, only `subscribeMarket`/`unSubscribeMarket`/
// `getMarketStats` have a bound `MarketsStore` handler that isn't a pure
// state transition (notifies pub-sub subscribers, resolves a caller's
// promise, or debounces a localStorage write) - those three call
// `../stores/MarketsStore.ts`'s facade methods directly (same precedent
// as the `TransactionConfirmActions`/`BalanceClaimActiveStore` cross-call
// in batch 2), which dispatch the slice's pure reducer case and then run
// the side effects. Every other bound action (`changeBase`,
// `changeBucketSize`, `cancelLimitOrderSuccess`, `closeCallOrderSuccess`,
// `callOrderUpdate`, `feedUpdate`, `settleOrderUpdate`, `switchMarket`,
// `toggleStars`, `getTrackedGroupsConfig`, `changeCurrentGroupLimit`)
// dispatches straight into `../store/slices/marketsSlice.ts` at the
// exact point the original called Alt's `dispatch(...)`.
//
// `getTicker`/`createLimitOrder2`/`createPredictionShort`/
// `cancelLimitOrder`/`cancelLimitOrders` never had a bound `MarketsStore`
// handler at all (not in its `bindListeners` call) - they're plain
// functions returning the promise chain real call sites already
// `.then()`/`.catch()` off of (e.g. `Exchange/Exchange.tsx`'s
// `createLimitOrder2`/`createPredictionShort` calls, `QuickTrade.tsx`'s
// `createLimitOrder2` call, `PredictionMarkets/
// PredictionMarketsOverviewTable.tsx`'s `getTicker` call). `createLimitOrder`
// (singular - distinct from `createLimitOrder2`) DID originally wrap its
// body in `return dispatch => {...}`, dispatching `true`/`{error}` after
// the transaction settled, but grepping every call site found none -
// that dispatch was already a complete no-op under Alt (same category as
// the dead `dispatch(true)`/`dispatch(false)` calls dropped in the
// `AssetActions`/batch 4 port), so it's dropped here too; the promise it
// returns, and its resolved value, are unchanged.
//
// `getMarketStatsInterval`'s error-callback path calls
// `clearMarketStatsInInterval(base, quote)` - passing the asset objects,
// not the `marketName` string `clearMarketStatsInInterval` actually keys
// on. This is a real pre-existing bug in the original (`actions.
// getMarketStatsInterval`'s own error callback, attached straight onto
// the Alt actions object outside the class body) - preserved verbatim,
// not fixed. The *other* caller of `clearMarketStatsInInterval`, the
// cleanup function this method returns (`.bind(this, marketName)`), is
// unaffected and correct.
import {Apis} from "bitsharesjs-ws";
import {ChainStore} from "bitsharesjs";
import Immutable from "immutable";
import WalletApi from "api/WalletApi";
import WalletDb from "stores/WalletDb";
import marketUtils from "common/market_utils";
import accountUtils from "common/account_utils";
import {reduxStore} from "../store/reduxStore";
import marketsStore from "../stores/MarketsStore";
import {
    onChangeBase,
    onChangeBucketSize,
    onCancelLimitOrderSuccess,
    onCloseCallOrderSuccess,
    onCallOrderUpdate,
    onFeedUpdate,
    onSettleOrderUpdate,
    onSwitchMarket,
    onToggleStars,
    onGetTrackedGroupsConfig,
    onChangeCurrentGroupLimit
} from "../store/slices/marketsSlice";

type Deferrable<T extends (...args: any[]) => any> = T & {
    defer: (...args: Parameters<T>) => void;
};

function withDefer<T extends (...args: any[]) => any>(fn: T): Deferrable<T> {
    const deferrable = fn as Deferrable<T>;
    deferrable.defer = (...args: Parameters<T>) =>
        setTimeout(() => fn(...args));
    return deferrable;
}

const subs: {[subID: string]: any} = {};
let currentBucketSize: any;
const marketStats: {[marketName: string]: any} = {};
const statTTL = 60 * 1 * 1000; // 1 minute

let cancelBatchIDs = Immutable.List();
let dispatchCancelTimeout: ReturnType<typeof setTimeout> | null = null;
const cancelBatchTime = 500;

let subBatchResults = Immutable.List();
let dispatchSubTimeout: ReturnType<typeof setTimeout> | null = null;
const subBatchTime = 500;

let currentMarket: any = null;
let currentGroupLimit: any = "";

function clearBatchTimeouts() {
    clearTimeout(dispatchCancelTimeout as any);
    clearTimeout(dispatchSubTimeout as any);
    dispatchCancelTimeout = null;
    dispatchSubTimeout = null;
}

const marketStatsQueue: any[] = []; // Queue array holding get_ticker promises
const marketStatsQueueLength = 500; // Number of get_ticker calls per batch
const marketStatsQueueTimeout = 1.5; // Seconds before triggering a queue processing
let marketStatsQueueActive = false;

let currentGroupedOrderLimit: any = 0;

function changeBase(market: any) {
    clearBatchTimeouts();
    reduxStore.dispatch(onChangeBase(market));
}

function changeBucketSize(size: any) {
    reduxStore.dispatch(onChangeBucketSize(size));
}

function getMarketStats(
    base: any,
    quote: any,
    refresh = false,
    errorCallback: any = null
) {
    const {marketName, first, second} = marketUtils.getMarketName(
        base,
        quote
    );
    if (base === quote) return;
    const now: any = new Date();

    if (marketStats[marketName] && !refresh) {
        if (now - marketStats[marketName].lastFetched < statTTL) {
            return false;
        } else {
            refresh = true;
        }
    }

    if (!marketStats[marketName] || refresh) {
        marketStats[marketName] = {
            lastFetched: new Date()
        };

        if (Apis.instance().db_api()) {
            marketStatsQueue.push({
                promise: Apis.instance()
                    .db_api()
                    .exec("get_ticker", [second.get("id"), first.get("id")]),
                market: marketName,
                base: second,
                quote: first
            });
        }

        if (!marketStatsQueueActive) {
            marketStatsQueueActive = true;

            setTimeout(() => {
                processQueue();
            }, 1000 * marketStatsQueueTimeout); // 2 seconds between
        }

        const processQueue = (): any => {
            const currentBatch = marketStatsQueue.slice(
                0,
                marketStatsQueueLength
            );
            return Promise.all(currentBatch.map((q: any) => q.promise))
                .then((results: any) => {
                    marketsStore.onGetMarketStats({
                        tickers: results,
                        markets: currentBatch.map((q: any) => q.market),
                        bases: currentBatch.map((q: any) => q.base),
                        quotes: currentBatch.map((q: any) => q.quote)
                    });
                    marketStatsQueue.splice(0, results.length);
                    if (marketStatsQueue.length === 0) {
                        marketStatsQueueActive = false;
                        return;
                    } else {
                        return processQueue();
                    }
                })
                .catch((err: any) => {
                    console.log(
                        "getMarketStats error for " + marketName + ":",
                        err
                    );
                    if (errorCallback != null) {
                        errorCallback(err);
                    }
                });
        };
    }
}

function switchMarket() {
    reduxStore.dispatch(onSwitchMarket());
}

async function getTicker(base: any, quote: any) {
    if (base instanceof Object) {
        base = base.get("id");
    }
    if (quote instanceof Object) {
        quote = quote.get("id");
    }
    return await Apis.instance()
        .db_api()
        .exec("get_ticker", [base, quote]);
}

function subscribeMarket(
    base: any,
    quote: any,
    bucketSize: any,
    groupedOrderLimit: any
): Promise<any> {
    /*
     * DataFeed will call subscribeMarket with undefined groupedOrderLimit,
     * so we keep track of the last value used and use that instead in that
     * case
     */
    if (typeof groupedOrderLimit === "undefined")
        groupedOrderLimit = currentGroupedOrderLimit;
    else currentGroupedOrderLimit = groupedOrderLimit;

    clearBatchTimeouts();
    const subID = quote.get("id") + "_" + base.get("id");
    currentMarket = base.get("id") + "_" + quote.get("id");
    const {
        isMarketAsset,
        marketAsset,
        inverted
    }: any = marketUtils.isMarketAsset(quote, base);

    const bucketCount = 200;

    const subscription = (marketId: any, subResult: any) => {
        /*
         ** When switching markets rapidly we might receive sub notifications
         ** from the previous markets, in that case disregard them
         */
        if (marketId !== currentMarket) {
            return;
        }
        /* In the case of many market notifications arriving at the same time,
         * we queue them in a batch here and dispatch them all at once at a frequency
         * defined by "subBatchTime"
         */
        if (!dispatchSubTimeout) {
            subBatchResults = subBatchResults.concat(subResult);

            dispatchSubTimeout = setTimeout(() => {
                // `hasLimitOrder` is computed below but never read
                // afterwards anywhere in the original method either -
                // a genuine pre-existing dead-variable quirk, preserved
                // verbatim rather than removed.
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                let hasLimitOrder = false;
                let onlyLimitOrder = true;
                let hasFill = false;

                // Check whether the market had a fill order, and whether it only has a new limit order
                subBatchResults.forEach((result: any) => {
                    result.forEach((notification: any) => {
                        if (typeof notification === "string") {
                            const split = notification.split(".");
                            if (split.length >= 2 && split[1] === "7") {
                                hasLimitOrder = true;
                            } else {
                                onlyLimitOrder = false;
                            }
                        } else {
                            onlyLimitOrder = false;
                            if (
                                notification.length === 2 &&
                                notification[0] &&
                                notification[0][0] === 4
                            ) {
                                hasFill = true;
                            }
                        }
                    });
                });

                let callPromise: any = null,
                    settlePromise: any = null;

                // Only check for call and settle orders if either the base or quote is the CORE asset
                if (isMarketAsset) {
                    callPromise = Apis.instance()
                        .db_api()
                        .exec("get_call_orders", [marketAsset.id, 300]);
                    settlePromise = Apis.instance()
                        .db_api()
                        .exec("get_settle_orders", [marketAsset.id, 300]);
                }

                let groupedOrdersBidsPromise: any = [];
                let groupedOrdersAsksPromise: any = [];
                if (currentGroupLimit !== 0) {
                    groupedOrdersBidsPromise = Apis.instance()
                        .orders_api()
                        .exec("get_grouped_limit_orders", [
                            base.get("id"),
                            quote.get("id"),
                            currentGroupLimit, // group
                            null, // price start
                            100 // limit must not exceed 101
                        ]);
                    groupedOrdersAsksPromise = Apis.instance()
                        .orders_api()
                        .exec("get_grouped_limit_orders", [
                            quote.get("id"),
                            base.get("id"),
                            currentGroupLimit, // group
                            null, // price start
                            100 // limit must not exceed 101
                        ]);
                }

                let startDate: any = new Date();
                let startDate2: any = new Date();
                let startDate3: any = new Date();
                const endDate = new Date();
                startDate = new Date(
                    startDate.getTime() -
                        bucketSize * bucketCount * 1000
                );
                startDate2 = new Date(
                    startDate2.getTime() -
                        bucketSize * bucketCount * 2000
                );
                startDate3 = new Date(
                    startDate3.getTime() -
                        bucketSize * bucketCount * 3000
                );
                endDate.setDate(endDate.getDate() + 1);

                subBatchResults = subBatchResults.clear();
                dispatchSubTimeout = null;
                // Selectively call the different market api calls depending on the type
                // of operations received in the subscription update
                Promise.all([
                    Apis.instance()
                        .db_api()
                        .exec("get_limit_orders", [
                            base.get("id"),
                            quote.get("id"),
                            300
                        ]),
                    onlyLimitOrder ? null : callPromise,
                    onlyLimitOrder ? null : settlePromise,
                    !hasFill
                        ? null
                        : Apis.instance()
                              .history_api()
                              .exec("get_market_history", [
                                  base.get("id"),
                                  quote.get("id"),
                                  bucketSize,
                                  startDate.toISOString().slice(0, -5),
                                  endDate.toISOString().slice(0, -5)
                              ]),
                    !hasFill
                        ? null
                        : Apis.instance()
                              .history_api()
                              .exec("get_fill_order_history", [
                                  base.get("id"),
                                  quote.get("id"),
                                  200
                              ]),
                    !hasFill
                        ? null
                        : Apis.instance()
                              .history_api()
                              .exec("get_market_history", [
                                  base.get("id"),
                                  quote.get("id"),
                                  bucketSize,
                                  startDate2.toISOString().slice(0, -5),
                                  startDate.toISOString().slice(0, -5)
                              ]),
                    !hasFill
                        ? null
                        : Apis.instance()
                              .history_api()
                              .exec("get_market_history", [
                                  base.get("id"),
                                  quote.get("id"),
                                  bucketSize,
                                  startDate3.toISOString().slice(0, -5),
                                  startDate2.toISOString().slice(0, -5)
                              ]),
                    Apis.instance()
                        .db_api()
                        .exec("get_ticker", [
                            base.get("id"),
                            quote.get("id")
                        ]),
                    groupedOrdersBidsPromise,
                    groupedOrdersAsksPromise
                ])
                    .then((results: any) => {
                        const data1 = results[5] || [];
                        const data2 = results[6] || [];
                        marketsStore.onSubscribeMarket({
                            limits: results[0],
                            calls: !onlyLimitOrder && results[1],
                            settles: !onlyLimitOrder && results[2],
                            price:
                                hasFill &&
                                data1.concat(data2.concat(results[3])),
                            history: hasFill && results[4],
                            market: subID,
                            base: base,
                            quote: quote,
                            inverted: inverted,
                            ticker: results[7],
                            groupedOrdersBids: results[8],
                            groupedOrdersAsks: results[9]
                        });
                    })
                    .catch((error: any) => {
                        console.log(
                            "Error in MarketsActions.subscribeMarket: ",
                            error
                        );
                    });
            }, subBatchTime);
        } else {
            subBatchResults = subBatchResults.concat(subResult);
        }
    };

    if (
        !subs[subID] ||
        currentBucketSize !== bucketSize ||
        currentGroupLimit !== groupedOrderLimit
    ) {
        marketsStore.onSubscribeMarket({switchMarket: true});
        currentBucketSize = bucketSize;
        currentGroupLimit = groupedOrderLimit;
        let callPromise: any = null,
            settlePromise: any = null;

        if (isMarketAsset) {
            callPromise = Apis.instance()
                .db_api()
                .exec("get_call_orders", [marketAsset.id, 300]);
            settlePromise = Apis.instance()
                .db_api()
                .exec("get_settle_orders", [marketAsset.id, 300]);
        }

        let groupedOrdersBidsPromise: any = [];
        let groupedOrdersAsksPromise: any = [];
        if (currentGroupLimit !== 0) {
            groupedOrdersBidsPromise = Apis.instance()
                .orders_api()
                .exec("get_grouped_limit_orders", [
                    base.get("id"),
                    quote.get("id"),
                    currentGroupLimit, // group
                    null, // price start
                    100 // limit must not exceed 101
                ]);
            groupedOrdersAsksPromise = Apis.instance()
                .orders_api()
                .exec("get_grouped_limit_orders", [
                    quote.get("id"),
                    base.get("id"),
                    currentGroupLimit, // group
                    null, // price start
                    100 // limit must not exceed 101
                ]);
        }

        let startDate: any = new Date();
        let startDate2: any = new Date();
        let startDate3: any = new Date();
        const endDate = new Date();
        startDate = new Date(
            startDate.getTime() - bucketSize * bucketCount * 1000
        );
        startDate2 = new Date(
            startDate2.getTime() - bucketSize * bucketCount * 2000
        );
        startDate3 = new Date(
            startDate3.getTime() - bucketSize * bucketCount * 3000
        );
        endDate.setDate(endDate.getDate() + 1);
        if (__DEV__) console.time("Fetch market data");

        return new Promise((resolve, reject) => {
            Promise.all([
                Apis.instance()
                    .db_api()
                    .exec("subscribe_to_market", [
                        subscription.bind(
                            undefined,
                            base.get("id") + "_" + quote.get("id")
                        ),
                        base.get("id"),
                        quote.get("id")
                    ]),
                Apis.instance()
                    .db_api()
                    .exec("get_limit_orders", [
                        base.get("id"),
                        quote.get("id"),
                        300
                    ]),
                callPromise,
                settlePromise,
                Apis.instance()
                    .history_api()
                    .exec("get_market_history", [
                        base.get("id"),
                        quote.get("id"),
                        bucketSize,
                        startDate.toISOString().slice(0, -5),
                        endDate.toISOString().slice(0, -5)
                    ]),
                Apis.instance()
                    .history_api()
                    .exec("get_market_history_buckets", []),
                Apis.instance()
                    .history_api()
                    .exec("get_fill_order_history", [
                        base.get("id"),
                        quote.get("id"),
                        200
                    ]),
                Apis.instance()
                    .history_api()
                    .exec("get_market_history", [
                        base.get("id"),
                        quote.get("id"),
                        bucketSize,
                        startDate2.toISOString().slice(0, -5),
                        startDate.toISOString().slice(0, -5)
                    ]),
                Apis.instance()
                    .history_api()
                    .exec("get_market_history", [
                        base.get("id"),
                        quote.get("id"),
                        bucketSize,
                        startDate3.toISOString().slice(0, -5),
                        startDate2.toISOString().slice(0, -5)
                    ]),
                Apis.instance()
                    .db_api()
                    .exec("get_ticker", [
                        base.get("id"),
                        quote.get("id")
                    ]),
                groupedOrdersBidsPromise,
                groupedOrdersAsksPromise
            ])
                .then((results: any) => {
                    const data1 = results[8] || [];
                    const data2 = results[7] || [];
                    subs[subID] = subscription;
                    if (__DEV__) console.timeEnd("Fetch market data");
                    marketsStore.onSubscribeMarket({
                        limits: results[1],
                        calls: results[2],
                        settles: results[3],
                        price: data1.concat(data2.concat(results[4])),
                        buckets: results[5],
                        history: results[6],
                        market: subID,
                        base: base,
                        quote: quote,
                        inverted: inverted,
                        ticker: results[9],
                        init: true,
                        resolve,
                        groupedOrdersBids: results[10],
                        groupedOrdersAsks: results[11]
                    });
                })
                .catch((error: any) => {
                    console.log(
                        "Error in MarketsActions.subscribeMarket: ",
                        error
                    );
                    reject(error);
                });
        });
    }
    return Promise.resolve(true);
}

function unSubscribeMarket(quote: any, base: any): Promise<any> {
    const subID = quote + "_" + base;
    clearBatchTimeouts();
    if (subs[subID]) {
        return new Promise((resolve, reject) => {
            Apis.instance()
                .db_api()
                .exec("unsubscribe_from_market", [
                    subs[subID],
                    quote,
                    base
                ])
                .then(() => {
                    delete subs[subID];
                    marketsStore.onUnSubscribeMarket({unSub: true, resolve});
                })
                .catch((error: any) => {
                    subs[subID] = true;
                    console.log(
                        "Error in MarketsActions.unSubscribeMarket: ",
                        error
                    );
                    marketsStore.onUnSubscribeMarket({
                        unSub: false,
                        market: subID
                    });
                    reject(error);
                });
        });
    }
    return Promise.resolve(true);
}

function createLimitOrder(
    account: any,
    sellAmount: any,
    sellAsset: any,
    buyAmount: any,
    buyAsset: any,
    expiration: any,
    isFillOrKill: any,
    fee_asset_id: any
) {
    const tr = WalletApi.new_transaction();

    const feeAsset = ChainStore.getAsset(fee_asset_id);
    if (
        feeAsset.getIn([
            "options",
            "core_exchange_rate",
            "base",
            "asset_id"
        ]) === "1.3.0" &&
        feeAsset.getIn([
            "options",
            "core_exchange_rate",
            "quote",
            "asset_id"
        ]) === "1.3.0"
    ) {
        fee_asset_id = "1.3.0";
    }

    tr.add_type_operation("limit_order_create", {
        fee: {
            amount: 0,
            asset_id: fee_asset_id
        },
        seller: account,
        amount_to_sell: {
            amount: sellAmount,
            asset_id: sellAsset.get("id")
        },
        min_to_receive: {
            amount: buyAmount,
            asset_id: buyAsset.get("id")
        },
        expiration: expiration,
        fill_or_kill: isFillOrKill
    });

    return WalletDb.process_transaction(tr, null, true)
        .then(() => {
            return true;
        })
        .catch((error: any) => {
            console.log("order error:", error);
            return {error};
        });
}

function createLimitOrder2(orderOrOrders: any) {
    const tr = WalletApi.new_transaction();

    let orders: any[] = [];

    if (Array.isArray(orderOrOrders)) {
        orders = orderOrOrders.map((order: any) => order.toObject());
    } else {
        orders.push(orderOrOrders.toObject());
    }

    orders.forEach((order: any) => {
        tr.add_type_operation("limit_order_create", order);
    });

    return WalletDb.process_transaction(tr, null, true)
        .then(() => {
            return true;
        })
        .catch((error: any) => {
            console.log("order error:", error);
            return {error};
        });
}

function createPredictionShort(
    order: any,
    collateral: any,
    account: any,
    sellAmount: any,
    sellAsset: any,
    buyAmount: any,
    collateralAmount: any,
    buyAsset: any,
    expiration: any,
    isFillOrKill: any,
    fee_asset_id: any = "1.3.0"
) {
    const tr = WalletApi.new_transaction();

    // Set the fee asset to use
    fee_asset_id = accountUtils.getFinalFeeAsset(
        order.seller,
        "call_order_update",
        order.fee.asset_id
    );

    order.setExpiration();

    tr.add_type_operation("call_order_update", {
        fee: {
            amount: 0,
            asset_id: fee_asset_id
        },
        funding_account: order.seller,
        delta_collateral: collateral.toObject(),
        delta_debt: order.amount_for_sale.toObject(),
        expiration: order.getExpiration()
    });

    tr.add_type_operation("limit_order_create", order.toObject());

    return WalletDb.process_transaction(tr, null, true)
        .then(() => {
            return true;
        })
        .catch((error: any) => {
            console.log("order error:", error);
            return {error};
        });
}

function cancelLimitOrder(accountID: any, orderID: any) {
    // FIXME we need a global approach how gee asset id is selected,
    //       this is only doing it for the cancel action, but ideally,
    //       all fee selection in the UI have the same logic
    const fee_asset_id = accountUtils.getFinalFeeAsset(
        accountID,
        "limit_order_cancel"
    );

    const tr = WalletApi.new_transaction();
    tr.add_type_operation("limit_order_cancel", {
        fee: {
            amount: 0,
            asset_id: fee_asset_id
        },
        fee_paying_account: accountID,
        order: orderID
    });
    return WalletDb.process_transaction(tr, null, true).catch(
        (error: any) => {
            console.log("cancel error:", error);
        }
    );
}

function cancelLimitOrders(
    accountID: any,
    orderIDs: any[],
    fallbackFeeAssets: any = "1.3.0"
) {
    if (__DEV__) {
        console.log("cancelLimitOrders", accountID, orderIDs);
    }
    const tr = WalletApi.new_transaction();
    const balances: any = accountUtils.getAccountBalances(accountID);
    for (let i = 0; i < orderIDs.length; i++) {
        const id = orderIDs[i];
        const fallbackFeeAsset =
            typeof fallbackFeeAssets === "string"
                ? fallbackFeeAssets
                : fallbackFeeAssets[i];
        const {fees}: any = accountUtils.getPossibleFees(
            accountID,
            "limit_order_cancel"
        );
        const fee_asset_id = accountUtils.getFinalFeeAsset(
            accountID,
            "limit_order_cancel",
            fallbackFeeAsset
        );
        balances[fee_asset_id] -= fees[fee_asset_id];
        // check balance
        Object.keys(balances).forEach(key => {
            if (balances[key] < 0) throw "Insufficient balance: " + key;
        });
        tr.add_type_operation("limit_order_cancel", {
            fee: {
                amount: 0,
                asset_id: fee_asset_id
            },
            fee_paying_account: accountID,
            order: id
        });
    }
    return WalletDb.process_transaction(tr, null, true).catch(
        (error: any) => {
            console.log("cancel error:", error);
        }
    );
}

function cancelLimitOrderSuccess(ids: any[]) {
    /* In the case of many cancel orders being issued at the same time,
     * we batch them here and dispatch them all at once at a frequency
     * defined by "dispatchCancelTimeout"
     */
    if (!dispatchCancelTimeout) {
        cancelBatchIDs = cancelBatchIDs.concat(ids);
        dispatchCancelTimeout = setTimeout(() => {
            reduxStore.dispatch(
                onCancelLimitOrderSuccess(cancelBatchIDs.toJS())
            );
            dispatchCancelTimeout = null;
            cancelBatchIDs = cancelBatchIDs.clear();
        }, cancelBatchTime);
    } else {
        cancelBatchIDs = cancelBatchIDs.concat(ids);
    }
}

function closeCallOrderSuccess(orderID: any) {
    reduxStore.dispatch(onCloseCallOrderSuccess(orderID));
}

function callOrderUpdate(order: any) {
    reduxStore.dispatch(onCallOrderUpdate(order));
}

function feedUpdate(asset: any) {
    reduxStore.dispatch(onFeedUpdate(asset));
}

function settleOrderUpdate(asset: any) {
    Apis.instance()
        .db_api()
        .exec("get_settle_orders", [asset, 100])
        .then((result: any) => {
            reduxStore.dispatch(onSettleOrderUpdate({settles: result}));
        });
}

function toggleStars() {
    reduxStore.dispatch(onToggleStars());
}

function getTrackedGroupsConfig() {
    Apis.instance()
        .orders_api()
        .exec("get_tracked_groups", [])
        .then((result: any) => {
            reduxStore.dispatch(
                onGetTrackedGroupsConfig({trackedGroupsConfig: result})
            );
        })
        .catch(() => {
            console.log(
                "current node api does not support grouped orders."
            );
            reduxStore.dispatch(
                onGetTrackedGroupsConfig({trackedGroupsConfig: []})
            );
        });
}

function changeCurrentGroupLimit(groupLimit: any) {
    reduxStore.dispatch(onChangeCurrentGroupLimit(groupLimit));
}

// helper method, not actually dispatching anything
const marketStatsIntervals: {[key: string]: any} = {};

function clearMarketStatsInInterval(key: any) {
    if (marketStatsIntervals[key]) {
        clearInterval(marketStatsIntervals[key]);
        delete marketStatsIntervals[key];
    }
}

function getMarketStatsInterval(
    intervalTime: any,
    base: any,
    quote: any,
    refresh = false
) {
    getMarketStats(base, quote, refresh);
    const {marketName} = marketUtils.getMarketName(base, quote);
    if (marketStatsIntervals[marketName]) {
        return clearMarketStatsInInterval.bind(undefined, marketName);
    }
    marketStatsIntervals[marketName] = setInterval(() => {
        getMarketStats(base, quote, refresh, () => {
            // Real pre-existing bug, preserved verbatim - see this
            // file's header: this should pass `marketName`, not
            // `(base, quote)`, so this cleanup path never actually
            // clears the interval.
            (clearMarketStatsInInterval as any)(base, quote);
        });
    }, intervalTime);
    return clearMarketStatsInInterval.bind(undefined, marketName);
}

const MarketsActionsFacade = {
    changeBase: withDefer(changeBase),
    changeBucketSize: withDefer(changeBucketSize),
    getMarketStats: withDefer(getMarketStats),
    switchMarket: withDefer(switchMarket),
    getTicker: withDefer(getTicker),
    subscribeMarket: withDefer(subscribeMarket),
    unSubscribeMarket: withDefer(unSubscribeMarket),
    createLimitOrder: withDefer(createLimitOrder),
    createLimitOrder2: withDefer(createLimitOrder2),
    createPredictionShort: withDefer(createPredictionShort),
    cancelLimitOrder: withDefer(cancelLimitOrder),
    cancelLimitOrders: withDefer(cancelLimitOrders),
    cancelLimitOrderSuccess: withDefer(cancelLimitOrderSuccess),
    closeCallOrderSuccess: withDefer(closeCallOrderSuccess),
    callOrderUpdate: withDefer(callOrderUpdate),
    feedUpdate: withDefer(feedUpdate),
    settleOrderUpdate: withDefer(settleOrderUpdate),
    toggleStars: withDefer(toggleStars),
    getTrackedGroupsConfig: withDefer(getTrackedGroupsConfig),
    changeCurrentGroupLimit: withDefer(changeCurrentGroupLimit),
    clearMarketStatsInInterval: withDefer(clearMarketStatsInInterval),
    getMarketStatsInterval: withDefer(getMarketStatsInterval)
};

export default MarketsActionsFacade;
