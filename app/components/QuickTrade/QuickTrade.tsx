// TypeScript/function-component port of the legacy QuickTrade.jsx (Phase
// 8, docs/UI_MIGRATION_PLAN.md) - the "instant trade" card: pick a sell
// asset/amount and a receive asset/amount, see the resulting price/fee
// breakdown and matched order book slice, then submit a fill-or-kill
// limit order. Mechanical class-to-hooks translation; no change to any
// order-building, fee-calculation, or market-subscription logic.
//
// ***** SECURITY-SENSITIVE per AGENTS.md *****
// `handleSell()` (near the bottom of this file) builds the real
// `LimitOrderCreate` and calls `MarketsActions.createLimitOrder2(order)` -
// the actual on-chain trade-submission call - with the exact same
// `for_sale`/`to_receive`/`expiration`/`seller`/`fee`/`fill_or_kill`
// argument construction as the original, byte-for-byte: same field names,
// same `10 ** precision` scaling, same hardcoded `fee: {asset_id:
// "1.3.0", amount: 0}` (the network computes the real fee;
// `fill_or_kill: true` is also unchanged). `.then()/.catch()` are
// preserved verbatim too, including the exact "wallet locked" error-
// message check that suppresses the generic error notification.
// `subToMarket()` preserves both `MarketsActions.unSubscribeMarket(...)`
// and `MarketsActions.subscribeMarket(baseAsset, quoteAsset, 3600, 0)`
// call sites exactly (including the pre-existing hardcoded-vs-destructured
// quirk documented below), and `componentWillUnmount`'s
// `MarketsActions.unSubscribeMarket(...)` cleanup call is preserved as an
// unmount-only effect. `AssetActions.getAssetList.defer` is still
// debounced 150ms exactly as before. No password/private-key/brainkey
// material is read, logged, or persisted anywhere in this file (grepped
// every `console.*` call: all are either `__DEV__`-gated debug logs of
// route paths/asset ids/market data, or a generic `console.error("order
// failed:", e)` catch-all that only logs the thrown error object) - none
// of that is security-sensitive content, so all are kept verbatim.
//
// ----------------------------------------------------------------------
// Structural translation
// ----------------------------------------------------------------------
// - `connect(QuickTrade, {listenTo: [AssetStore, MarketsStore],
//   getProps() {...}})` becomes `QuickTradeStoreConnected`, a thin
//   wrapper calling `useAltStore` once per store and passing the same
//   eight derived props through, spread *after* `{...props}` so store-
//   derived values keep winning over any same-named explicit prop, per
//   this migration's established `connect` -> `useAltStore` precedent
//   (see `AccountPortfolioList.tsx`'s header comment for the worked
//   example; alt-react's `connect` renders `<Component {...this.props}
//   {...this.getNextProps()} />`).
// - `bindToCurrentAccount(QuickTrade)` (the outermost original wrapper)
//   is reused as-is from the already-ported `Utility/
//   BindToCurrentAccount.tsx` - `export default
//   bindToCurrentAccount(QuickTradeStoreConnected)` below reproduces the
//   exact same wrapper nesting order as the original's
//   `bindToCurrentAccount(connect(QuickTrade, {...}))`.
// - `getDerivedStateFromProps(props, state)` (recomputes
//   `sellAssetInput`/`sellAsset`/`sellImgName` from `props.assetToSell`
//   whenever it's truthy, and the matching three `receive*` fields from
//   `props.assetToReceive`, leaving whichever side's fields untouched -
//   not reset - when its prop is falsy) is replicated by mutating the
//   object `useState` returned, in place, unconditionally on *every*
//   render, before it's used for anything else in this render - the
//   same precedent `WithdrawModalNew.tsx`'s `WithdrawModalCore` already
//   established for reproducing a legacy derived-state computation at
//   the exact same point in the render cycle a class component would,
//   without an extra render pass. This exact unconditional-every-render
//   overwrite is also what makes two real, confirmed, and *intentionally
//   preserved* bugs reproduce themselves automatically in this port, with
//   no special-casing needed:
//     1. `onSellImageError`/`onReceiveImageError` were defined and bound
//        in the constructor but never actually wired to anything (not
//        passed to `<SellReceive>`, not read anywhere else) - confirmed
//        dead via a full read of `render()`'s JSX and a grep for both
//        names; dropped entirely rather than translated.
//     2. `onReceiveAssetSearch`'s `setState({receiveAsset: null,
//        receiveAssetInput: e, activeSearch: false})` branch (for an
//        invalid typed symbol) is immediately overwritten back by
//        `getDerivedStateFromProps` on the very next render whenever
//        `props.assetToReceive` is still truthy (which it normally is
//        while the user is typing over an already-selected asset) -
//        confirmed by tracing the exact same render-order interaction.
//        Preserved verbatim per AGENTS.md ("preserve every bug/quirk
//        verbatim... document it instead"), not fixed.
// - `componentDidUpdate(prevProps)` becomes one dependency-array-free
//   `useEffect` (so it runs after every commit, matching "runs after
//   every update") that skips its body on the very first run (mount) via
//   an `isFirstUpdateRef` guard, and otherwise replicates its four
//   branches - asset-change vs. market-change (still mutually exclusive
//   via `else if`, exactly as written), `searchAssets` identity change,
//   and `currentAccount` identity change - against a ref holding the
//   previous render's relevant prop values (updated at the end of the
//   effect, mirroring what `prevProps` would have held).
// - `componentDidMount`/`componentWillUnmount` become a mount-only
//   `useEffect(() => {...}, [])` and a separate unmount-only cleanup
//   effect. The unmount cleanup reads a `stateRef` mirror (updated on
//   every render) rather than closing over stale state, since it must
//   see whatever `sub`/asset ids were current at the moment of
//   unmounting, exactly like `this.state` would for the original's
//   `componentWillUnmount`.
// - Every remaining instance method becomes a `const` (or, for the pure
//   getters that only ever read `state`/`props` and call each other -
//   `_getTransactionFee`/`_getMarketFee`/`_getFeePercent`/
//   `getLiquidityPenalty`/`getTotalPercentFee`/`showFeedPrice`/
//   `getPriceSection`/`getFeeSection`/`getOrdersSection`/`getDetails`/
//   `showDetails`/`hasBalance` - a nested `function` declaration, so
//   they can freely call each other regardless of declaration order,
//   same as the original class's methods could) closure inside
//   `QuickTradeCore`, or (for the ones with no `this.state`/`this.props`
//   dependency at all - `_isLoadedAsset`/`_areEqualAssets`/
//   `_areAssetsGiven`/`_haveAssetsChanged`/`_hasMarketChanged`/
//   `_routeTo`/`getAssetsDetails`/`_getOrders`/`updateSellAmount`/
//   `updateReceiveAmount`/`getAllPrices`/`getAllFees` - a module-level
//   pure function taking the relevant `state`/`props` explicitly as
//   arguments) above the component, matching this migration's
//   established "pure helper extracted to module scope, stateful
//   closure stays inside the component" split (see
//   `WithdrawModalNew.tsx`'s `getAssetPairVariables`/
//   `getAvailableAssets`, for example).
// - Several `this.setState({...}, callback)` calls had a callback that
//   itself reads one of the just-set fields back out of `this.state`
//   (e.g. `onSellAmountChange`'s callback invoking `_getOrders()`, which
//   reads the just-set `sellAmount`/`activeInput`). Since a hook's
//   `mergeState` has no synchronous "has committed" callback, each such
//   call builds the next-state object explicitly first (the same
//   "`nextState`, then `setState(nextState)`, then reuse `nextState`"
//   shape already used by `WithdrawModalNew.tsx`'s
//   `onAssetSelected`/`onGatewayChanged`) and passes that explicit object
//   into the now-module-level `getOrders`-driving helper, rather than
//   re-reading a ref that might not reflect the pending update yet. The
//   handful of other `setState(..., callback)` call sites whose callback
//   does *not* read anything the same call just changed (`_subToMarket`'s
//   `getAllPrices`/`getAllFees`, `_setSellAsset`/`_setReceiveAsset`/
//   `_swapAssets`'s `_routeTo`, `_checkAndUpdateMarketList`'s
//   `_subToMarket`) simply call that follow-up function right after
//   `mergeState`, since nothing they read was part of that same update.
//
// ----------------------------------------------------------------------
// Confirmed-dead code dropped (grepped/read in full)
// ----------------------------------------------------------------------
// - `onSellImageError`/`onReceiveImageError`: see point 1 above.
// - The `fireChanged` parameter on `_setSellAsset`/`_setReceiveAsset`/
//   `_swapAssets`: declared (defaulting to `true`) on all three, never
//   read inside any of the three bodies, and every call site passes at
//   most two positional arguments (`activeInput`, never a third) -
//   confirmed dead, dropped from all three.
// - `_subToMarket`'s `const {bucketSize, currentGroupOrderLimit} =
//   this.props;` destructure: both immediately shadowed-out by the very
//   next line's hardcoded `MarketsActions.subscribeMarket(baseAsset,
//   quoteAsset, 3600, 0)` call, which never reads either variable -
//   confirmed dead extraction (the hardcoded `3600, 0` observable
//   behavior is preserved exactly; only the inert destructuring that fed
//   nothing is dropped, documented here rather than silently vanished).
// - The `async`/`await` keywords on `_setSellAsset`/`_setReceiveAsset`/
//   `_swapAssets`/`onSellAssetInputChange`/`onReceiveAssetInputChange`:
//   none of their call sites ever awaited the returned promise, and
//   `_swapAssets` itself never used `await` internally - dropped as a
//   non-observable mechanical simplification (the two methods that *do*
//   genuinely need to stay async, `_setSellAsset`/`_setReceiveAsset`,
//   keep it, since they `await FetchChain(...)`).
//
// ----------------------------------------------------------------------
// Preserved verbatim (not "fixed")
// ----------------------------------------------------------------------
// - The misspelled `hendleOrderView` method name - purely internal
//   (never exposed via any ref/external API), kept as-is rather than
//   quietly "corrected".
// - Every fee/price/liquidity-penalty arithmetic formula, exactly as
//   written, including `getTotalPercentFee`'s unguarded addition of a
//   possibly-`undefined` `liquidityFee` (from `getLiquidityPenalty()[0]`
//   when `prices.latestPrice`/`sellAmount` aren't both set) to two
//   percentages - this can legitimately produce `NaN`, same as before.
import * as React from "react";
import {bindToCurrentAccount} from "../Utility/BindToCurrentAccount";
import AssetStore from "../../stores/AssetStore";
import MarketsStore from "../../stores/MarketsStore";
import {
    Card,
    Collapse,
    Row,
    Col,
    Table,
    Button,
    Switch,
    Tooltip
} from "bitshares-ui-style-guide";
import SellReceive from "components/QuickTrade/SellReceive";
import MarketsActions from "actions/MarketsActions";
import {
    getAssetsToSell,
    getPrices,
    getOrders,
    getFees
} from "./QuickTradeHelper";
import {ChainStore, FetchChain} from "bitsharesjs";
import {debounce} from "lodash-es";
import AssetActions from "actions/AssetActions";
import {ChainValidation} from "bitsharesjs";
import {lookupAssets} from "../Exchange/MarketPickerHelpers";
import counterpart from "counterpart";
import LinkToAccountById from "../Utility/LinkToAccountById";
import {Asset, LimitOrderCreate as LimitOrderCreateUntyped} from "common/MarketClasses";
import {Notification} from "bitshares-ui-style-guide";
import FormattedPrice from "../Utility/FormattedPrice";
import AssetName from "../Utility/AssetName";
import Translate from "react-translate-component";
import {useAltStore} from "../../next/hooks/useAltStore";

// `LimitOrderCreate`'s constructor destructures some params without
// default values mixed with others that do have them - TS's JS inference
// only picks up the defaulted ones as known properties (same pre-existing
// inference gap already worked around for the same reason in
// `Exchange.tsx`). `Asset`'s constructor defaults every param, so it is
// used directly with no cast.
const LimitOrderCreate: any = LimitOrderCreateUntyped;

export interface QuickTradeProps {
    assetToSell: any;
    assetToReceive: any;
    currentAccount: any;
    location: any;
    history: any;
    match?: any;
    searchAssets: any;
    assetsLoading?: any;
    marketData: any;
    activeMarketHistory: any;
    bucketSize?: any;
    currentGroupOrderLimit?: any;
    feedPrice: any;
    marketLimitOrders?: any;
}

interface QuickTradeState {
    mounted: boolean;
    sub: string;
    sellAssetInput: string;
    sellAsset: any;
    sellAssets: any[];
    sellAmount: string;
    sellImgName: string;
    receiveAssetInput: string;
    receiveAsset: any;
    receiveAssets: any[];
    receiveAmount: string;
    receiveImgName: string;
    activeInput: string;
    activeAmountInput: string;
    lookupQuote: string;
    orders: any[];
    orderView: string;
    fees: any;
    prices: any;
    isSubscribedToMarket: boolean;
    activeSearch?: boolean;
    ordersUpdated?: Date;
}

function getInitialState(currentAccount: any): QuickTradeState {
    const accountAssets = getAssetsToSell(currentAccount);
    return {
        mounted: false,
        sub: "",
        sellAssetInput: "",
        sellAsset: null,
        sellAssets: accountAssets,
        sellAmount: "",
        sellImgName: "unknown",
        receiveAssetInput: "",
        receiveAsset: null,
        receiveAssets: accountAssets,
        receiveAmount: "",
        receiveImgName: "unknown",
        activeInput: "",
        activeAmountInput: "",
        lookupQuote: "",
        orders: [],
        orderView: "amount",
        fees: null,
        prices: null,
        isSubscribedToMarket: true
    };
}

function isLoadedAsset(asset: any): boolean {
    return !!asset && !!asset.toJS;
}

function areEqualAssets(asset1: any, asset2: any): boolean {
    return (
        isLoadedAsset(asset1) &&
        isLoadedAsset(asset2) &&
        asset1.get("id") === asset2.get("id")
    );
}

function areAssetsGiven(props: {assetToSell: any; assetToReceive: any}) {
    return (
        isLoadedAsset(props.assetToSell) && isLoadedAsset(props.assetToReceive)
    );
}

function haveAssetsChanged(
    props: {assetToSell: any; assetToReceive: any},
    prevProps: {assetToSell: any; assetToReceive: any}
): boolean {
    if (
        isLoadedAsset(props.assetToSell) !== isLoadedAsset(prevProps.assetToSell)
    ) {
        return true;
    }
    if (
        isLoadedAsset(props.assetToReceive) !==
        isLoadedAsset(prevProps.assetToReceive)
    ) {
        return true;
    }
    if (
        !areEqualAssets(props.assetToSell, prevProps.assetToSell) ||
        !areEqualAssets(props.assetToReceive, prevProps.assetToReceive)
    ) {
        return true;
    }
    return false;
}

function hasMarketChanged(
    props: {marketData: any},
    prevProps: {marketData: any}
): boolean {
    return JSON.stringify(prevProps.marketData) !== JSON.stringify(props.marketData);
}

function routeTo(
    props: QuickTradeProps,
    assetToSellSymbol: string,
    assetToReceiveSymbol: string
) {
    let sellRoute = assetToSellSymbol;
    let receiveRoute = assetToReceiveSymbol;
    if (!assetToSellSymbol) {
        sellRoute = "";
    }
    if (!assetToReceiveSymbol) {
        receiveRoute = "";
    }
    const pathName = "/instant-trade/" + sellRoute + "_" + receiveRoute;
    if (__DEV__) {
        console.log(
            "_routeTo: ",
            pathName,
            " old: ",
            props.location.pathname
        );
    }
    if (props.location.pathname !== pathName) {
        props.history.push(pathName);
    }
}

function getAssetsDetails(state: QuickTradeState) {
    const {sellAsset, receiveAsset} = state;
    return {
        sellAssetId: sellAsset ? sellAsset.get("id") : null,
        receiveAssetId: receiveAsset ? receiveAsset.get("id") : null,
        sellAssetPrecision: sellAsset ? sellAsset.get("precision") : null,
        receiveAssetPrecision: receiveAsset
            ? receiveAsset.get("precision")
            : null,
        sellAssetSymbol: sellAsset ? sellAsset.get("symbol") : null,
        receiveAssetSymbol: receiveAsset ? receiveAsset.get("symbol") : null
    };
}

function getAllPrices(
    props: QuickTradeProps,
    mergeState: (patch: Partial<QuickTradeState>) => void
) {
    const {activeMarketHistory, feedPrice} = props;
    const prices = getPrices(activeMarketHistory, feedPrice);
    mergeState({prices});
}

async function getAllFees(
    props: QuickTradeProps,
    state: QuickTradeState,
    mergeState: (patch: Partial<QuickTradeState>) => void
) {
    const {currentAccount} = props;
    const {sellAsset, receiveAsset} = state;
    if (sellAsset && receiveAsset) {
        const fees = await getFees(receiveAsset, sellAsset, currentAccount);
        mergeState({fees});
    }
}

function updateSellAmount(
    state: QuickTradeState,
    mergeState: (patch: Partial<QuickTradeState>) => void
) {
    const {orders, receiveAmount} = state;
    const {sellAssetPrecision, receiveAssetPrecision} = getAssetsDetails(
        state
    );
    if (orders.length === 1) {
        const sellAmount = ((receiveAmount as any) / orders[0].order.getPrice()).toFixed(
            sellAssetPrecision
        );
        mergeState({sellAmount});
        return;
    }
    if (orders.length > 1) {
        const lastOrder = orders.slice(-1)[0];
        const penultimateOrder = orders.slice(
            orders.length - 2,
            orders.length - 1
        )[0];
        const lastOrderToReceive =
            (receiveAmount as any) * 10 ** receiveAssetPrecision -
            penultimateOrder.order.total_for_sale.getAmount();
        const lastOrderForSale =
            ((lastOrderToReceive / lastOrder.order.getPrice()) *
                10 ** sellAssetPrecision) /
            10 ** receiveAssetPrecision;
        const sellAmount = (
            (penultimateOrder.order.total_to_receive.getAmount() +
                lastOrderForSale) /
            10 ** sellAssetPrecision
        ).toFixed(sellAssetPrecision);
        mergeState({sellAmount});
        return;
    }
}

function updateReceiveAmount(
    state: QuickTradeState,
    mergeState: (patch: Partial<QuickTradeState>) => void
) {
    const {orders, sellAmount} = state;
    const {sellAssetPrecision, receiveAssetPrecision} = getAssetsDetails(
        state
    );
    if (orders.length === 1) {
        const receiveAmount = (
            orders[0].order.getPrice() * (sellAmount as any)
        ).toFixed(receiveAssetPrecision);
        mergeState({receiveAmount});
        return;
    }

    if (orders.length > 1) {
        const lastOrder = orders.slice(-1)[0];
        const penultimateOrder = orders.slice(
            orders.length - 2,
            orders.length - 1
        )[0];
        const lastOrderForSale =
            (sellAmount as any) * 10 ** sellAssetPrecision -
            penultimateOrder.order.total_to_receive.getAmount();
        const lastOrderToReceive =
            (lastOrderForSale *
                lastOrder.order.getPrice() *
                10 ** receiveAssetPrecision) /
            10 ** sellAssetPrecision;
        const receiveAmount = (
            (penultimateOrder.order.total_for_sale.getAmount() +
                lastOrderToReceive) /
            10 ** receiveAssetPrecision
        ).toFixed(receiveAssetPrecision);
        mergeState({receiveAmount});
        return;
    }
}

function runGetOrders(
    state: QuickTradeState,
    props: QuickTradeProps,
    mergeState: (patch: Partial<QuickTradeState>) => void
) {
    if (!state.isSubscribedToMarket) {
        console.log(props.marketData);
        // if the user wants to inspect current orders, pause updating
        return;
    }
    const {combinedBids} = props.marketData;
    const {sellAsset, receiveAsset, sellAmount, receiveAmount, activeInput} = state;
    const {sellAssetPrecision, receiveAssetPrecision} = getAssetsDetails(
        state
    );
    if (__DEV__) {
        console.log("_getOrders", props.marketData);
    }
    if (combinedBids && combinedBids.length) {
        if (sellAsset && receiveAsset) {
            switch (activeInput) {
                case "receiveAsset":
                    if (sellAmount) {
                        const orders = getOrders(
                            (sellAmount as any) * 10 ** sellAssetPrecision,
                            combinedBids,
                            "sell"
                        );
                        mergeState({orders, ordersUpdated: new Date()});
                        updateReceiveAmount({...state, orders}, mergeState);
                    }
                    break;
                case "sellAsset":
                    if (receiveAmount) {
                        const orders = getOrders(
                            (receiveAmount as any) * 10 ** receiveAssetPrecision,
                            combinedBids,
                            "receive"
                        );
                        mergeState({orders, ordersUpdated: new Date()});
                        updateSellAmount({...state, orders}, mergeState);
                    }
                    break;
                case "sell":
                    if (sellAmount) {
                        const orders = getOrders(
                            (sellAmount as any) * 10 ** sellAssetPrecision,
                            combinedBids,
                            "sell"
                        );
                        mergeState({orders, ordersUpdated: new Date()});
                        updateReceiveAmount({...state, orders}, mergeState);
                    } else {
                        mergeState({
                            orders: [],
                            receiveAmount: ""
                        });
                    }
                    break;
                case "receive":
                    if (receiveAmount) {
                        const orders = getOrders(
                            (receiveAmount as any) * 10 ** receiveAssetPrecision,
                            combinedBids,
                            "receive"
                        );
                        mergeState({orders, ordersUpdated: new Date()});
                        updateSellAmount({...state, orders}, mergeState);
                    } else {
                        mergeState({
                            orders: [],
                            sellAmount: ""
                        });
                    }
                    break;
            }
        }
    }
}

function QuickTradeCore(props: QuickTradeProps) {
    const [state, setState] = React.useState<QuickTradeState>(() =>
        getInitialState(props.currentAccount)
    );
    const mergeState = (patch: Partial<QuickTradeState>) =>
        setState(prev => ({...prev, ...patch}));

    // `getDerivedStateFromProps` equivalent - see file header. Mutates
    // the `useState`-held object in place, unconditionally, on every
    // render, before it's read for anything else.
    if (props.assetToSell) {
        Object.assign(state, {
            sellAssetInput: props.assetToSell.get("id"),
            sellAsset: props.assetToSell,
            sellImgName: props.assetToSell.get("symbol")
        });
    }
    if (props.assetToReceive) {
        Object.assign(state, {
            receiveAssetInput: props.assetToReceive.get("id"),
            receiveAsset: props.assetToReceive,
            receiveImgName: props.assetToReceive.get("symbol")
        });
    }

    const stateRef = React.useRef(state);
    stateRef.current = state;
    const propsRef = React.useRef(props);
    propsRef.current = props;

    const timerRef = React.useRef<any>(null);
    const intervalIdRef = React.useRef<any>(null);
    const getAssetListRef = React.useRef<any>(null);
    if (!getAssetListRef.current) {
        getAssetListRef.current = debounce(
            (AssetActions as any).getAssetList.defer,
            150
        );
    }

    const subToMarket = async () => {
        const {
            receiveAsset: baseAsset,
            sellAsset: quoteAsset,
            sub
        } = stateRef.current;
        if (baseAsset && quoteAsset) {
            const {
                receiveAssetId: baseAssetId,
                sellAssetId: quoteAssetId
            } = getAssetsDetails(stateRef.current);
            if (sub) {
                const [qa, ba] = sub.split("_");
                if (qa === quoteAssetId && ba === baseAssetId) {
                    return;
                }
                await MarketsActions.unSubscribeMarket(qa, ba);
            }
            await MarketsActions.subscribeMarket(baseAsset, quoteAsset, 3600, 0);
            mergeState({sub: `${quoteAssetId}_${baseAssetId}`});
            getAllPrices(propsRef.current, mergeState);
            getAllFees(propsRef.current, stateRef.current, mergeState);
        }
    };

    const assetsHaveChanged = () => {
        subToMarket();
    };

    const checkAndUpdateMarketList = (marketsList: any[]) => {
        let receiveAssets = marketsList.map(asset => asset.id);
        if (intervalIdRef.current) clearInterval(intervalIdRef.current);
        const {receiveAssetInput} = stateRef.current;
        let asset = "";
        if (ChainStore.getAsset(receiveAssetInput)) {
            const assetId = ChainStore.getAsset(receiveAssetInput).get("id");
            if (receiveAssets.includes(assetId)) {
                asset = ChainStore.getAsset(receiveAssetInput).get("id");
            }
        }
        if (receiveAssets.length === 1) {
            asset = receiveAssets[0];
            receiveAssets = getAssetsToSell(propsRef.current.currentAccount);
            receiveAssets.push(asset);
        }
        if (receiveAssets.length === 0) {
            receiveAssets = getAssetsToSell(propsRef.current.currentAccount);
        }

        intervalIdRef.current = setInterval(() => {
            clearInterval(intervalIdRef.current);
            mergeState({
                receiveAssets,
                activeSearch: false
            });
            subToMarket();
        }, 100);
    };

    const setSellAsset = async (
        assetObjectIdOrSymbol: any,
        activeInput = "sellAsset"
    ) => {
        let asset: any = null;
        if (typeof assetObjectIdOrSymbol === "string") {
            asset = await FetchChain("getAsset", assetObjectIdOrSymbol);
        } else {
            asset = assetObjectIdOrSymbol;
        }
        if (__DEV__) {
            console.log("_setSellAsset", assetObjectIdOrSymbol, asset);
        }
        mergeState({activeInput});
        routeTo(
            propsRef.current,
            asset.get("symbol"),
            !!propsRef.current.assetToReceive
                ? propsRef.current.assetToReceive.get("symbol")
                : ""
        );
    };

    const setReceiveAsset = async (
        assetObjectIdOrSymbol: any,
        activeInput = "receiveAsset"
    ) => {
        let asset: any = null;
        if (typeof assetObjectIdOrSymbol === "string") {
            asset = await FetchChain("getAsset", assetObjectIdOrSymbol);
        } else {
            asset = assetObjectIdOrSymbol;
        }
        if (__DEV__) {
            console.log("_setReceiveAsset", assetObjectIdOrSymbol, asset);
        }
        mergeState({activeInput});
        routeTo(
            propsRef.current,
            !!propsRef.current.assetToSell
                ? propsRef.current.assetToSell.get("symbol")
                : "",
            asset.get("symbol")
        );
    };

    const swapAssets = (activeInput: string) => {
        const s = stateRef.current;
        mergeState({
            sellAmount: activeInput === "sellAsset" ? "" : s.receiveAmount,
            receiveAmount: activeInput === "receiveAsset" ? "" : s.sellAmount,
            activeInput
        });
        routeTo(
            propsRef.current,
            s.receiveAsset.get("symbol"),
            s.sellAsset.get("symbol")
        );
    };

    const onSellAssetInputChange = (assetIdOrSymbol: any) => {
        const {receiveAssetId} = getAssetsDetails(stateRef.current);
        if (assetIdOrSymbol === receiveAssetId) {
            swapAssets("sellAsset");
        } else {
            setSellAsset(assetIdOrSymbol);
        }
    };

    const onReceiveAssetInputChange = (assetIdOrSymbol: any) => {
        const {sellAssetId} = getAssetsDetails(stateRef.current);
        if (assetIdOrSymbol === sellAssetId) {
            swapAssets("receiveAsset");
        } else {
            setReceiveAsset(assetIdOrSymbol);
        }
    };

    const onReceiveAssetSearch = (e: any) => {
        if (!stateRef.current.mounted) return;
        const isValidName = !ChainValidation.is_valid_symbol_error(e, true);
        if (!isValidName) {
            /* Don't lookup invalid asset names */
            mergeState({
                receiveAsset: null,
                receiveAssetInput: e,
                activeSearch: false
            });
            return;
        }

        if (stateRef.current.receiveAssetInput !== e) {
            if (timerRef.current) clearTimeout(timerRef.current);
        }

        timerRef.current = setTimeout(() => {
            lookupAssets(e, true, getAssetListRef.current, mergeState);
        }, 100);
    };

    const onSellAmountChange = (e: any) => {
        if (!stateRef.current.mounted) return;
        if (e.asset !== stateRef.current.sellAssetInput) {
            onSellAssetInputChange(e.asset);
        }
        const nextState: QuickTradeState = {
            ...stateRef.current,
            sellAmount: e.amount,
            activeInput: "sell",
            activeAmountInput: "sell"
        };
        mergeState(nextState);
        runGetOrders(nextState, propsRef.current, mergeState);
    };

    const onReceiveAmountChange = (e: any) => {
        if (!stateRef.current.mounted) return;
        if (e.asset !== stateRef.current.receiveAssetInput) {
            onReceiveAssetInputChange(e.asset);
        }
        const nextState: QuickTradeState = {
            ...stateRef.current,
            receiveAmount: e.amount,
            activeInput: "receive",
            activeAmountInput: "receive"
        };
        mergeState(nextState);
        runGetOrders(nextState, propsRef.current, mergeState);
    };

    const onSwap = () => {
        if (areAssetsGiven(propsRef.current)) {
            swapAssets("neither");
        }
    };

    const handleSubscriptionToggleChange = () => {
        mergeState({isSubscribedToMarket: !stateRef.current.isSubscribedToMarket});
    };

    // Name kept exactly as in the original (a pre-existing, purely
    // internal typo - never exposed via any ref/external API).
    const hendleOrderView = () => {
        const orderView =
            stateRef.current.orderView === "amount" ? "total" : "amount";
        mergeState({orderView});
    };

    const handleSell = () => {
        const {currentAccount} = propsRef.current;
        const {sellAmount, receiveAmount} = stateRef.current;
        const {
            sellAssetId,
            receiveAssetId,
            sellAssetPrecision,
            receiveAssetPrecision
        } = getAssetsDetails(stateRef.current);
        const forSale = new Asset({
            asset_id: sellAssetId,
            precision: sellAssetPrecision,
            amount: (sellAmount as any) * 10 ** sellAssetPrecision
        });
        const toReceive = new Asset({
            asset_id: receiveAssetId,
            precision: receiveAssetPrecision,
            amount: (receiveAmount as any) * 10 ** receiveAssetPrecision
        });
        const expirationTime = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);

        const order = new LimitOrderCreate({
            for_sale: forSale,
            expiration: expirationTime,
            to_receive: toReceive,
            seller: currentAccount.get("id"),
            fee: {
                asset_id: "1.3.0",
                amount: 0
            },
            fill_or_kill: true
        });

        return MarketsActions.createLimitOrder2(order)
            .then((result: any) => {
                if (result.error) {
                    if (result.error.message !== "wallet locked")
                        Notification.error({
                            message: counterpart.translate(
                                "notifications.exchange_unknown_error_place_order",
                                {
                                    amount: receiveAmount,
                                    symbol: receiveAssetId
                                }
                            )
                        });
                }
            })
            .catch((e: any) => {
                console.error("order failed:", e);
            });
    };

    // componentDidMount
    React.useEffect(() => {
        mergeState({mounted: true});
        if (areAssetsGiven(propsRef.current)) {
            assetsHaveChanged();
        }
    }, []);

    // componentWillUnmount
    React.useEffect(() => {
        return () => {
            const {sub} = stateRef.current;
            const {sellAssetId, receiveAssetId} = getAssetsDetails(
                stateRef.current
            );
            if (sub) {
                MarketsActions.unSubscribeMarket(sellAssetId, receiveAssetId);
            }
        };
    }, []);

    // componentDidUpdate(prevProps) - runs after every render except the
    // first (mount), comparing against a ref holding the previous
    // render's relevant prop values.
    const isFirstUpdateRef = React.useRef(true);
    const prevForUpdateRef = React.useRef<{
        assetToSell: any;
        assetToReceive: any;
        marketData: any;
        searchAssets: any;
        currentAccount: any;
    }>({
        assetToSell: props.assetToSell,
        assetToReceive: props.assetToReceive,
        marketData: props.marketData,
        searchAssets: props.searchAssets,
        currentAccount: props.currentAccount
    });
    React.useEffect(() => {
        if (isFirstUpdateRef.current) {
            isFirstUpdateRef.current = false;
            prevForUpdateRef.current = {
                assetToSell: props.assetToSell,
                assetToReceive: props.assetToReceive,
                marketData: props.marketData,
                searchAssets: props.searchAssets,
                currentAccount: props.currentAccount
            };
            return;
        }
        const prev = prevForUpdateRef.current;

        if (
            haveAssetsChanged(props, {
                assetToSell: prev.assetToSell,
                assetToReceive: prev.assetToReceive
            })
        ) {
            assetsHaveChanged();
        } else {
            if (hasMarketChanged(props, {marketData: prev.marketData})) {
                runGetOrders(stateRef.current, props, mergeState);
            }
        }

        if (props.searchAssets !== prev.searchAssets) {
            mergeState({activeSearch: true});
            const filteredAssets = props.searchAssets
                .valueSeq()
                .toArray()
                .filter(
                    (a: any) =>
                        a.symbol.indexOf(stateRef.current.lookupQuote) !== -1
                );
            checkAndUpdateMarketList(filteredAssets);
        }

        if (props.currentAccount !== prev.currentAccount) {
            const assets = getAssetsToSell(props.currentAccount);
            mergeState({
                sellAssets: assets,
                receiveAssets: assets
            });
        }

        prevForUpdateRef.current = {
            assetToSell: props.assetToSell,
            assetToReceive: props.assetToReceive,
            marketData: props.marketData,
            searchAssets: props.searchAssets,
            currentAccount: props.currentAccount
        };
    });

    function isSwappable() {
        return areAssetsGiven(props);
    }

    function getTransactionFee(denominationAssetId?: any) {
        const {fees, prices} = state;
        const {sellAssetId} = getAssetsDetails(state);
        if (fees) {
            if (fees.transactionFee[sellAssetId]) {
                if (
                    !denominationAssetId ||
                    denominationAssetId === sellAssetId
                ) {
                    return (
                        fees.transactionFee[sellAssetId].fee.amount /
                        10 ** fees.transactionFee[sellAssetId].fee.precision
                    );
                } else {
                    return (
                        (fees.transactionFee[sellAssetId].fee.amount /
                            10 **
                                fees.transactionFee[sellAssetId].fee
                                    .precision) *
                        prices.latestPrice
                    );
                }
            } else {
                return 0;
            }
        } else {
            return 0;
        }
    }

    function getMarketFee(denomindatedAssetId?: any) {
        const {fees, prices, receiveAmount} = state;
        const {receiveAssetId} = getAssetsDetails(state);
        if (fees) {
            if (
                !denomindatedAssetId ||
                denomindatedAssetId === receiveAssetId
            ) {
                return (fees.marketFee.baseMarketFee * (receiveAmount as any)) / 10000;
            } else {
                return (
                    (fees.marketFee.baseMarketFee * (receiveAmount as any)) /
                    prices.latestPrice /
                    10000
                );
            }
        } else {
            return 0;
        }
    }

    function getFeePercent(feeAmount: any, totalAmount: any) {
        return +totalAmount ? (+totalAmount + +feeAmount) / totalAmount - 1 : 0;
    }

    function getLiquidityPenalty() {
        const {prices, sellAmount, receiveAmount} = state;
        const price = (receiveAmount as any) / (sellAmount as any);
        const marketPrice = prices.latestPrice;
        const feedPrice = prices.feedPrice;
        let liquidityFee1, liquidityFee2;
        if (price && marketPrice) {
            liquidityFee1 = Math.max(
                1 - price / marketPrice,
                1 - marketPrice / price
            );
        }
        if (price && feedPrice) {
            liquidityFee2 = Math.max(
                1 - price / feedPrice,
                1 - feedPrice / price
            );
        }
        return [liquidityFee1, liquidityFee2];
    }

    function getTotalPercentFee() {
        const {sellAmount, receiveAmount} = state;
        const transactionFeePercent = getFeePercent(
            getTransactionFee(undefined),
            sellAmount
        );
        const marketFeePercent = getFeePercent(
            getMarketFee(undefined),
            receiveAmount
        );
        // `liquidityFee` can genuinely be `undefined` here (see
        // `getLiquidityPenalty`'s own un-set-when-no-price branches) -
        // the original added it in unconditionally, which can yield
        // `NaN`; preserved verbatim (see file header), so this is cast
        // through `any` only to satisfy strict-null-checks, not to
        // change the arithmetic.
        const liquidityFee: any = getLiquidityPenalty()[0];
        return transactionFeePercent + marketFeePercent + liquidityFee;
    }

    function showFeedPrice() {
        const {sellAsset, receiveAsset} = state;
        const {sellAssetId, receiveAssetId} = getAssetsDetails(state);
        const receiveCollateralAsset = receiveAsset.getIn([
            "bitasset",
            "options",
            "short_backing_asset"
        ]);
        const sellCollateralAsset = sellAsset.getIn([
            "bitasset",
            "options",
            "short_backing_asset"
        ]);
        return (
            receiveCollateralAsset === sellAssetId ||
            sellCollateralAsset === receiveAssetId
        );
    }

    function getPriceSection() {
        const {prices, sellAmount, receiveAmount} = state;
        const {
            sellAssetId,
            receiveAssetId,
            sellAssetPrecision,
            receiveAssetPrecision,
            receiveAssetSymbol
        } = getAssetsDetails(state);
        return (
            <Row>
                <Col span={12}>
                    <div>
                        {counterpart.translate(
                            "exchange.quick_trade_details.your_price"
                        )}
                    </div>
                    {showFeedPrice() && (
                        <div>
                            {counterpart.translate(
                                "exchange.quick_trade_details.feed_price"
                            )}
                        </div>
                    )}
                    <div>
                        {counterpart.translate(
                            "exchange.quick_trade_details.last_price"
                        )}
                    </div>
                </Col>
                <Col span={12} style={{textAlign: "right"}}>
                    <div>
                        <FormattedPrice
                            base_asset={sellAssetId}
                            quote_asset={receiveAssetId}
                            base_amount={(sellAmount as any) * 10 ** sellAssetPrecision}
                            quote_amount={
                                (receiveAmount as any) * 10 ** receiveAssetPrecision
                            }
                            noPopOver
                            force_direction={receiveAssetSymbol}
                            noInvertTip
                        />
                    </div>
                    {showFeedPrice() && (
                        <div>
                            <FormattedPrice
                                base_asset={sellAssetId}
                                quote_asset={receiveAssetId}
                                base_amount={1 * 10 ** sellAssetPrecision}
                                quote_amount={
                                    prices.feedPrice *
                                    10 ** receiveAssetPrecision
                                }
                                noPopOver
                                force_direction={receiveAssetSymbol}
                                noInvertTip
                            />
                        </div>
                    )}
                    <div>
                        <FormattedPrice
                            base_asset={sellAssetId}
                            quote_asset={receiveAssetId}
                            base_amount={1 * 10 ** sellAssetPrecision}
                            quote_amount={
                                prices.latestPrice * 10 ** receiveAssetPrecision
                            }
                            noPopOver
                            force_direction={receiveAssetSymbol}
                            noInvertTip
                        />
                    </div>
                </Col>
            </Row>
        );
    }

    function getFeeSection() {
        const {sellAmount, receiveAmount} = state;
        const {
            sellAssetPrecision,
            receiveAssetPrecision,
            sellAssetSymbol,
            receiveAssetSymbol
        } = getAssetsDetails(state);

        const transactionFee = getTransactionFee(undefined).toFixed(
            sellAssetPrecision
        );
        const transactionFeePercent = (
            getFeePercent(getTransactionFee(undefined), sellAmount) * 100
        ).toFixed(2);
        const marketFee = getMarketFee(undefined).toFixed(receiveAssetPrecision);
        const marketFeePercent = (
            getFeePercent(getMarketFee(undefined), receiveAmount) * 100
        ).toFixed(2);

        const [liqidityPenaltyMarket, liqidityPenaltyFeed] = getLiquidityPenalty();
        let liqidityPenaltyMarketDisplay: string;
        let liqidityPenaltyFeedDisplay: string;
        if (liqidityPenaltyMarket || liqidityPenaltyMarket === 0) {
            liqidityPenaltyMarketDisplay =
                (liqidityPenaltyMarket * 100).toFixed(2) + "%";
        } else {
            liqidityPenaltyMarketDisplay = "-";
        }
        if (liqidityPenaltyFeed || liqidityPenaltyFeed === 0) {
            liqidityPenaltyFeedDisplay = (liqidityPenaltyFeed * 100).toFixed(2) + "%";
        } else {
            liqidityPenaltyFeedDisplay = "-";
        }
        const liqidityPenalty = showFeedPrice()
            ? `${liqidityPenaltyMarketDisplay} / ${liqidityPenaltyFeedDisplay}`
            : liqidityPenaltyMarketDisplay;

        return (
            <Row>
                <Col span={12}>
                    <div>
                        {counterpart.translate(
                            "exchange.quick_trade_details.liquidity_penalty"
                        )}
                    </div>
                    <div>
                        {counterpart.translate(
                            "exchange.quick_trade_details.market_fee"
                        )}
                        {` ${marketFeePercent}%`}
                    </div>
                    <div>
                        {counterpart.translate(
                            "exchange.quick_trade_details.transaction_fee"
                        )}
                        {` ${transactionFeePercent}%`}
                    </div>
                </Col>
                <Col span={12} style={{textAlign: "right"}}>
                    <div>{liqidityPenalty}</div>
                    <div>
                        {marketFee}
                        &nbsp;
                        <AssetName name={receiveAssetSymbol} noTip />
                    </div>
                    <div>
                        {transactionFee}
                        &nbsp;
                        <AssetName name={sellAssetSymbol} noTip />
                    </div>
                </Col>
            </Row>
        );
    }

    function getOrdersSection() {
        const {orders, orderView} = state;
        const {
            sellAssetId,
            receiveAssetId,
            sellAssetPrecision,
            sellAssetSymbol,
            receiveAssetSymbol
        } = getAssetsDetails(state);
        const dataSource = orders.map(item => {
            return {
                key: item.order.id,
                id: item.order.id,
                seller: <LinkToAccountById account={item.order.seller} />,
                amount: (
                    <div onClick={hendleOrderView}>
                        {orderView === "amount"
                            ? item.amount / 10 ** sellAssetPrecision
                            : item.total_amount / 10 ** sellAssetPrecision}
                    </div>
                ),
                price: item.price
            };
        });

        const amount = (
            <span>
                {orderView === "amount"
                    ? counterpart.translate(
                          "exchange.quick_trade_details.amount"
                      )
                    : counterpart.translate(
                          "exchange.quick_trade_details.total"
                      )}
                &nbsp;(
                <AssetName name={sellAssetSymbol} noTip />)
            </span>
        );

        const price = (
            <span>
                {counterpart.translate("exchange.quick_trade_details.price")}
                &nbsp;(
                <FormattedPrice
                    base_asset={sellAssetId}
                    quote_asset={receiveAssetId}
                    noPopOver
                    force_direction={receiveAssetSymbol}
                    noInvertTip
                    hide_value
                />
                )
            </span>
        );

        const columns = [
            {
                title: counterpart.translate("exchange.quick_trade_details.id"),
                dataIndex: "id",
                key: "id",
                width: "20%"
            },
            {
                title: counterpart.translate(
                    "exchange.quick_trade_details.seller"
                ),
                dataIndex: "seller",
                key: "seller",
                width: "20%"
            },
            {
                title: amount,
                dataIndex: "amount",
                key: "amount",
                width: "30%"
            },
            {
                title: price,
                dataIndex: "price",
                key: "price"
            }
        ];
        return (
            <div>
                <Switch
                    style={{marginLeft: "0px"}}
                    onChange={handleSubscriptionToggleChange}
                    checked={state.isSubscribedToMarket}
                />
                {state.ordersUpdated && (
                    <div style={{float: "right"}}>
                        {counterpart.localize(state.ordersUpdated as any)}
                    </div>
                )}
                <Translate
                    onClick={handleSubscriptionToggleChange}
                    content="exchange.quick_trade_details.subscribe_to_market"
                    style={{
                        marginLeft: "10px",
                        cursor: "pointer"
                    }}
                />
                <Table
                    columns={columns}
                    dataSource={dataSource}
                    style={{width: "100%", marginTop: "10px"}}
                    pagination={
                        dataSource.length > 5
                            ? {
                                  pageSize: 5
                              }
                            : false
                    }
                />
            </div>
        );
    }

    function getDetails() {
        const {sub} = state;
        if (!sub) {
            return null;
        }
        const {sellAmount, receiveAmount} = state;
        const {
            sellAssetId,
            receiveAssetId,
            sellAssetPrecision,
            receiveAssetPrecision,
            receiveAssetSymbol
        } = getAssetsDetails(state);
        const priceSection = getPriceSection();
        const priceExtra = (
            <React.Fragment>
                {counterpart.translate(
                    "exchange.quick_trade_details.effective"
                )}{" "}
                <FormattedPrice
                    base_asset={sellAssetId}
                    quote_asset={receiveAssetId}
                    base_amount={(sellAmount as any) * 10 ** sellAssetPrecision}
                    quote_amount={(receiveAmount as any) * 10 ** receiveAssetPrecision}
                    noPopOver
                    force_direction={receiveAssetSymbol}
                    noInvertTip
                />
            </React.Fragment>
        );
        const feeSection = getFeeSection();
        const ordersSection = getOrdersSection();
        const totalPercentFee =
            counterpart.translate("exchange.quick_trade_details.effective") +
            " " +
            (getTotalPercentFee() * 100).toFixed(2);
        const amountOfOrders = state.orders.length;
        const ordersCaption =
            amountOfOrders < 2
                ? counterpart.translate("exchange.quick_trade_details.order")
                : counterpart.translate("exchange.quick_trade_details.orders");
        return (
            <Collapse
                className="asset-collapse"
                style={{
                    marginTop: "1rem"
                }}
            >
                <Collapse.Panel
                    header={counterpart.translate("exchange.price")}
                    extra={priceExtra}
                >
                    {priceSection}
                </Collapse.Panel>
                <Collapse.Panel
                    header={counterpart.translate("exchange.fee")}
                    extra={`${totalPercentFee}%`}
                >
                    {feeSection}
                </Collapse.Panel>
                <Collapse.Panel
                    header={counterpart.translate("exchange.orders")}
                    extra={
                        amountOfOrders
                            ? `${amountOfOrders} ${ordersCaption}`
                            : "no orders"
                    }
                >
                    {ordersSection}
                </Collapse.Panel>
            </Collapse>
        );
    }

    function showDetails() {
        const {sellAsset, receiveAsset, sellAmount, receiveAmount} = state;
        return !!(
            sellAsset &&
            receiveAsset &&
            +sellAmount &&
            +receiveAmount
        );
    }

    function hasBalance() {
        const {sellAmount} = state;
        const {currentAccount} = props;
        const accountBalances = currentAccount.get("balances").toJS();
        const {sellAssetId, sellAssetPrecision} = getAssetsDetails(state);
        if (!accountBalances[sellAssetId]) {
            return false;
        }
        const balance = ChainStore.getObject(accountBalances[sellAssetId]).get(
            "balance"
        );
        const transactionFee = getTransactionFee(undefined);
        return (
            (sellAmount as any) * 10 ** sellAssetPrecision +
                transactionFee * 10 ** sellAssetPrecision <
            +balance
        );
    }

    const {
        sellAssetInput,
        sellAssets,
        sellAmount,
        sellImgName,
        receiveAssetInput,
        receiveAssets,
        receiveAmount,
        receiveImgName,
        sub
    } = state;
    const {sellAssetId, receiveAssetId} = getAssetsDetails(state);

    const Details = showDetails() ? getDetails() : null;

    return (
        <Card
            className="quick-trade"
            style={{
                display: "flex",
                justifyContent: "center",
                minWidth: "300px",
                marginTop: "1rem"
            }}
        >
            <SellReceive
                sellAssetInput={sellAssetInput}
                sellAsset={sellAssetId}
                sellAssets={sellAssets}
                sellAmount={sellAmount}
                sellImgName={sellImgName}
                onSellAssetInputChange={onSellAssetInputChange}
                onSellAmountChange={onSellAmountChange}
                receiveAssetInput={receiveAssetInput}
                receiveAsset={receiveAssetId}
                receiveAssets={receiveAssets}
                receiveAmount={receiveAmount}
                receiveImgName={receiveImgName}
                onReceiveAssetInputChange={onReceiveAssetInputChange}
                onReceiveAmountChange={onReceiveAmountChange}
                onReceiveAssetSearch={onReceiveAssetSearch}
                onSwap={onSwap}
                isSwappable={isSwappable()}
            />
            {Details}
            <div
                style={{
                    marginTop: "1rem",
                    textAlign: "center"
                }}
            >
                <Tooltip
                    title={
                        !hasBalance()
                            ? counterpart.translate("exchange.no_balance")
                            : null
                    }
                >
                    <Button
                        key="sell"
                        type="primary"
                        disabled={!showDetails() || !sub || !hasBalance()}
                        onClick={handleSell}
                    >
                        {counterpart.translate("exchange.sell")}
                    </Button>
                </Tooltip>
            </div>
        </Card>
    );
}

function QuickTradeStoreConnected(props: QuickTradeProps) {
    const assetState = useAltStore<any>(AssetStore as any);
    const marketsState = useAltStore<any>(MarketsStore as any);
    return (
        <QuickTradeCore
            {...props}
            searchAssets={assetState.assets}
            assetsLoading={assetState.assetsLoading}
            marketData={marketsState.marketData}
            activeMarketHistory={marketsState.activeMarketHistory}
            bucketSize={marketsState.bucketSize}
            currentGroupOrderLimit={marketsState.currentGroupOrderLimit}
            feedPrice={marketsState.feedPrice}
            marketLimitOrders={marketsState.marketLimitOrders}
        />
    );
}

export default bindToCurrentAccount(QuickTradeStoreConnected) as React.ComponentType<any>;
