// Redux Toolkit replacement for the Alt.js `MarketsStore`/`MarketsActions`
// pair (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../reduxStore.ts`'s
// header for the overall migration approach, and `MarketsStore`'s own
// entry there for why this is a standalone batch despite its size).
//
// `MarketsStore` never called `this.setState(...)` - like `BlockchainStore`/
// `AssetStore`/`GatewayStore` before it, it mutated instance fields
// directly, so (per Alt's `createStoreFromClass`) the store instance WAS
// its own state object. The state shape below is those instance fields
// verbatim (typed `any` wherever Immutable.js is involved - Immer's
// `Draft<T>` structurally matches `Immutable.Map`/`List`/`OrderedSet`
// against the built-in `ReadonlyMap`/array interfaces and silently
// remaps them to plain JS equivalents, dropping Immutable-only methods;
// see `blockchainSlice.ts`'s header for the original discovery of this).
//
// Two fields are deliberately NOT here, even though the original
// `MarketsStore` carried them as instance fields: `subscribers` (the
// `subscribe`/`unsubscribe`/`clearSubs`/`_notifySubscriber` pub-sub map,
// used by `tradingViewClasses.js`'s TradingView datafeed glue - entirely
// unrelated to Redux state) and `saveStatsTimeout` (a debounce timer
// handle for the `allMarketStats` -> localStorage write-through). Both
// stay as plain instance fields on the `MarketsStore.ts` facade object,
// same precedent as `BalanceClaimActiveStore`'s `pubkeys`/`addresses`/
// `no_balance_address` (batch 2) and `BlockchainStore`'s `maxBlocks`
// (batch 4).
//
// `onGetCollateralPositions` (sets `this.borrowMarketState`) is dropped
// entirely: grepping the original `MarketsStore.js`'s own `bindListeners`
// call shows it was never bound to any action (unlike every other `onXxx`
// method on the class), and no call site anywhere reads
// `.borrowMarketState` either - genuinely dead code, not a behavior this
// migration needs to preserve a path to (same category as the already-
// dropped dead `dispatch(true)`/`dispatch(false)` calls in the
// `AssetActions`/batch 4 port).
//
// Several `onXxx` handlers are NOT pure state transitions - they also
// call `this._notifySubscriber(...)`, `this.unsubscribe(...)`, a
// `result.resolve()`/`payload.resolve()` callback, or (ticker updates)
// the debounced `this._saveMarketStats()` localStorage write. None of
// those belong in a reducer (no callback/timer side effects, no access to
// the facade's own `subscribers` map). Per the `CreditOfferStore`/
// `BalanceClaimActiveStore` precedent, that orchestration stays out of
// this slice and lives instead on the `MarketsStore.ts` facade's own
// `onSubscribeMarket`/`onUnSubscribeMarket`/`onGetMarketStats` methods,
// which call `reduxStore.dispatch(...)` for the pure part (the reducer
// cases below) and then run the side effects afterwards, in the same
// relative order the original method body ran them. See that file's
// header for the exact mapping. `MarketsActions.ts` calls those facade
// methods instead of dispatching directly, for exactly those three
// actions; every other action dispatches straight into this slice.
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import Immutable from "immutable";
import {ChainStore} from "bitsharesjs";
import market_utils from "common/market_utils";
import utils from "common/utils";
import ls from "common/localStorage";
import asset_utils from "common/asset_utils";
import {
    LimitOrder,
    CallOrder,
    FeedPrice as FeedPriceUntyped,
    SettleOrder,
    Asset,
    didOrdersChange,
    Price as PriceUntyped,
    GroupedOrder,
    FillOrder
} from "common/MarketClasses";

// `Price`/`FeedPrice`'s constructors destructure some params without
// default values (`base`/`quote`, `priceObject`/`assets`/`market_base`/
// `sqr`/`mcfr`) mixed with others that do have defaults (`real`) - TS's
// JS inference only picks up the defaulted ones as known properties
// (the same pre-existing gap worked around in `components/Exchange/
// Exchange.tsx` for the same two classes). `Asset`'s constructor
// defaults every param, so it isn't affected and needs no cast.
const Price: any = PriceUntyped;
const FeedPrice: any = FeedPriceUntyped;

const nullPrice = {
    getPrice: () => {
        return 0;
    },
    sellPrice: () => {
        return 0;
    }
};

const marketStorage = ls("__graphene__");

export interface MarketsState {
    markets: any;
    asset_symbol_to_id: {[symbol: string]: any};
    pendingOrders: any;
    marketLimitOrders: any;
    marketCallOrders: any;
    allCallOrders: any[];
    feedPrice: any;
    marketSettleOrders: any;
    activeMarketHistory: any;
    marketData: {
        bids: any[];
        asks: any[];
        calls: any[];
        combinedBids: any[];
        highestBid: any;
        combinedAsks: any[];
        lowestAsk: any;
        flatBids: any[];
        flatAsks: any[];
        flatCalls: any[];
        flatSettles: any[];
        groupedBids: any[];
        groupedAsks: any[];
    };
    totals: {bid: number; ask: number; call: number};
    priceData: any[];
    pendingCreateLimitOrders: any[];
    activeMarket: any;
    quoteAsset: any;
    pendingCounter: number;
    buckets: any[];
    bucketSize: number;
    priceHistory: any[];
    lowestCallPrice: any;
    marketBase: string;
    marketStats: any;
    marketReady: boolean;
    allMarketStats: any;
    onlyStars: boolean;
    baseAsset: any;
    coreAsset: any;
    trackedGroupsConfig: any[];
    currentGroupLimit: number;
    // Set dynamically (never part of the original constructor either):
    invertedCalls?: boolean;
    is_prediction_market?: boolean;
    bitasset_options?: any;
}

function buildInitialMarketData() {
    return {
        bids: [],
        asks: [],
        calls: [],
        combinedBids: [],
        highestBid: nullPrice,
        combinedAsks: [],
        lowestAsk: nullPrice,
        flatBids: [],
        flatAsks: [],
        flatCalls: [],
        flatSettles: [],
        groupedBids: [],
        groupedAsks: []
    };
}

function buildInitialAllMarketStats(): any {
    const allMarketStats: any = marketStorage.get("allMarketStats", {});
    for (const market in allMarketStats) {
        if (allMarketStats[market].price) {
            allMarketStats[market].price = new Price({
                base: new Asset({...allMarketStats[market].price.base}),
                quote: new Asset({...allMarketStats[market].price.quote})
            });
        }
    }
    return Immutable.Map(allMarketStats);
}

const initialState: MarketsState = {
    markets: Immutable.Map(),
    asset_symbol_to_id: {},
    pendingOrders: Immutable.Map(),
    marketLimitOrders: Immutable.Map(),
    marketCallOrders: Immutable.Map(),
    allCallOrders: [],
    feedPrice: null,
    marketSettleOrders: Immutable.OrderedSet(),
    activeMarketHistory: Immutable.OrderedSet(),
    marketData: buildInitialMarketData(),
    totals: {
        bid: 0,
        ask: 0,
        call: 0
    },
    priceData: [],
    pendingCreateLimitOrders: [],
    activeMarket: null,
    quoteAsset: null,
    pendingCounter: 0,
    buckets: [15, 60, 300, 3600, 86400],
    bucketSize: parseInt(marketStorage.get("bucketSize", 3600)),
    priceHistory: [],
    lowestCallPrice: null,
    marketBase: "BTS",
    marketStats: Immutable.Map({
        change: 0,
        volumeBase: 0,
        volumeQuote: 0
    }),
    marketReady: false,
    allMarketStats: buildInitialAllMarketStats(),
    onlyStars: marketStorage.get("onlyStars", false),
    baseAsset: {
        id: "1.3.0",
        symbol: "BTS",
        precision: 5
    },
    coreAsset: {
        id: "1.3.0",
        symbol: "CORE",
        precision: 5
    },
    trackedGroupsConfig: [],
    currentGroupLimit: 0
};

// ---------------------------------------------------------------------
// Helpers ported from MarketsStore.js's own instance methods, taking the
// Immer draft `state` explicitly instead of reading/writing `this`.
// ---------------------------------------------------------------------

function marketHasCalls(quoteAsset: any, baseAsset: any): boolean {
    if (
        quoteAsset.has("bitasset") &&
        quoteAsset.getIn(["bitasset", "options", "short_backing_asset"]) ===
            baseAsset.get("id")
    ) {
        return true;
    } else if (
        baseAsset.has("bitasset") &&
        baseAsset.getIn(["bitasset", "options", "short_backing_asset"]) ===
            quoteAsset.get("id")
    ) {
        return true;
    }
    return false;
}

function getFeed(state: any): any {
    if (!marketHasCalls(state.quoteAsset, state.baseAsset)) {
        state.bitasset_options = null;
        state.is_prediction_market = false;
        return null;
    }

    const assets: any = {
        [state.quoteAsset.get("id")]: {
            precision: state.quoteAsset.get("precision")
        },
        [state.baseAsset.get("id")]: {
            precision: state.baseAsset.get("precision")
        }
    };
    let feedPriceRaw = asset_utils.extractRawFeedPrice(
        state[state.invertedCalls ? "baseAsset" : "quoteAsset"]
    );

    try {
        let sqr = state[
            state.invertedCalls ? "baseAsset" : "quoteAsset"
        ].getIn(["bitasset", "current_feed", "maximum_short_squeeze_ratio"]);
        const mcfr = state[
            state.invertedCalls ? "baseAsset" : "quoteAsset"
        ].getIn([
            "bitasset",
            "options",
            "extensions",
            "margin_call_fee_ratio"
        ]);

        state.is_prediction_market = state[
            state.invertedCalls ? "baseAsset" : "quoteAsset"
        ].getIn(["bitasset", "is_prediction_market"], false);
        state.bitasset_options = state[
            state.invertedCalls ? "baseAsset" : "quoteAsset"
        ]
            .getIn(["bitasset", "options"])
            .toJS();

        if (
            state.is_prediction_market &&
            feedPriceRaw.getIn(["base", "asset_id"]) ===
                feedPriceRaw.getIn(["quote", "asset_id"])
        ) {
            const backingAsset = state.bitasset_options.short_backing_asset;
            if (!assets[backingAsset])
                assets[backingAsset] = {
                    precision: state.quoteAsset.get("precision")
                };
            feedPriceRaw = feedPriceRaw.setIn(["base", "amount"], 1);
            feedPriceRaw = feedPriceRaw.setIn(
                ["base", "asset_id"],
                backingAsset
            );
            feedPriceRaw = feedPriceRaw.setIn(["quote", "amount"], 1);
            feedPriceRaw = feedPriceRaw.setIn(
                ["quote", "asset_id"],
                state.quoteAsset.get("id")
            );
            sqr = 1000;
        }
        const feedPrice = new FeedPrice({
            priceObject: feedPriceRaw,
            market_base: state.quoteAsset.get("id"),
            sqr,
            mcfr,
            assets
        });

        return feedPrice;
    } catch (err) {
        console.error(
            state.activeMarket,
            "does not have a properly configured feed price"
        );
        return null;
    }
}

function priceChart(state: any) {
    const prices: any[] = [];

    let open, high, low, close, volume;

    for (let i = 0; i < state.priceHistory.length; i++) {
        const current = state.priceHistory[i];
        if (!/Z$/.test(current.key.open)) {
            current.key.open += "Z";
        }
        const date = new Date(current.key.open);

        if (state.quoteAsset.get("id") === current.key.quote) {
            high = utils.get_asset_price(
                current.high_base,
                state.baseAsset,
                current.high_quote,
                state.quoteAsset
            );
            low = utils.get_asset_price(
                current.low_base,
                state.baseAsset,
                current.low_quote,
                state.quoteAsset
            );
            open = utils.get_asset_price(
                current.open_base,
                state.baseAsset,
                current.open_quote,
                state.quoteAsset
            );
            close = utils.get_asset_price(
                current.close_base,
                state.baseAsset,
                current.close_quote,
                state.quoteAsset
            );
            volume = utils.get_asset_amount(
                current.quote_volume,
                state.quoteAsset
            );
        } else {
            low = utils.get_asset_price(
                current.high_quote,
                state.baseAsset,
                current.high_base,
                state.quoteAsset
            );
            high = utils.get_asset_price(
                current.low_quote,
                state.baseAsset,
                current.low_base,
                state.quoteAsset
            );
            open = utils.get_asset_price(
                current.open_quote,
                state.baseAsset,
                current.open_base,
                state.quoteAsset
            );
            close = utils.get_asset_price(
                current.close_quote,
                state.baseAsset,
                current.close_base,
                state.quoteAsset
            );
            volume = utils.get_asset_amount(
                current.base_volume,
                state.quoteAsset
            );
        }

        function findMax(a: any, b: any) {
            if (a !== Infinity && b !== Infinity) {
                return Math.max(a, b);
            } else if (a === Infinity) {
                return b;
            } else {
                return a;
            }
        }

        function findMin(a: any, b: any) {
            if (a !== 0 && b !== 0) {
                return Math.min(a, b);
            } else if (a === 0) {
                return b;
            } else {
                return a;
            }
        }

        if (low === 0) {
            low = findMin(open, close);
        }

        if (isNaN(high) || high === Infinity) {
            high = findMax(open, close);
        }

        if (close === Infinity || close === 0) {
            close = open;
        }

        if (open === Infinity || open === 0) {
            open = close;
        }

        if (high > 1.3 * ((open + close) / 2)) {
            high = findMax(open, close);
        }

        if (low < 0.7 * ((open + close) / 2)) {
            low = findMin(open, close);
        }

        prices.push({time: date.getTime(), open, high, low, close, volume});
    }

    state.priceData = prices;
    // original: this._notifySubscriber("subscribeBars") here - pub-sub,
    // not state; done by MarketsStore.ts's onSubscribeMarket() instead.
}

function constructCalls(state: any, callsArray: any): any[] {
    let calls: any[] = [];
    if (callsArray.size) {
        calls = callsArray
            .sort((a: any, b: any) => {
                return a.getPrice() - b.getPrice();
            })
            .valueSeq()
            .map((order: any) => {
                if (state.invertedCalls) {
                    state.lowestCallPrice = !state.lowestCallPrice
                        ? order.getPrice(false)
                        : Math.max(state.lowestCallPrice, order.getPrice(false));
                } else {
                    state.lowestCallPrice = !state.lowestCallPrice
                        ? order.getPrice(false)
                        : Math.min(state.lowestCallPrice, order.getPrice(false));
                }

                return order;
            })
            .toArray();

        if (calls.length > 1) {
            for (let i = calls.length - 2; i >= 0; i--) {
                calls[i] = calls[i].sum(calls[i + 1]);
                calls.splice(i + 1, 1);
            }
        }
    } else {
        state.lowestCallPrice = null;
    }
    return calls;
}

function combineOrders(state: any) {
    const hasCalls = !!state.marketCallOrders.size;
    const isBid = hasCalls && state.marketCallOrders.first().isBid();

    let combinedBids, combinedAsks;

    if (isBid) {
        combinedBids = state.marketData.bids.concat(state.marketData.calls);
        combinedAsks = state.marketData.asks.concat([]);
    } else {
        combinedBids = state.marketData.bids.concat([]);
        combinedAsks = state.marketData.asks.concat(state.marketData.calls);
    }

    let totalToReceive = new Asset({
        asset_id: state.quoteAsset.get("id"),
        precision: state.quoteAsset.get("precision")
    });

    let totalForSale = new Asset({
        asset_id: state.baseAsset.get("id"),
        precision: state.baseAsset.get("precision")
    });
    combinedBids
        .sort((a: any, b: any) => {
            return b.getPrice() - a.getPrice();
        })
        .forEach((a: any) => {
            totalToReceive.plus(a.amountToReceive(true));
            totalForSale.plus(a.amountForSale());

            a.setTotalForSale(totalForSale.clone());
            a.setTotalToReceive(totalToReceive.clone());
        });

    totalToReceive = new Asset({
        asset_id: state.baseAsset.get("id"),
        precision: state.baseAsset.get("precision")
    });

    totalForSale = new Asset({
        asset_id: state.quoteAsset.get("id"),
        precision: state.quoteAsset.get("precision")
    });

    combinedAsks
        .sort((a: any, b: any) => {
            return a.getPrice() - b.getPrice();
        })
        .forEach((a: any) => {
            totalForSale.plus(a.amountForSale());
            totalToReceive.plus(a.amountToReceive(false));
            a.setTotalForSale(totalForSale.clone());
            a.setTotalToReceive(totalToReceive.clone());
        });

    state.marketData.lowestAsk = !combinedAsks.length
        ? nullPrice
        : combinedAsks[0];

    state.marketData.highestBid = !combinedBids.length
        ? nullPrice
        : combinedBids[0];

    state.marketData.combinedBids = combinedBids;
    state.marketData.combinedAsks = combinedAsks;
}

function orderBook(
    state: any,
    limitsChanged = true,
    callsChanged = false
) {
    const constructBids = (orderArray: any) => {
        const bids = orderArray
            .filter((a: any) => {
                return a.isBid();
            })
            .sort((a: any, b: any) => {
                return a.getPrice() - b.getPrice();
            })
            .valueSeq()
            .toArray();

        if (bids.length > 1) {
            for (let i = bids.length - 2; i >= 0; i--) {
                if (bids[i].getPrice() === bids[i + 1].getPrice()) {
                    bids[i] = bids[i].sum(bids[i + 1]);
                    bids.splice(i + 1, 1);
                }
            }
        }
        return bids;
    };
    const constructAsks = (orderArray: any) => {
        const asks = orderArray
            .filter((a: any) => {
                return !a.isBid();
            })
            .sort((a: any, b: any) => {
                return a.getPrice() - b.getPrice();
            })
            .valueSeq()
            .toArray();

        if (asks.length > 1) {
            for (let i = asks.length - 2; i >= 0; i--) {
                if (asks[i].getPrice() === asks[i + 1].getPrice()) {
                    asks[i] = asks[i].sum(asks[i + 1]);
                    asks.splice(i + 1, 1);
                }
            }
        }
        return asks;
    };

    if (limitsChanged) {
        if (__DEV__)
            console.time("Construct limit orders " + state.activeMarket);
        state.marketData.bids = constructBids(state.marketLimitOrders);
        state.marketData.asks = constructAsks(state.marketLimitOrders);
        if (!callsChanged) {
            combineOrders(state);
        }
        if (__DEV__)
            console.timeEnd("Construct limit orders " + state.activeMarket);
    }

    if (callsChanged) {
        if (__DEV__) console.time("Construct calls " + state.activeMarket);
        state.marketData.calls = constructCalls(state, state.marketCallOrders);
        combineOrders(state);
        if (__DEV__) console.timeEnd("Construct calls " + state.activeMarket);
    }
}

function groupedOrderBook(
    state: any,
    groupedOrdersBids: any = null,
    groupedOrdersAsks: any = null
) {
    if (groupedOrdersBids && groupedOrdersAsks) {
        if (__DEV__) console.time("Sum grouped orders " + state.activeMarket);

        let totalToReceive = new Asset({
            asset_id: state.quoteAsset.get("id"),
            precision: state.quoteAsset.get("precision")
        });

        let totalForSale = new Asset({
            asset_id: state.baseAsset.get("id"),
            precision: state.baseAsset.get("precision")
        });
        groupedOrdersBids
            .sort((a: any, b: any) => {
                return b.getPrice() - a.getPrice();
            })
            .forEach((a: any) => {
                totalForSale.plus(a.amountForSale());
                totalToReceive.plus(a.amountToReceive(true));

                a.setTotalForSale(totalForSale.clone());
                a.setTotalToReceive(totalToReceive.clone());
            });

        totalToReceive = new Asset({
            asset_id: state.baseAsset.get("id"),
            precision: state.baseAsset.get("precision")
        });

        totalForSale = new Asset({
            asset_id: state.quoteAsset.get("id"),
            precision: state.quoteAsset.get("precision")
        });

        groupedOrdersAsks
            .sort((a: any, b: any) => {
                return a.getPrice() - b.getPrice();
            })
            .forEach((a: any) => {
                totalForSale.plus(a.amountForSale());
                totalToReceive.plus(a.amountToReceive(false));
                a.setTotalForSale(totalForSale.clone());
                a.setTotalToReceive(totalToReceive.clone());
            });

        state.marketData.groupedBids = groupedOrdersBids;
        state.marketData.groupedAsks = groupedOrdersAsks;

        if (__DEV__)
            console.timeEnd("Sum grouped orders " + state.activeMarket);
    }
}

function depthChart(state: any) {
    let bids: any[] = [],
        asks: any[] = [],
        totalBids = 0,
        totalAsks = 0,
        totalCalls = 0;
    const calls: any[] = [];
    let flat_bids: any[] = [],
        flat_asks: any[] = [],
        flat_calls: any[] = [],
        flat_settles: any[] = [];

    if (state.marketLimitOrders.size) {
        state.marketData.bids.forEach((order: any) => {
            bids.push([
                order.getPrice(),
                order.amountToReceive().getAmount({real: true})
            ]);
            totalBids += order.amountForSale().getAmount({real: true});
        });

        state.marketData.asks.forEach((order: any) => {
            asks.push([
                order.getPrice(),
                order.amountForSale().getAmount({real: true})
            ]);
        });

        asks.sort((a, b) => {
            return a[0] - b[0];
        });

        bids.sort((a, b) => {
            return a[0] - b[0];
        });

        flat_bids = market_utils.flatten_orderbookchart_highcharts(
            bids,
            true,
            true,
            1000
        );

        if (flat_bids.length > 0) {
            flat_bids.unshift([0, flat_bids[0][1]]);
        }

        flat_asks = market_utils.flatten_orderbookchart_highcharts(
            asks,
            true,
            false,
            1000
        );

        if (flat_asks.length > 0) {
            flat_asks.push([
                flat_asks[flat_asks.length - 1][0] * 1.5,
                flat_asks[flat_asks.length - 1][1]
            ]);
            totalAsks = flat_asks[flat_asks.length - 1][1];
        }
    }

    if (state.marketData.calls.length) {
        const callsAsBids = state.marketData.calls[0].isBid();
        state.marketData.calls.forEach((order: any) => {
            calls.push([
                order.getSqueezePrice(),
                order[
                    order.isBid() ? "amountToReceive" : "amountForSale"
                ]().getAmount({real: true})
            ]);
        });

        calls.forEach(call => {
            if (state.invertedCalls) {
                totalCalls += call[1];
            } else {
                totalCalls += call[1] * call[0];
            }
        });

        if (callsAsBids) {
            totalBids += totalCalls;
        } else {
            totalAsks += totalCalls;
        }

        calls.sort((a, b) => {
            return a[0] - b[0];
        });

        if (state.invertedCalls) {
            flat_calls = market_utils.flatten_orderbookchart_highcharts(
                calls,
                true,
                false,
                1000
            );
            if (
                flat_asks.length > 0 &&
                flat_calls[flat_calls.length - 1][0] <
                    flat_asks[flat_asks.length - 1][0]
            ) {
                flat_calls.push([
                    flat_asks[flat_asks.length - 1][0],
                    flat_calls[flat_calls.length - 1][1]
                ]);
            }
        } else {
            flat_calls = market_utils.flatten_orderbookchart_highcharts(
                calls,
                true,
                true,
                1000
            );
            if (flat_calls.length > 0) {
                flat_calls.unshift([0, flat_calls[0][1]]);
            }
        }
    }

    if (state.marketSettleOrders.size) {
        flat_settles = state.marketSettleOrders.reduce(
            (final: any, a: any) => {
                if (!final) {
                    return [
                        [
                            a.getPrice(),
                            a[
                                !a.isBid()
                                    ? "amountForSale"
                                    : "amountToReceive"
                            ]().getAmount({real: true})
                        ]
                    ];
                } else {
                    final[0][1] =
                        final[0][1] +
                        a[
                            !a.isBid() ? "amountForSale" : "amountToReceive"
                        ]().getAmount({real: true});
                    return final;
                }
            },
            null
        );

        if (!state.feedPrice.inverted) {
            flat_settles.unshift([0, flat_settles[0][1]]);
        } else if (flat_asks.length > 0) {
            flat_settles.push([
                flat_asks[flat_asks.length - 1][0],
                flat_settles[0][1]
            ]);
        }
    }

    if (
        state.marketData.groupedBids.length > 0 &&
        state.marketData.groupedAsks.length > 0
    ) {
        bids = [];
        asks = [];
        totalBids = 0;
        totalAsks = 0;
        state.marketData.groupedBids.forEach((order: any) => {
            bids.push([
                order.getPrice(),
                order.amountToReceive().getAmount({real: true})
            ]);
            totalBids += order.amountForSale().getAmount({real: true});
        });

        state.marketData.groupedAsks.forEach((order: any) => {
            asks.push([
                order.getPrice(),
                order.amountForSale().getAmount({real: true})
            ]);
        });

        asks.sort((a, b) => {
            return a[0] - b[0];
        });

        bids.sort((a, b) => {
            return a[0] - b[0];
        });

        flat_bids = market_utils.flatten_orderbookchart_highcharts(
            bids,
            true,
            true,
            1000
        );

        if (flat_bids.length > 0) {
            flat_bids.unshift([0, flat_bids[0][1]]);
        }

        flat_asks = market_utils.flatten_orderbookchart_highcharts(
            asks,
            true,
            false,
            1000
        );
        if (flat_asks.length > 0) {
            flat_asks.push([
                flat_asks[flat_asks.length - 1][0] * 1.5,
                flat_asks[flat_asks.length - 1][1]
            ]);
            totalAsks = flat_asks[flat_asks.length - 1][1];
        }
    }

    state.marketData.flatAsks = flat_asks;
    state.marketData.flatBids = flat_bids;
    state.marketData.flatCalls = flat_calls;
    state.marketData.flatSettles = flat_settles;
    state.totals = {
        bid: totalBids,
        ask: totalAsks,
        call: totalCalls
    };
}

export function calcMarketStats(
    base: any,
    quote: any,
    market: any,
    ticker: any
): any {
    const volumeBaseAsset = new Asset({
        real: parseFloat(ticker.base_volume),
        asset_id: base.get("id"),
        precision: base.get("precision")
    } as any);
    const volumeQuoteAsset = new Asset({
        real: parseFloat(ticker.quote_volume),
        asset_id: quote.get("id"),
        precision: quote.get("precision")
    } as any);

    let price;
    try {
        price = new Price({
            base: volumeBaseAsset,
            quote: volumeQuoteAsset,
            real: parseFloat(ticker.latest)
        });
    } catch (err) {}
    let close = !!price
        ? {
              base: price.base.toObject(),
              quote: price.quote.toObject()
          }
        : null;

    if (!!price && isNaN(price.toReal())) {
        price = undefined;
        close = null;
    }

    return {
        change: parseFloat(ticker.percent_change).toFixed(2),
        volumeBase: volumeBaseAsset.getAmount({real: true}),
        volumeQuote: volumeQuoteAsset.getAmount({real: true}),
        price,
        close
    };
}

export function invertMarketStats(stats: any, market: any): any {
    const invertedMarketName =
        market.split("_")[1] + "_" + market.split("_")[0];
    return {
        invertedStats: {
            change: (
                (1 / (1 + parseFloat(stats.change) / 100) - 1) *
                100
            ).toFixed(2),
            price: stats.price ? stats.price.invert() : stats.price,
            volumeBase: stats.volumeQuote,
            volumeQuote: stats.volumeBase,
            close: stats.close
                ? {
                      base: stats.close.quote,
                      quote: stats.close.base
                  }
                : stats.close
        },
        invertedMarketName
    };
}

function updateSettleOrders(state: any, result: any) {
    if (result.settles && result.settles.length) {
        const assets: any = {
            [state.quoteAsset.get("id")]: {
                precision: state.quoteAsset.get("precision")
            },
            [state.baseAsset.get("id")]: {
                precision: state.baseAsset.get("precision")
            }
        };
        state.marketSettleOrders = state.marketSettleOrders.clear();

        result.settles.forEach((settle: any) => {
            settle.settlement_date = new Date(settle.settlement_date + "Z");

            state.marketSettleOrders = state.marketSettleOrders.add(
                new SettleOrder(
                    settle,
                    assets,
                    state.quoteAsset.get("id"),
                    state.feedPrice,
                    state.bitasset_options
                )
            );
        });
    }
}

// Mirrors MarketsStore.js's onClearMarket - never bound to any action
// (`// onClearMarket: MarketsActions.clearMarket,` is commented out in
// the original `bindListeners` call), only ever invoked internally from
// inside onSubscribeMarket when switching to a new market. Kept as a
// plain helper for that one call site, same as the original.
function clearMarketState(state: any) {
    state.activeMarket = null;
    state.is_prediction_market = false;
    state.marketLimitOrders = state.marketLimitOrders.clear();
    state.marketCallOrders = state.marketCallOrders.clear();
    state.allCallOrders = [];
    state.feedPrice = null;
    state.marketSettleOrders = state.marketSettleOrders.clear();
    state.activeMarketHistory = state.activeMarketHistory.clear();
    state.marketData = buildInitialMarketData();
    state.totals = {
        bid: 0,
        ask: 0,
        call: 0
    };
    state.lowestCallPrice = null;
    state.pendingCreateLimitOrders = [];
    state.priceHistory = [];
    state.marketStats = Immutable.Map({
        change: 0,
        volumeBase: 0,
        volumeQuote: 0
    });
}

const marketsSlice = createSlice({
    name: "markets",
    initialState,
    reducers: {
        // Mirrors MarketsStore.js's onSubscribeMarket. The pure-state
        // half only - see this file's header and MarketsStore.ts for
        // where the rest (unsubscribe/notify/resolve/saveMarketStats)
        // runs.
        onSubscribeMarket(state, action: PayloadAction<any>) {
            const result = action.payload;
            if (result.switchMarket) {
                state.marketReady = false;
                return;
            }

            let limitsChanged = false,
                callsChanged = false;

            state.invertedCalls = result.inverted;

            state.quoteAsset = ChainStore.getAsset(result.quote.get("id"));
            state.baseAsset = ChainStore.getAsset(result.base.get("id"));

            const assets: any = {
                [state.quoteAsset.get("id")]: {
                    precision: state.quoteAsset.get("precision")
                },
                [state.baseAsset.get("id")]: {
                    precision: state.baseAsset.get("precision")
                }
            };

            if (result.market && result.market !== state.activeMarket) {
                clearMarketState(state);
                state.activeMarket = result.market;
                // original also calls `this.unsubscribe("subscribeBars")`
                // here - pub-sub bookkeeping on the facade, done by
                // MarketsStore.ts's onSubscribeMarket() before this
                // dispatch (see that file).
            }

            state.feedPrice = getFeed(state);

            if (result.buckets) {
                state.buckets = result.buckets;
                if (result.buckets.indexOf(state.bucketSize) === -1) {
                    state.bucketSize =
                        result.buckets[result.buckets.length - 1];
                }
            }

            if (result.buckets) {
                state.buckets = result.buckets;
            }

            if (result.limits) {
                const oldmarketLimitOrders = state.marketLimitOrders;
                state.marketLimitOrders = state.marketLimitOrders.clear();
                result.limits.forEach((order: any) => {
                    if (typeof order.for_sale !== "number") {
                        order.for_sale = parseInt(order.for_sale, 10);
                    }
                    order.expiration = new Date(order.expiration);
                    state.marketLimitOrders = state.marketLimitOrders.set(
                        order.id,
                        new LimitOrder(order, assets, state.quoteAsset.get("id"))
                    );
                });

                limitsChanged = didOrdersChange(
                    state.marketLimitOrders,
                    oldmarketLimitOrders
                );

                for (
                    let i = state.pendingCreateLimitOrders.length - 1;
                    i >= 0;
                    i--
                ) {
                    const myOrder = state.pendingCreateLimitOrders[i];
                    const order = state.marketLimitOrders.find(
                        (order: any) => {
                            return (
                                myOrder.seller === order.seller &&
                                myOrder.expiration === order.expiration
                            );
                        }
                    );

                    if (order) {
                        state.pendingCreateLimitOrders.splice(i, 1);
                    }
                }

                if (state.pendingCreateLimitOrders.length === 0) {
                    state.pendingCounter = 0;
                }
            }

            if (result.calls) {
                const oldmarketCallOrders = state.marketCallOrders;
                state.allCallOrders = result.calls;
                state.marketCallOrders = state.marketCallOrders.clear();

                result.calls.forEach((call: any) => {
                    try {
                        const mcr = state[
                            state.invertedCalls ? "baseAsset" : "quoteAsset"
                        ].getIn([
                            "bitasset",
                            "current_feed",
                            "maintenance_collateral_ratio"
                        ]);

                        const callOrder = new CallOrder(
                            call,
                            assets,
                            state.quoteAsset.get("id"),
                            state.feedPrice,
                            mcr,
                            state.is_prediction_market
                        );
                        if (callOrder.isMarginCalled()) {
                            state.marketCallOrders = state.marketCallOrders.set(
                                call.id,
                                callOrder,
                                mcr
                            );
                        }
                    } catch (err) {
                        console.error(
                            "Unable to construct calls array, invalid feed price or prediction market?"
                        );
                    }
                });

                callsChanged = didOrdersChange(
                    state.marketCallOrders,
                    oldmarketCallOrders
                );
            }

            updateSettleOrders(state, result);

            if (result.history) {
                state.activeMarketHistory = state.activeMarketHistory.clear();
                result.history.forEach((order: any) => {
                    if (
                        !order.op.is_maker &&
                        !(
                            order.op.receives.amount == 0 ||
                            order.op.pays.amount == 0
                        )
                    ) {
                        state.activeMarketHistory = state.activeMarketHistory.add(
                            new FillOrder(
                                order,
                                assets,
                                state.quoteAsset.get("id")
                            )
                        );
                    }
                });
            }

            if (result.fillOrders) {
                result.fillOrders.forEach((fill: any) => {
                    state.activeMarketHistory = state.activeMarketHistory.add(
                        new FillOrder(
                            fill[0][1],
                            assets,
                            state.quoteAsset.get("id")
                        )
                    );
                });
            }

            if (result.ticker) {
                const marketName =
                    state.quoteAsset.get("symbol") +
                    "_" +
                    state.baseAsset.get("symbol");
                const stats = calcMarketStats(
                    state.baseAsset,
                    state.quoteAsset,
                    marketName,
                    result.ticker
                );

                state.allMarketStats = state.allMarketStats.set(
                    marketName,
                    stats
                );
                const {
                    invertedStats,
                    invertedMarketName
                } = invertMarketStats(stats, marketName);
                state.allMarketStats = state.allMarketStats.set(
                    invertedMarketName,
                    invertedStats
                );
                // original: this._saveMarketStats() here - debounced
                // localStorage write, moved to MarketsStore.ts (see
                // this file's header).

                state.marketStats = state.marketStats.set(
                    "change",
                    stats.change
                );
                state.marketStats = state.marketStats.set(
                    "volumeBase",
                    stats.volumeBase
                );
                state.marketStats = state.marketStats.set(
                    "volumeQuote",
                    stats.volumeQuote
                );
            }

            if (callsChanged || limitsChanged) {
                orderBook(state, limitsChanged, callsChanged);
                depthChart(state);
            }

            if (result.price) {
                state.priceHistory = result.price;
                priceChart(state);
            }

            if (
                result.groupedOrdersBids.length > 0 ||
                result.groupedOrdersAsks.length > 0
            ) {
                const groupedOrdersBids: any[] = [];
                const groupedOrdersAsks: any[] = [];
                result.groupedOrdersBids.forEach((order: any) => {
                    groupedOrdersBids.push(
                        new GroupedOrder(order, assets, true)
                    );
                });
                result.groupedOrdersAsks.forEach((order: any) => {
                    groupedOrdersAsks.push(
                        new GroupedOrder(order, assets, false)
                    );
                });
                groupedOrderBook(state, groupedOrdersBids, groupedOrdersAsks);
                depthChart(state);
            }

            state.marketReady = true;
            // original: this.emitChange() here, then (if newMarket)
            // this._notifySubscriber("market_change", ...), then (if
            // result.resolve) result.resolve() - all orchestration, run
            // by MarketsStore.ts right after this reducer (see its
            // header/onSubscribeMarket for the exact ordering preserved).
        },

        // Mirrors MarketsStore.js's onUnSubscribeMarket. The
        // `payload.resolve()` call is orchestration, run by
        // MarketsStore.ts right after this dispatch.
        onUnSubscribeMarket(state, action: PayloadAction<any>) {
            const payload = action.payload;
            if (payload.unSub) {
                state.activeMarket = null;
            } else {
                state.activeMarket = payload.market;
            }
        },

        onChangeBase(state, action: PayloadAction<any>) {
            state.marketBase = action.payload;
        },

        onChangeBucketSize(state, action: PayloadAction<number>) {
            state.bucketSize = action.payload;
            marketStorage.set("bucketSize", action.payload);
        },

        onCancelLimitOrderSuccess(state, action: PayloadAction<any[]>) {
            const cancellations = action.payload;
            if (cancellations && cancellations.length) {
                let didUpdate = false;
                cancellations.forEach((orderID: any) => {
                    if (orderID && state.marketLimitOrders.has(orderID)) {
                        didUpdate = true;
                        state.marketLimitOrders = state.marketLimitOrders.delete(
                            orderID
                        );
                    }
                });

                if (state.marketLimitOrders.size === 0) {
                    state.marketData.bids = [];
                    state.marketData.flatBids = [];
                    state.marketData.asks = [];
                    state.marketData.flatAsks = [];
                }

                if (didUpdate) {
                    orderBook(state, true, false);
                    depthChart(state);
                }
            }
        },

        onCloseCallOrderSuccess(state, action: PayloadAction<any>) {
            const orderID = action.payload;
            if (orderID && state.marketCallOrders.has(orderID)) {
                state.marketCallOrders = state.marketCallOrders.delete(
                    orderID
                );
                if (state.marketCallOrders.size === 0) {
                    state.marketData.calls = [];
                    state.marketData.flatCalls = [];
                }
                orderBook(state, false, true);
                depthChart(state);
            }
        },

        onCallOrderUpdate(state, action: PayloadAction<any>) {
            const call_order = action.payload;
            if (
                call_order &&
                state.quoteAsset &&
                state.baseAsset &&
                state.feedPrice
            ) {
                if (
                    call_order.call_price.quote.asset_id ===
                        state.quoteAsset.get("id") ||
                    call_order.call_price.quote.asset_id ===
                        state.baseAsset.get("id")
                ) {
                    const assets: any = {
                        [state.quoteAsset.get("id")]: {
                            precision: state.quoteAsset.get("precision")
                        },
                        [state.baseAsset.get("id")]: {
                            precision: state.baseAsset.get("precision")
                        }
                    };
                    try {
                        const mcr = state[
                            state.invertedCalls ? "baseAsset" : "quoteAsset"
                        ].getIn([
                            "bitasset",
                            "current_feed",
                            "maintenance_collateral_ratio"
                        ]);

                        const callOrder = new CallOrder(
                            call_order,
                            assets,
                            state.quoteAsset.get("id"),
                            state.feedPrice,
                            mcr
                        );

                        if (callOrder.isMarginCalled()) {
                            state.marketCallOrders = state.marketCallOrders.set(
                                call_order.id,
                                callOrder,
                                mcr
                            );

                            orderBook(state, false, true);
                            depthChart(state);
                        }
                    } catch (err) {
                        console.error(
                            "Unable to construct calls array, invalid feed price or prediction market?",
                            call_order,
                            state.quoteAsset && state.quoteAsset.get("id"),
                            state.baseAsset && state.baseAsset.get("id")
                        );
                    }
                }
            }
        },

        onFeedUpdate(state, action: PayloadAction<any>) {
            const asset = action.payload;
            if (!state.quoteAsset || !state.baseAsset) {
                return;
            }
            if (
                asset.get("id") ===
                state[state.invertedCalls ? "baseAsset" : "quoteAsset"].get(
                    "id"
                )
            ) {
                state[state.invertedCalls ? "baseAsset" : "quoteAsset"] = asset;
            } else {
                return;
            }

            let feedChanged = false;
            const newFeed = getFeed(state);
            if (
                (newFeed && !state.feedPrice) ||
                (state.feedPrice && state.feedPrice.ne(newFeed))
            ) {
                feedChanged = true;
            }

            if (feedChanged) {
                state.feedPrice = newFeed;
                const assets: any = {
                    [state.quoteAsset.get("id")]: {
                        precision: state.quoteAsset.get("precision")
                    },
                    [state.baseAsset.get("id")]: {
                        precision: state.baseAsset.get("precision")
                    }
                };

                state.marketCallOrders = state.marketCallOrders.clear();
                state.allCallOrders.forEach((call: any) => {
                    try {
                        const mcr = state[
                            state.invertedCalls ? "baseAsset" : "quoteAsset"
                        ].getIn([
                            "bitasset",
                            "current_feed",
                            "maintenance_collateral_ratio"
                        ]);

                        const callOrder = new CallOrder(
                            call,
                            assets,
                            state.quoteAsset.get("id"),
                            state.feedPrice,
                            mcr,
                            state.is_prediction_market
                        );
                        if (callOrder.isMarginCalled()) {
                            state.marketCallOrders = state.marketCallOrders.set(
                                call.id,
                                new CallOrder(
                                    call,
                                    assets,
                                    state.quoteAsset.get("id"),
                                    state.feedPrice,
                                    mcr
                                )
                            );
                        }
                    } catch (err) {
                        console.error(
                            "Unable to construct calls array, invalid feed price or prediction market?"
                        );
                    }
                });

                orderBook(state, true, true);
                depthChart(state);
            }
        },

        onGetMarketStats(state, action: PayloadAction<any>) {
            const payload = action.payload;
            if (payload && payload.tickers) {
                for (let i = 0; i < payload.tickers.length; i++) {
                    const stats = calcMarketStats(
                        payload.bases[i],
                        payload.quotes[i],
                        payload.markets[i],
                        payload.tickers[i]
                    );
                    state.allMarketStats = state.allMarketStats.set(
                        payload.markets[i],
                        stats
                    );

                    const {
                        invertedStats,
                        invertedMarketName
                    } = invertMarketStats(stats, payload.markets[i]);
                    state.allMarketStats = state.allMarketStats.set(
                        invertedMarketName,
                        invertedStats
                    );
                }
                // original: this._saveMarketStats() here - moved to
                // MarketsStore.ts, same as onSubscribeMarket's ticker
                // branch (see this file's header).
            }
        },

        onSettleOrderUpdate(state, action: PayloadAction<any>) {
            updateSettleOrders(state, action.payload);
        },

        onSwitchMarket(state) {
            state.marketReady = false;
        },

        onToggleStars(state) {
            state.onlyStars = !state.onlyStars;
            marketStorage.set("onlyStars", state.onlyStars);
        },

        onGetTrackedGroupsConfig(state, action: PayloadAction<any>) {
            const result = action.payload;
            if (result.trackedGroupsConfig.length > 0) {
                state.trackedGroupsConfig = result.trackedGroupsConfig;
            }
        },

        onChangeCurrentGroupLimit(state, action: PayloadAction<number>) {
            state.currentGroupLimit = action.payload;
        }
    }
});

export const {
    onSubscribeMarket,
    onUnSubscribeMarket,
    onChangeBase,
    onChangeBucketSize,
    onCancelLimitOrderSuccess,
    onCloseCallOrderSuccess,
    onCallOrderUpdate,
    onFeedUpdate,
    onGetMarketStats,
    onSettleOrderUpdate,
    onSwitchMarket,
    onToggleStars,
    onGetTrackedGroupsConfig,
    onChangeCurrentGroupLimit
} = marketsSlice.actions;

export const selectMarkets = (state: {markets: MarketsState}) =>
    state.markets;

export default marketsSlice.reducer;
