// TypeScript/functional-component port of the legacy Exchange.jsx
// (Phase 4, docs/UI_MIGRATION_PLAN.md) - the Exchange screen's root
// component: orchestrates every already-ported Exchange satellite
// (BuySell, ScaledOrderTab, OrderBook, MyMarkets, MarketHistory,
// MyOpenOrders/MarketOrders, MarketPicker, ExchangeHeader, Personalize,
// PriceAlert, ConfirmOrderModal, DepthHighChart) and owns the real
// order-submission logic (_createLimitOrder/_createLimitOrderConfirm/
// _createPredictionShort/_forceBuy/_forceSell, all still present here
// under their same names as plain functions). Security-sensitive per
// AGENTS.md: this file is where user-entered price/amount/total state
// becomes a real LimitOrderCreate/MarketsActions.createLimitOrder2 call,
// so the bid/ask order-state mutation helpers and the submit pipeline
// were translated with particular care and cross-checked against the
// original line-by-line, not just skimmed.
//
// Confirmed dead, dropped:
// - `state.favorite` (initialized `false`, never read or set again
//   anywhere in the class).
// - `state.showMarketPicker` (set by `_toggleMarketPicker`, never read -
//   only its sibling `marketPickerAsset`, set by the same method, is
//   actually read anywhere).
// - `state.history` (`[]`, initialized, never read or set again -
//   distinct from the `history` *prop*, which is real and still used for
//   routing elsewhere, and from `activeMarketHistory`/`myHistory`, the
//   real order-history data).
// - `state.panelWidth` (initial `0`): destructured from state at the top
//   of `render()`, but the *local* `panelWidth` variable of the same
//   name is unconditionally reassigned (`panelWidth = 350;`, then
//   possibly overridden from the order book's live scroll width) before
//   it is ever read anywhere - so the actual state value was always
//   shadowed before use. Never `setState`-assigned anywhere either.
//   Kept as a plain local, computed fresh each render.
// - `state.isDepositBridgeModelLoaded` (note "Model", not "Modal" - a
//   typo): initialized, never read or set again anywhere - a dead
//   sibling of the correctly-spelled, real `isDepositBridgeModalLoaded`.
// - `state.isScaledOrderModalVisible` and the `showScaledOrderModal`/
//   `hideScaledOrderModal` methods: the state is set in three places but
//   never read anywhere in `render()` (confirmed via a whole-file grep -
//   the same finding that led to deleting the orphaned
//   `Exchange/ScaledOrder.jsx` modal earlier in this phase), and the
//   `showScaledOrderModal` prop passed down to `<BuySell>` is confirmed
//   unread inside `BuySell.tsx`/the original `BuySell.jsx` too (checked
//   both). The whole mechanism is a dead end superseded by
//   `ScaledOrderTab.jsx`.
// - `_toggleMiniChart()`: defined, never called from anywhere.
// - The `description`/`assetUtils.parseDescription(...)` computation
//   gated behind `hasPrediction`: computed and then never read anywhere
//   else in `render()` - dropped along with the now-unused `assetUtils`
//   import.
// - `_changeZoomPeriod`, `_toggleOpenBuySell`/`onToggleOpen`, and
//   `_clearForms`/`clearForm`: all three are defined and (the latter two)
//   passed down to `<BuySell>`, but `_changeZoomPeriod` is never called
//   from anywhere, and `onToggleOpen`/`clearForm` are confirmed unread
//   inside `BuySell.tsx` (not part of its `BuySellProps`) - dropped on
//   both ends, since this slice doesn't touch a still-legacy caller.
//   `buySellOpen` state itself stays (still read via `isOpen`).
// - `location`/`history` props: only ever forwarded to `<MyMarkets>`,
//   already confirmed dead there during the `MyMarkets.tsx` slice - no
//   longer even destructured.
// - `isMarketFrozen()`'s `frozenAsset` return field: only `isFrozen` is
//   ever read from its result: the function itself stays (used for the
//   real `isFrozen` gate), just its second field isn't destructured.
// - The `ref="deposit_modal"`/`ref="bridge_modal"` string refs on the
//   deposit/bridge modals: assigned, never read anywhere.
// - `UNSAFE_componentWillMount`'s `window.addEventListener("resize",
//   this._setDimensions, ...)`: `this._setDimensions` is never defined
//   anywhere in the class - referencing it yields `undefined`, and
//   `addEventListener` with a non-function listener is specified to be a
//   silent no-op, so this listener registration never did anything (no
//   matching `removeEventListener` exists for it either). The real
//   resize handling is `_getWindowSize`, correctly registered in
//   `componentDidMount` and unregistered in `componentWillUnmount`.
// - `_forceRender`/`state.forceReRender`: this SCU-embedded mechanism
//   existed purely to force React to notice *state*-driven changes
//   (`activePanels`/`verticalOrderBook`) that the rest of the original
//   `shouldComponentUpdate` might otherwise miss, on top of a *props*
//   change (`quoteAsset`/`baseAsset`) already covered by that same SCU's
//   own shallow-prop-diff loop. `forceReRender` itself is never read in
//   `render()`. In this port, state changes always re-render their own
//   function component regardless of any memo comparator (the same
//   principle already applied throughout this migration), so once the
//   memo comparator below faithfully reproduces the *real* SCU gate (see
//   next note), this whole forcing mechanism has nothing left to do and
//   is dropped rather than translated.
//
// Structural changes:
// - The real `shouldComponentUpdate` is, underneath its verbose form,
//   two things: (a) a genuine early-out - block re-rendering only while
//   `marketReady` is `false` on *both* the old and new props (waiting
//   for the market to finish loading) - and (b) an exhaustive shallow
//   diff over every prop key, re-rendering if *any* of them differs. Its
//   two state-shaped checks (`ns.panelTabsActive` diffing and the
//   trailing `!are_equal_shallow(ns, this.state)`) are both subsumed by
//   hooks' own state-change-always-re-renders behavior and need no
//   replication (established pattern throughout this migration).
//   Preserved via `React.memo` with a comparator implementing exactly
//   (a) and (b).
// - `shouldComponentUpdate` also ran an inline `setState` when
//   `quoteAsset`/`baseAsset` changed by *reference* (not full identity -
//   normalizes `expirationType` so a non-"SPECIFIC" choice resets to
//   "YEAR" on every such tick) - this is real, observable behavior
//   (`expirationType` is otherwise never touched in response to asset
//   changes elsewhere), replicated as a `[quoteAsset, baseAsset]`-keyed,
//   mount-skipped effect using `setExpirationType`.
// - `UNSAFE_componentWillReceiveProps` ran two independent, order-
//   independent checks: (1) `quoteAsset`/`baseAsset`/`currentAccount`
//   reference change -> re-run `_checkFeeStatus`; (2) `quoteAsset`/
//   `baseAsset` *symbol* change (a strict subset of (1), implying the
//   market actually switched) -> a full state reset via `_initialState`
//   plus a `changeViewSetting` dispatch for the "last market" setting.
//   Note `_initialState()` does *not* touch `feeStatus` (that's only
//   ever set by the constructor's own spread and by `_checkFeeStatus`),
//   so the two checks never actually interact or need to run in a
//   specific order relative to each other in the original either -
//   ported as two independent effects with their own dependency arrays
//   ((1) on `[quoteAsset, baseAsset, currentAccount]`, (2) on
//   `[quoteAsset.get("symbol"), baseAsset.get("symbol")]`), both mount-
//   skipped to match `componentWillReceiveProps` never firing on mount.
// - `_initPsContainer()` (called from both `componentDidUpdate` and
//   `componentWillReceiveProps`, guarded by an instance `psInit` flag so
//   it only actually initializes perfect-scrollbar once, on whichever
//   update happens to be the first one where the `center` ref already
//   exists) is simplified to a single mount-only `useLayoutEffect` that
//   initializes it directly - by the time any effect runs post-mount,
//   the ref is already attached, so the original's "retry on every
//   subsequent update until the ref shows up" dance has nothing left to
//   wait for. Same outcome (perfect-scrollbar initialized once, on the
//   `center` container), reached more directly.
// - The `bid`/`ask` order-state objects were, in the original, mutated
//   *in place* by several handlers (`_onInputPrice`/`_onInputSell`/
//   `_onInputReceive`/`_currentPriceClick`/`_orderbookClick`/
//   `_depthChartClick`) and then committed via either `this.forceUpdate()`
//   (which re-renders unconditionally, bypassing the need for the
//   mutated object to be a new reference) or a `setState` call that
//   happened to change a *different* top-level state key (relying on
//   React's shallow state merge to pick up the untouched, already-
//   mutated sibling key for free). Neither trick carries over to a
//   `useState` setter, which bails out via `Object.is` if given back the
//   *same* object reference. Every such handler here instead builds a
//   shallow clone of the relevant `bid`/`ask` object first, mutates the
//   clone through the same shared `setForSale`/`setReceive`/`setPrice`/
//   `setPriceText` helper functions (kept byte-for-byte equivalent to
//   the originals, just no longer methods), and commits the clone via
//   `setBid`/`setAsk` - identical final field values, correct under
//   hooks' reference-based change detection.
import * as React from "react";
import {Apis} from "bitsharesjs-ws";
import {ChainStore, FetchChain} from "bitsharesjs";
import {
    Tabs,
    Collapse,
    Icon as AntIcon,
    Tooltip
} from "bitshares-ui-style-guide";
import cnames from "classnames";
import translator from "counterpart";
import guide from "intro.js";
import moment from "moment";
import Ps from "perfect-scrollbar";
import SettingsActions from "actions/SettingsActions";
import MarketsActions from "actions/MarketsActions";
import {debounce} from "lodash-es";
import market_utils from "common/market_utils";
import {
    Asset,
    Price as PriceUntyped,
    LimitOrderCreate as LimitOrderCreateUntyped
} from "common/MarketClasses";

// `Price`/`LimitOrderCreate`'s constructors destructure some params
// without default values (`base`/`quote`, `for_sale`/`to_receive`) mixed
// with others that do have defaults - TS's JS inference only picks up
// the defaulted ones as known properties (the same pre-existing gap
// already worked around elsewhere in this migration for
// `checkFeeStatusAsync`/`Validation.Rules.min`). `Asset`'s constructor
// defaults every param, so it isn't affected and needs no cast.
const Price: any = PriceUntyped;
const LimitOrderCreate: any = LimitOrderCreateUntyped;
import {checkFeeStatusAsync} from "common/trxHelper";
import utils from "common/utils";
import BuySell from "./BuySell";
import ScaledOrderTab from "./ScaledOrderTab";
import ExchangeHeader from "./ExchangeHeader";
import {MarketOrders} from "./MyOpenOrders";
import {OrderBook} from "./OrderBook";
import MarketHistory from "./MarketHistory";
import MyMarkets from "./MyMarkets";
import MarketPicker from "./MarketPicker";
import ConfirmOrderModal from "./ConfirmOrderModal";
import Personalize from "./Personalize";
import TradingViewPriceChart from "./TradingViewPriceChart";
import DepthHighChart from "./DepthHighChart";
import LoadingIndicator from "../LoadingIndicator";
import BorrowModal from "../Modal/BorrowModal";
import AccountNotifications from "../Notifier/NotifierContainer";
import TranslateWithLinks from "../Utility/TranslateWithLinks";
import SimpleDepositWithdraw from "../Dashboard/SimpleDepositWithdraw";
import SimpleDepositBlocktradesBridge from "../Dashboard/SimpleDepositBlocktradesBridge";
import {Notification} from "bitshares-ui-style-guide";
import PriceAlert from "./PriceAlert";
import counterpart from "counterpart";
import {numberExponentToLarge} from "../../lib/common/numberExplonentConversion";

function initialOrderState(baseAsset: any, quoteAsset: any) {
    const bid: any = {
        forSaleText: "",
        toReceiveText: "",
        priceText: "",
        for_sale: new Asset({
            asset_id: baseAsset.get("id"),
            precision: baseAsset.get("precision")
        }),
        to_receive: new Asset({
            asset_id: quoteAsset.get("id"),
            precision: quoteAsset.get("precision")
        })
    };
    bid.price = new Price({base: bid.for_sale, quote: bid.to_receive});
    const ask: any = {
        forSaleText: "",
        toReceiveText: "",
        priceText: "",
        for_sale: new Asset({
            asset_id: quoteAsset.get("id"),
            precision: quoteAsset.get("precision")
        }),
        to_receive: new Asset({
            asset_id: baseAsset.get("id"),
            precision: baseAsset.get("precision")
        })
    };
    ask.price = new Price({base: ask.for_sale, quote: ask.to_receive});

    return {ask, bid};
}

function getInitialExchangeState(props: any) {
    const ws = props.viewSettings;
    const {ask, bid} = initialOrderState(props.baseAsset, props.quoteAsset);

    let chart_height = ws.get("chartHeight", 620);
    if (chart_height == 620 && window.innerWidth < 640) {
        // assume user is on default setting, use smaller for mobile
        chart_height = 425;
    }

    return {
        isDepositBridgeModalLoaded: false,
        isDepositModalLoaded: false,
        isPersonalizeModalLoaded: false,
        isMarketPickerModalLoaded: false,
        isBorrowQuoteModalLoaded: false,
        isBorrowBaseModalLoaded: false,
        isDepositBridgeModalVisible: false,
        isDepositModalVisible: false,
        isPersonalizeModalVisible: false,
        isMarketPickerModalVisible: false,
        isBorrowQuoteModalVisible: false,
        isBorrowBaseModalVisible: false,
        isConfirmBuyOrderModalVisible: false,
        isConfirmBuyOrderModalLoaded: false,
        isConfirmSellOrderModalVisible: false,
        isPriceAlertModalVisible: false,
        isConfirmSellOrderModalLoaded: false,
        tabVerticalPanel: ws.get("tabVerticalPanel", "my-market"),
        tabBuySell: ws.get("tabBuySell", "buy"),
        buySellOpen: ws.get("buySellOpen", true),
        bid,
        ask,
        height: window.innerHeight,
        width: window.innerWidth,
        buyDiff: false as any,
        sellDiff: false as any,
        autoScroll: ws.get("global_AutoScroll", true),
        buySellTop: ws.get("buySellTop", true),
        buyFeeAssetIdx: ws.get("buyFeeAssetIdx", 0),
        sellFeeAssetIdx: ws.get("sellFeeAssetIdx", 0),
        verticalOrderBook: ws.get("verticalOrderBook", false),
        verticalOrderForm: ws.get("verticalOrderForm", false),
        hidePanel: ws.get("hidePanel", false),
        hideScrollbars: ws.get("hideScrollbars", false),
        singleColumnOrderForm: ws.get("singleColumnOrderForm", true),
        flipOrderBook: ws.get("flipOrderBook", false),
        flipBuySell: ws.get("flipBuySell", false),
        orderBookReversed: ws.get("orderBookReversed", false),
        chartType: ws.get("chartType", "price_chart"),
        chartHeight: chart_height,
        chartZoom: ws.get("chartZoom", true),
        chartTools: ws.get("chartTools", false),
        hideFunctionButtons: ws.get("hideFunctionButtons", true),
        currentPeriod: ws.get("currentPeriod", 3600 * 24 * 30 * 3), // 3 months
        activePanels: ws.get("activePanels", ["left", "right"]),
        mobileKey: [""],
        mirrorPanels: ws.get("mirrorPanels", false),
        panelTabs: ws.get("panelTabs", {
            my_history: 1,
            history: 1,
            my_orders: 2,
            open_settlement: 2
        }),
        panelTabsActive: ws.get("panelTabsActive", {
            1: "my_history",
            2: "my_orders"
        })
    };
}

function setReceiveHelper(state: any) {
    if (state.price.isValid() && state.for_sale.hasAmount()) {
        state.to_receive = state.for_sale.times(state.price);
        state.toReceiveText = state.to_receive.getAmount({real: true}).toString();
        return true;
    }
    return false;
}

function setForSaleHelper(state: any) {
    if (state.price.isValid() && state.to_receive.hasAmount()) {
        state.for_sale = state.to_receive.times(state.price, true);
        state.forSaleText = state.for_sale.getAmount({real: true}).toString();
        return true;
    }
    return false;
}

function setPriceHelper(state: any) {
    if (state.for_sale.hasAmount() && state.to_receive.hasAmount()) {
        state.price = new Price({base: state.for_sale, quote: state.to_receive});
        state.priceText = state.price.toReal().toString();
        return true;
    }
    return false;
}

function setPriceTextHelper(state: any, isBid: boolean) {
    const currentBase = state[isBid ? "for_sale" : "to_receive"];
    const currentQuote = state[isBid ? "to_receive" : "for_sale"];
    if (currentBase.hasAmount() && currentQuote.hasAmount()) {
        state.priceText = new Price({
            base: currentBase,
            quote: currentQuote
        })
            .toReal()
            .toString();
    }
}

function exchangePropsAreEqual(prevProps: any, nextProps: any) {
    if (!nextProps.marketReady && !prevProps.marketReady) {
        return true;
    }
    for (const key in nextProps) {
        if (!(utils as any).are_equal_shallow(nextProps[key], prevProps[key])) {
            return false;
        }
    }
    return true;
}

function ExchangeInner(props: any) {
    const {
        currentAccount,
        marketLimitOrders,
        marketCallOrders = [],
        marketData,
        activeMarketHistory = {} as any,
        invertedCalls,
        starredMarkets,
        quoteAsset,
        baseAsset,
        lowestCallPrice,
        marketStats,
        marketReady,
        marketSettleOrders,
        bucketSize,
        totals,
        feedPrice,
        buckets,
        coreAsset,
        trackedGroupsConfig,
        currentGroupOrderLimit,
        viewSettings = {} as any,
        exchange,
        priceAlert,
        marketDirections,
        backedCoins,
        bridgeCoins,
        settings,
        hasAnyPriceAlert
    } = props;

    const initial = React.useRef(getInitialExchangeState(props));

    const [
        isDepositBridgeModalLoaded,
        setIsDepositBridgeModalLoaded
    ] = React.useState(initial.current.isDepositBridgeModalLoaded);
    const [isDepositModalLoaded, setIsDepositModalLoaded] = React.useState(
        initial.current.isDepositModalLoaded
    );
    const [isPersonalizeModalLoaded, setIsPersonalizeModalLoaded] = React.useState(
        initial.current.isPersonalizeModalLoaded
    );
    const [
        isMarketPickerModalLoaded,
        setIsMarketPickerModalLoaded
    ] = React.useState(initial.current.isMarketPickerModalLoaded);
    const [isBorrowQuoteModalLoaded, setIsBorrowQuoteModalLoaded] = React.useState(
        initial.current.isBorrowQuoteModalLoaded
    );
    const [isBorrowBaseModalLoaded, setIsBorrowBaseModalLoaded] = React.useState(
        initial.current.isBorrowBaseModalLoaded
    );
    const [
        isDepositBridgeModalVisible,
        setIsDepositBridgeModalVisible
    ] = React.useState(initial.current.isDepositBridgeModalVisible);
    const [isDepositModalVisible, setIsDepositModalVisible] = React.useState(
        initial.current.isDepositModalVisible
    );
    const [
        isPersonalizeModalVisible,
        setIsPersonalizeModalVisible
    ] = React.useState(initial.current.isPersonalizeModalVisible);
    const [
        isMarketPickerModalVisible,
        setIsMarketPickerModalVisible
    ] = React.useState(initial.current.isMarketPickerModalVisible);
    const [
        isBorrowQuoteModalVisible,
        setIsBorrowQuoteModalVisible
    ] = React.useState(initial.current.isBorrowQuoteModalVisible);
    const [
        isBorrowBaseModalVisible,
        setIsBorrowBaseModalVisible
    ] = React.useState(initial.current.isBorrowBaseModalVisible);
    const [
        isConfirmBuyOrderModalVisible,
        setIsConfirmBuyOrderModalVisible
    ] = React.useState(initial.current.isConfirmBuyOrderModalVisible);
    const [
        isConfirmBuyOrderModalLoaded,
        setIsConfirmBuyOrderModalLoaded
    ] = React.useState(initial.current.isConfirmBuyOrderModalLoaded);
    const [
        isConfirmSellOrderModalVisible,
        setIsConfirmSellOrderModalVisible
    ] = React.useState(initial.current.isConfirmSellOrderModalVisible);
    const [isPriceAlertModalVisible, setIsPriceAlertModalVisible] = React.useState(
        initial.current.isPriceAlertModalVisible
    );
    const [
        isConfirmSellOrderModalLoaded,
        setIsConfirmSellOrderModalLoaded
    ] = React.useState(initial.current.isConfirmSellOrderModalLoaded);
    const [tabVerticalPanel, setTabVerticalPanel] = React.useState(
        initial.current.tabVerticalPanel
    );
    const [tabBuySell, setTabBuySell] = React.useState(initial.current.tabBuySell);
    const [buySellOpen, setBuySellOpen] = React.useState(
        initial.current.buySellOpen
    );
    const [bid, setBid] = React.useState<any>(initial.current.bid);
    const [ask, setAsk] = React.useState<any>(initial.current.ask);
    const [height, setHeight] = React.useState(initial.current.height);
    const [width, setWidth] = React.useState(initial.current.width);
    const [buyDiff, setBuyDiff] = React.useState<any>(initial.current.buyDiff);
    const [sellDiff, setSellDiff] = React.useState<any>(initial.current.sellDiff);
    const [autoScroll, setAutoScroll] = React.useState(initial.current.autoScroll);
    const [buySellTop, setBuySellTop] = React.useState(initial.current.buySellTop);
    const [buyFeeAssetIdx, setBuyFeeAssetIdx] = React.useState(
        initial.current.buyFeeAssetIdx
    );
    const [sellFeeAssetIdx, setSellFeeAssetIdx] = React.useState(
        initial.current.sellFeeAssetIdx
    );
    const [verticalOrderBook, setVerticalOrderBook] = React.useState(
        initial.current.verticalOrderBook
    );
    const [verticalOrderForm, setVerticalOrderForm] = React.useState(
        initial.current.verticalOrderForm
    );
    const [hidePanel] = React.useState(initial.current.hidePanel);
    const [hideScrollbars, setHideScrollbars] = React.useState(
        initial.current.hideScrollbars
    );
    const [singleColumnOrderForm, setSingleColumnOrderForm] = React.useState(
        initial.current.singleColumnOrderForm
    );
    const [flipOrderBook, setFlipOrderBook] = React.useState(
        initial.current.flipOrderBook
    );
    const [flipBuySell, setFlipBuySell] = React.useState(
        initial.current.flipBuySell
    );
    const [orderBookReversed, setOrderBookReversed] = React.useState(
        initial.current.orderBookReversed
    );
    const [chartType, setChartType] = React.useState(initial.current.chartType);
    const [chartHeight, setChartHeight] = React.useState(
        initial.current.chartHeight
    );
    const [chartZoom, setChartZoom] = React.useState(initial.current.chartZoom);
    const [chartTools, setChartTools] = React.useState(initial.current.chartTools);
    const [hideFunctionButtons, setHideFunctionButtons] = React.useState(
        initial.current.hideFunctionButtons
    );
    const [currentPeriod, setCurrentPeriod] = React.useState(
        initial.current.currentPeriod
    );
    const [activePanels, setActivePanels] = React.useState<string[]>(
        initial.current.activePanels
    );
    const [mobileKey, setMobileKey] = React.useState<string[]>(
        initial.current.mobileKey
    );
    const [mirrorPanels, setMirrorPanels] = React.useState(
        initial.current.mirrorPanels
    );
    const [panelTabs, setPanelTabs] = React.useState<any>(
        initial.current.panelTabs
    );
    const [panelTabsActive, setPanelTabsActive] = React.useState<any>(
        initial.current.panelTabsActive
    );
    const [expirationType, setExpirationType] = React.useState({
        bid: exchange.getIn(["lastExpiration", "bid"]) || "YEAR",
        ask: exchange.getIn(["lastExpiration", "ask"]) || "YEAR"
    });
    const [expirationCustomTime, setExpirationCustomTime] = React.useState<any>({
        bid: "Specific",
        ask: "Specific"
    });
    const [feeStatus, setFeeStatus] = React.useState<any>({});
    const [marketPickerAsset, setMarketPickerAsset] = React.useState<any>(
        undefined
    );
    const [buyModalType, setBuyModalType] = React.useState<any>(undefined);
    const [depositModalType, setDepositModalType] = React.useState<any>(
        undefined
    );

    const centerRef = React.useRef<HTMLDivElement>(null);
    const orderBookRef = React.useRef<any>(null);
    const psInitRef = React.useRef(true);
    const tutorialShownRef = React.useRef(false);

    const EXPIRATIONS: any = {
        HOUR: {
            title: "1 hour",
            get: () =>
                moment()
                    .add(1, "hour")
                    .valueOf()
        },
        "12HOURS": {
            title: "12 hours",
            get: () =>
                moment()
                    .add(12, "hour")
                    .valueOf()
        },
        "24HOURS": {
            title: "24 hours",
            get: () =>
                moment()
                    .add(1, "day")
                    .valueOf()
        },
        "7DAYS": {
            title: "7 days",
            get: () =>
                moment()
                    .add(7, "day")
                    .valueOf()
        },
        MONTH: {
            title: "30 days",
            get: () =>
                moment()
                    .add(30, "day")
                    .valueOf()
        },
        YEAR: {
            title: "1 year",
            get: () =>
                moment()
                    .add(1, "year")
                    .valueOf()
        },
        SPECIFIC: {
            title: "Specific",
            get: (type: string) => expirationCustomTime[type].valueOf()
        }
    };

    const getLastMarketKey = () => {
        const chainID = (Apis as any).instance().chain_id;
        return `lastMarket${chainID ? "_" + chainID.substr(0, 8) : ""}`;
    };

    const checkFeeStatus = (
        assets: any[] = [coreAsset, baseAsset, quoteAsset],
        account: any = currentAccount
    ) => {
        const newFeeStatus: any = {};
        const p: Promise<any>[] = [];
        assets.forEach(a => {
            p.push(
                checkFeeStatusAsync({
                    accountID: account.get("id"),
                    feeID: a.get("id"),
                    type: "limit_order_create"
                } as any)
            );
        });
        Promise.all(p)
            .then(status => {
                assets.forEach((a, idx) => {
                    newFeeStatus[a.get("id")] = status[idx];
                });
                setFeeStatus((prev: any) =>
                    !(utils as any).are_equal_shallow(prev, newFeeStatus)
                        ? newFeeStatus
                        : prev
                );
            })
            .catch(err => {
                console.error("checkFeeStatusAsync error", err);
                setFeeStatus({});
            });
    };

    // Mount-only: dispatched from UNSAFE_componentWillMount in the
    // original, before the initial render - since this only kicks off
    // async promises, the class-vs-hooks mount-timing difference here is
    // not observable.
    const didMountRef = React.useRef(false);
    React.useEffect(() => {
        if (didMountRef.current) return;
        didMountRef.current = true;

        checkFeeStatus();

        (MarketsActions as any).getTrackedGroupsConfig();

        (SettingsActions.changeViewSetting as any).defer({
            [getLastMarketKey()]:
                quoteAsset.get("symbol") + "_" + baseAsset.get("symbol")
        });

        const onWindowResize = () => {
            const {innerHeight, innerWidth} = window;
            setHeight(prevHeight => {
                setWidth(prevWidth => {
                    if (innerHeight !== prevHeight || innerWidth !== prevWidth) {
                        const container = centerRef.current;
                        if (container) {
                            Ps.update(container);
                        }
                    }
                    return innerWidth !== prevWidth ? innerWidth : prevWidth;
                });
                return innerHeight !== prevHeight ? innerHeight : prevHeight;
            });
        };
        const debouncedResize = (debounce as any)(
            onWindowResize,
            150
        );
        window.addEventListener("resize", debouncedResize, {
            capture: false,
            passive: true
        } as any);

        if (centerRef.current) {
            Ps.initialize(centerRef.current);
            psInitRef.current = false;
        }

        return () => {
            window.removeEventListener("resize", debouncedResize);
        };
    }, []);

    // Real SCU-embedded setState: normalizes expirationType on every
    // quoteAsset/baseAsset *reference* change (see file-header note).
    const isFirstExpirationNormalizeRender = React.useRef(true);
    React.useEffect(() => {
        if (isFirstExpirationNormalizeRender.current) {
            isFirstExpirationNormalizeRender.current = false;
            return;
        }
        setExpirationType(prev => ({
            bid: prev.bid === "SPECIFIC" ? prev.bid : "YEAR",
            ask: prev.ask === "SPECIFIC" ? prev.ask : "YEAR"
        }));
    }, [quoteAsset, baseAsset]);

    // UNSAFE_componentWillReceiveProps check (1): reference change on
    // quoteAsset/baseAsset/currentAccount -> re-check fee status.
    const isFirstFeeCheckRender = React.useRef(true);
    React.useEffect(() => {
        if (isFirstFeeCheckRender.current) {
            isFirstFeeCheckRender.current = false;
            return;
        }
        checkFeeStatus([coreAsset, baseAsset, quoteAsset], currentAccount);
    }, [quoteAsset, baseAsset, currentAccount]);

    // UNSAFE_componentWillReceiveProps check (2): quoteAsset/baseAsset
    // *symbol* change -> full state reset (market actually switched).
    const isFirstMarketSwitchRender = React.useRef(true);
    React.useEffect(() => {
        if (isFirstMarketSwitchRender.current) {
            isFirstMarketSwitchRender.current = false;
            return;
        }
        const freshState = getInitialExchangeState({
            viewSettings,
            baseAsset,
            quoteAsset
        });
        setIsDepositBridgeModalLoaded(freshState.isDepositBridgeModalLoaded);
        setIsDepositModalLoaded(freshState.isDepositModalLoaded);
        setIsPersonalizeModalLoaded(freshState.isPersonalizeModalLoaded);
        setIsMarketPickerModalLoaded(freshState.isMarketPickerModalLoaded);
        setIsBorrowQuoteModalLoaded(freshState.isBorrowQuoteModalLoaded);
        setIsBorrowBaseModalLoaded(freshState.isBorrowBaseModalLoaded);
        setIsDepositBridgeModalVisible(freshState.isDepositBridgeModalVisible);
        setIsDepositModalVisible(freshState.isDepositModalVisible);
        setIsPersonalizeModalVisible(freshState.isPersonalizeModalVisible);
        setIsMarketPickerModalVisible(freshState.isMarketPickerModalVisible);
        setIsBorrowQuoteModalVisible(freshState.isBorrowQuoteModalVisible);
        setIsBorrowBaseModalVisible(freshState.isBorrowBaseModalVisible);
        setIsConfirmBuyOrderModalVisible(
            freshState.isConfirmBuyOrderModalVisible
        );
        setIsConfirmBuyOrderModalLoaded(freshState.isConfirmBuyOrderModalLoaded);
        setIsConfirmSellOrderModalVisible(
            freshState.isConfirmSellOrderModalVisible
        );
        setIsPriceAlertModalVisible(freshState.isPriceAlertModalVisible);
        setIsConfirmSellOrderModalLoaded(
            freshState.isConfirmSellOrderModalLoaded
        );
        setTabVerticalPanel(freshState.tabVerticalPanel);
        setTabBuySell(freshState.tabBuySell);
        setBuySellOpen(freshState.buySellOpen);
        setBid(freshState.bid);
        setAsk(freshState.ask);
        setHeight(freshState.height);
        setWidth(freshState.width);
        setBuyDiff(freshState.buyDiff);
        setSellDiff(freshState.sellDiff);
        setAutoScroll(freshState.autoScroll);
        setBuySellTop(freshState.buySellTop);
        setBuyFeeAssetIdx(freshState.buyFeeAssetIdx);
        setSellFeeAssetIdx(freshState.sellFeeAssetIdx);
        setVerticalOrderBook(freshState.verticalOrderBook);
        setVerticalOrderForm(freshState.verticalOrderForm);
        setHideScrollbars(freshState.hideScrollbars);
        setSingleColumnOrderForm(freshState.singleColumnOrderForm);
        setFlipOrderBook(freshState.flipOrderBook);
        setFlipBuySell(freshState.flipBuySell);
        setOrderBookReversed(freshState.orderBookReversed);
        setChartType(freshState.chartType);
        setChartHeight(freshState.chartHeight);
        setChartZoom(freshState.chartZoom);
        setChartTools(freshState.chartTools);
        setHideFunctionButtons(freshState.hideFunctionButtons);
        setCurrentPeriod(freshState.currentPeriod);
        setActivePanels(freshState.activePanels);
        setMobileKey(freshState.mobileKey);
        setMirrorPanels(freshState.mirrorPanels);
        setPanelTabs(freshState.panelTabs);
        setPanelTabsActive(freshState.panelTabsActive);

        (SettingsActions.changeViewSetting as any)({
            [getLastMarketKey()]:
                quoteAsset.get("symbol") + "_" + baseAsset.get("symbol")
        });
    }, [quoteAsset.get("symbol"), baseAsset.get("symbol")]);

    // componentDidUpdate's unconditional tail call + one-time tutorial
    // trigger, both mount-skipped.
    const isFirstUpdateEffectRender = React.useRef(true);
    const prevCoreAssetRef = React.useRef(coreAsset);
    const prevFeeStatusRef = React.useRef(feeStatus);
    React.useEffect(() => {
        if (centerRef.current && psInitRef.current) {
            Ps.initialize(centerRef.current);
            psInitRef.current = false;
        }

        if (isFirstUpdateEffectRender.current) {
            isFirstUpdateEffectRender.current = false;
            prevCoreAssetRef.current = coreAsset;
            prevFeeStatusRef.current = feeStatus;
            return;
        }

        if (
            !exchange.get("tutorialShown") &&
            prevCoreAssetRef.current &&
            prevFeeStatusRef.current
        ) {
            if (!tutorialShownRef.current) {
                tutorialShownRef.current = true;
                const theme = settings.get("themes");

                (guide as any)
                    .introJs()
                    .setOptions({
                        tooltipClass: theme,
                        highlightClass: theme,
                        showBullets: false,
                        hideNext: true,
                        hidePrev: true,
                        nextLabel: translator.translate(
                            "walkthrough.next_label"
                        ),
                        prevLabel: translator.translate(
                            "walkthrough.prev_label"
                        ),
                        skipLabel: translator.translate(
                            "walkthrough.skip_label"
                        ),
                        doneLabel: translator.translate(
                            "walkthrough.done_label"
                        )
                    })
                    .start();

                (SettingsActions as any).setExchangeTutorialShown.defer(true);
            }
        }
        prevCoreAssetRef.current = coreAsset;
        prevFeeStatusRef.current = feeStatus;
    });

    const showMarketPickerModal = () => {
        setIsMarketPickerModalVisible(true);
        setIsMarketPickerModalLoaded(true);
    };
    const hideMarketPickerModal = () => setIsMarketPickerModalVisible(false);
    const hidePersonalizeModal = () => setIsPersonalizeModalVisible(false);
    const showPriceAlertModal = () => setIsPriceAlertModalVisible(true);
    const hidePriceAlertModal = () => setIsPriceAlertModalVisible(false);
    const showBorrowQuoteModal = () => {
        setIsBorrowQuoteModalVisible(true);
        setIsBorrowQuoteModalLoaded(true);
    };
    const hideBorrowQuoteModal = () => setIsBorrowQuoteModalVisible(false);
    const showBorrowBaseModal = () => {
        setIsBorrowBaseModalVisible(true);
        setIsBorrowBaseModalLoaded(true);
    };
    const hideBorrowBaseModal = () => setIsBorrowBaseModalVisible(false);
    const showDepositBridgeModal = () => {
        setIsDepositBridgeModalVisible(true);
        setIsDepositBridgeModalLoaded(true);
    };
    const hideDepositBridgeModal = () => setIsDepositBridgeModalVisible(false);
    const showDepositModal = () => {
        setIsDepositModalVisible(true);
        setIsDepositModalLoaded(true);
    };
    const hideDepositModal = () => setIsDepositModalVisible(false);
    const showConfirmBuyOrderModal = () => {
        setIsConfirmBuyOrderModalVisible(true);
        setIsConfirmBuyOrderModalLoaded(true);
    };
    const hideConfirmBuyOrderModal = () =>
        setIsConfirmBuyOrderModalVisible(false);
    const showConfirmSellOrderModal = () => {
        setIsConfirmSellOrderModalVisible(true);
        setIsConfirmSellOrderModalLoaded(true);
    };
    const hideConfirmSellOrderModal = () =>
        setIsConfirmSellOrderModalVisible(false);

    const handleOrderTypeTabChange = (type: string, value: any) => {
        SettingsActions.changeViewSetting({
            [`order-form-${type}`]: value
        } as any);
    };

    const handlePriceAlertSave = (savedRules: any[] = []) => {
        savedRules = savedRules.map(rule => ({
            type: rule.type,
            price: rule.price,
            baseAssetSymbol: baseAsset.get("symbol"),
            quoteAssetSymbol: quoteAsset.get("symbol")
        }));

        let rules = priceAlert.filter((rule: any) => {
            return (
                rule &&
                baseAsset &&
                quoteAsset &&
                (rule.get("baseAssetSymbol") !== baseAsset.get("symbol") ||
                    rule.get("quoteAssetSymbol") !== quoteAsset.get("symbol"))
            );
        });

        rules = [...rules, ...savedRules];

        (SettingsActions as any).setPriceAlert(rules);

        hidePriceAlertModal();
    };

    const getPriceAlertRules = () => {
        const rules = priceAlert.filter((rule: any) => {
            return (
                rule &&
                baseAsset &&
                quoteAsset &&
                rule.get("baseAssetSymbol") === baseAsset.get("symbol") &&
                rule.get("quoteAssetSymbol") === quoteAsset.get("symbol")
            );
        });

        return rules.toJS();
    };

    const handleExpirationChange = (type: string, e: any) => {
        const newExpirationType = {
            ...expirationType,
            [type]: e.target.value
        };

        if (e.target.value !== "SPECIFIC") {
            (SettingsActions as any).setExchangeLastExpiration({
                ...((exchange.has("lastExpiration") &&
                    exchange.get("lastExpiration").toJS()) ||
                    {}),
                [type]: e.target.value
            });
        }

        setExpirationType(newExpirationType);
    };

    const handleCustomExpirationChange = (type: string, time: any) => {
        setExpirationCustomTime((prev: any) => ({
            ...prev,
            [type]: time
        }));
    };

    const getFee = (asset: any = coreAsset) => {
        return feeStatus[asset.get("id")] && feeStatus[asset.get("id")].fee;
    };

    const verifyFee = (
        fee: any,
        sell: any,
        sellBalance: any,
        coreBalance: any
    ) => {
        const coreFee = getFee();

        if (fee.asset_id === "1.3.0") {
            if (coreFee.getAmount() <= coreBalance) {
                return "1.3.0";
            } else {
                return null;
            }
        } else {
            const sellSum =
                sell.asset_id === fee.asset_id
                    ? fee.getAmount() + sell.getAmount()
                    : sell.getAmount();
            if (sellSum <= sellBalance) {
                return fee.asset_id;
            } else if (coreFee.getAmount() <= coreBalance && fee.asset_id !== "1.3.0") {
                return "1.3.0";
            } else {
                return null;
            }
        }
    };

    const getFeeAssets = (quote: any, base: any, coreAssetArg: any) => {
        function addMissingAsset(target: any[], asset: any) {
            if (target.indexOf(asset) === -1) {
                target.push(asset);
            }
        }

        function hasFeePoolBalance(id: string) {
            return feeStatus[id] && feeStatus[id].hasPoolBalance;
        }

        function hasBalance(id: string) {
            return feeStatus[id] && feeStatus[id].hasBalance;
        }

        const sellAssets = [
            coreAssetArg,
            quote === coreAssetArg ? base : quote
        ];
        addMissingAsset(sellAssets, quote);
        addMissingAsset(sellAssets, base);

        const buyAssets = [coreAssetArg, base === coreAssetArg ? quote : base];
        addMissingAsset(buyAssets, quote);
        addMissingAsset(buyAssets, base);

        const balances: any = {};

        currentAccount
            .get("balances", [])
            .filter((balance: any, id: any) => {
                return (
                    ["1.3.0", quote.get("id"), base.get("id")].indexOf(id) >= 0
                );
            })
            .forEach((balance: any, id: any) => {
                const balanceObject = (ChainStore as any).getObject(balance);
                balances[id] = {
                    balance: balanceObject
                        ? parseInt(balanceObject.get("balance"), 10)
                        : 0,
                    fee: getFee((ChainStore as any).getAsset(id))
                };
            });

        function filterAndDefault(assets: any[], balances: any, idx: number) {
            let asset;
            assets = assets.filter(a => {
                if (!balances[a.get("id")]) {
                    return false;
                }
                return (
                    hasFeePoolBalance(a.get("id")) && hasBalance(a.get("id"))
                );
            });

            if (!assets.length) {
                asset = coreAssetArg;
                assets.push(coreAssetArg);
            } else {
                asset = assets[Math.min(assets.length - 1, idx)];
            }

            return {assets, asset};
        }

        const {assets: sellFeeAssets, asset: sellFeeAsset} = filterAndDefault(
            sellAssets,
            balances,
            sellFeeAssetIdx
        );
        const {assets: buyFeeAssets, asset: buyFeeAsset} = filterAndDefault(
            buyAssets,
            balances,
            buyFeeAssetIdx
        );

        const sellFee = getFee(sellFeeAsset);
        const buyFee = getFee(buyFeeAsset);

        return {
            sellFeeAsset,
            sellFeeAssets,
            sellFee,
            buyFeeAsset,
            buyFeeAssets,
            buyFee
        };
    };

    const createLimitOrder = (type: string, feeID: string) => {
        const actionType = type === "sell" ? "ask" : "bid";

        const current = actionType === "ask" ? ask : bid;

        let expirationTime = null;
        if (expirationType[actionType as "bid" | "ask"] === "SPECIFIC") {
            expirationTime = EXPIRATIONS[
                expirationType[actionType as "bid" | "ask"]
            ].get(actionType);
        } else {
            expirationTime = EXPIRATIONS[
                expirationType[actionType as "bid" | "ask"]
            ].get();
        }

        const order = new LimitOrderCreate({
            for_sale: current.for_sale,
            expiration: new Date(expirationTime || false),
            to_receive: current.to_receive,
            seller: currentAccount.get("id"),
            fee: {
                asset_id: feeID,
                amount: 0
            }
        });
        const {marketName, first} = (market_utils as any).getMarketName(
            baseAsset,
            quoteAsset
        );
        const inverted = marketDirections.get(marketName);
        const shouldFlip =
            (inverted && first.get("id") !== baseAsset.get("id")) ||
            (!inverted && first.get("id") === baseAsset.get("id"));
        if (shouldFlip) {
            const setting: any = {};
            setting[marketName] = !inverted;
            (SettingsActions as any).changeMarketDirection(setting);
        }

        return (MarketsActions as any)
            .createLimitOrder2(order)
            .then((result: any) => {
                if (result.error) {
                    if (result.error.message !== "wallet locked")
                        (Notification as any).error({
                            message: counterpart.translate(
                                "notifications.exchange_unknown_error_place_order",
                                {
                                    amount: current.to_receive.getAmount({
                                        real: true
                                    }),
                                    symbol: current.to_receive.asset_id
                                }
                            )
                        });
                }
            })
            .catch((e: any) => {
                console.error("order failed:", e);
            });
    };

    const createPredictionShort = (feeID: string) => {
        const current = ask;
        const order = new LimitOrderCreate({
            for_sale: current.for_sale,
            to_receive: current.to_receive,
            seller: currentAccount.get("id"),
            fee: {
                asset_id: feeID,
                amount: 0
            }
        });

        Promise.all([
            FetchChain(
                "getAsset",
                quoteAsset.getIn(["bitasset", "options", "short_backing_asset"])
            )
        ]).then(assets => {
            const [backingAsset] = assets;
            const collateral = new Asset({
                amount: (order as any).amount_for_sale.getAmount(),
                asset_id: (backingAsset as any).get("id"),
                precision: (backingAsset as any).get("precision")
            });

            (MarketsActions as any)
                .createPredictionShort(order, collateral)
                .then((result: any) => {
                    if (result.error) {
                        if (result.error.message !== "wallet locked")
                            // NOTE: `buyAssetAmount`/`buyAsset` referenced
                            // below are not defined anywhere in this
                            // scope - a pre-existing bug in the original
                            // (would throw a ReferenceError if this
                            // branch is ever hit), preserved as-is rather
                            // than silently "fixed".
                            (Notification as any).error({
                                message: counterpart.translate(
                                    "notifications.exchange_unknown_error_place_order",
                                    {
                                        amount: (window as any).buyAssetAmount,
                                        symbol: (window as any).buyAsset.symbol
                                    }
                                )
                            });
                    }
                });
        });
    };

    const createLimitOrderConfirm = (
        buyAsset: any,
        sellAsset: any,
        sellBalanceArg: any,
        coreBalanceArg: any,
        feeAssetArg: any,
        type: string,
        short = true,
        e: any
    ) => {
        e.preventDefault();
        const {highestBid, lowestAsk} = marketData;
        const current = type === "sell" ? ask : bid;

        const sellBalance = current.for_sale.clone(
            sellBalanceArg
                ? parseInt(
                      (ChainStore as any).getObject(sellBalanceArg).toJS()
                          .balance,
                      10
                  )
                : 0
        );
        const coreBalance = new Asset({
            amount: coreBalanceArg
                ? parseInt(
                      (ChainStore as any).getObject(coreBalanceArg).toJS()
                          .balance,
                      10
                  )
                : 0
        });

        const fee = getFee(feeAssetArg);
        const feeID = verifyFee(
            fee,
            current.for_sale,
            sellBalance.getAmount(),
            coreBalance.getAmount()
        );
        if (!feeID) {
            return (Notification as any).error({
                message: counterpart.translate(
                    "notifications.exchange_insufficient_funds_for_fees"
                )
            });
        }

        if (type === "buy" && lowestAsk) {
            const diff = bid.price.toReal() / lowestAsk.getPrice();
            if (diff > 1.2) {
                showConfirmBuyOrderModal();
                setBuyDiff(diff);
                return;
            }
        } else if (type === "sell" && highestBid) {
            const diff = 1 / (ask.price.toReal() / highestBid.getPrice());
            if (diff > 1.2) {
                showConfirmSellOrderModal();
                setSellDiff(diff);
                return;
            }
        }

        const isPredictionMarket = sellAsset.getIn([
            "bitasset",
            "is_prediction_market"
        ]);

        if (current.for_sale.gt(sellBalance) && !isPredictionMarket) {
            return (Notification as any).error({
                message: counterpart.translate(
                    "notifications.exchange_insufficient_funds_to_place_order",
                    {
                        amount: current.for_sale.getAmount({real: true}),
                        symbol: sellAsset.get("symbol")
                    }
                )
            });
        }
        if (
            !(
                current.for_sale.getAmount() > 0 &&
                current.to_receive.getAmount() > 0
            )
        ) {
            return (Notification as any).warning({
                message: counterpart.translate(
                    "notifications.exchange_enter_valid_values"
                )
            });
        }
        if (type === "sell" && isPredictionMarket && short) {
            return createPredictionShort(feeID);
        }

        return createLimitOrder(type, feeID);
    };

    const createScaledOrder = (orders: any[], feeID: string) => {
        const limitOrders = orders.map(
            order =>
                new LimitOrderCreate({
                    for_sale: order.for_sale,
                    expiration: new Date(order.expirationTime || false),
                    to_receive: order.to_receive,
                    seller: currentAccount.get("id"),
                    fee: {
                        asset_id: feeID,
                        amount: 0
                    }
                })
        );

        return (MarketsActions as any)
            .createLimitOrder2(limitOrders)
            .then((result: any) => {
                if (result.error) {
                    if (result.error.message !== "wallet locked")
                        (Notification as any).error({
                            message: counterpart.translate(
                                "notifications.exchange_unknown_error_place_scaled_order"
                            )
                        });
                }
                console.log("order success");
            })
            .catch((e: any) => {
                console.log("order failed:", e);
            });
    };

    const forceBuyOrSell = (
        type: string,
        feeAssetArg: any,
        sellBalanceArg: any,
        coreBalanceArg: any
    ) => {
        const current = type === "sell" ? ask : bid;
        const sellBalance = current.for_sale.clone(
            sellBalanceArg
                ? parseInt(
                      (ChainStore as any).getObject(sellBalanceArg).get(
                          "balance"
                      ),
                      10
                  )
                : 0
        );
        const coreBalance = new Asset({
            amount: coreBalanceArg
                ? parseInt(
                      (ChainStore as any).getObject(coreBalanceArg).toJS()
                          .balance,
                      10
                  )
                : 0
        });
        const fee = getFee(feeAssetArg);
        const feeID = verifyFee(
            fee,
            current.for_sale,
            sellBalance.getAmount(),
            coreBalance.getAmount()
        );

        if (feeID) {
            createLimitOrder(type, feeID);
        } else {
            console.error("Unable to pay fees, aborting limit order creation");
        }
    };

    const cancelLimitOrder = (orderID: string, e: any) => {
        e.preventDefault();
        (MarketsActions as any).cancelLimitOrder(
            currentAccount.get("id"),
            orderID
        );
    };

    const onGroupOrderLimitChange = (e: any) => {
        let groupLimit: any;

        if (typeof e == "object") {
            e.preventDefault();
            groupLimit = parseInt(e.target.value);
        }

        if (typeof e == "number") groupLimit = parseInt(e as any);

        (MarketsActions as any).changeCurrentGroupLimit(groupLimit);

        if (groupLimit !== currentGroupOrderLimit) {
            (MarketsActions as any).changeCurrentGroupLimit(groupLimit);
            const currentSub = props.sub.split("_");
            (MarketsActions as any)
                .unSubscribeMarket(currentSub[0], currentSub[1])
                .then(() => {
                    props.subToMarket(props, props.bucketSize, groupLimit);
                });
        }
    };

    const depthChartClick = (baseArg: any, quoteArg: any, e: any) => {
        e.preventDefault();

        const newBid = {...bid};
        const newAsk = {...ask};

        newBid.price = new Price({
            base: bid.for_sale,
            quote: bid.to_receive,
            real: e.xAxis[0].value
        });
        newBid.priceText = newBid.price.toReal();

        newAsk.price = new Price({
            base: ask.to_receive,
            quote: ask.for_sale,
            real: e.xAxis[0].value
        });
        newAsk.priceText = newAsk.price.toReal();

        setForSaleHelper(newBid) || setReceiveHelper(newBid);
        setReceiveHelper(newAsk) || setForSaleHelper(newAsk);

        setPriceTextHelper(newBid, true);
        setPriceTextHelper(newAsk, false);

        setBid(newBid);
        setAsk(newAsk);
    };

    const setAutoscroll = (value: boolean) => setAutoScroll(value);

    const togglePanel = (panel: string) => {
        if (!panel) return;

        const newState: string[] = [];

        activePanels.forEach(a => {
            if (a !== panel) {
                newState.push(a);
            }
        });

        if (!activePanels.includes(panel)) {
            newState.push(panel);
        }

        setActivePanels(newState);

        SettingsActions.changeViewSetting({
            activePanels: newState
        } as any);
    };

    const toggleChart = (value: string) => {
        setChartType(value);
        SettingsActions.changeViewSetting({chartType: value} as any);
    };

    const chartZoomToggle = () => {
        SettingsActions.changeViewSetting({chartZoom: !chartZoom} as any);

        const currentChartType = chartType;
        setChartZoom(!chartZoom);
        setChartType("hidden_chart");
        setTimeout(() => {
            setChartType(currentChartType);
        }, 100);
    };

    const chartToolsToggle = () => {
        SettingsActions.changeViewSetting({chartTools: !chartTools} as any);

        const currentChartType = chartType;
        setChartTools(!chartTools);
        setChartType("hidden_chart");
        setTimeout(() => {
            setChartType(currentChartType);
        }, 100);
    };

    const flipBuySellToggle = () => {
        setFlipBuySell(!flipBuySell);
        SettingsActions.changeViewSetting({flipBuySell: !flipBuySell} as any);
    };

    const flipOrderBookToggle = () => {
        SettingsActions.changeViewSetting({
            flipOrderBook: !flipOrderBook
        } as any);
        setFlipOrderBook(!flipOrderBook);
    };

    const orderBookReversedToggle = () => {
        SettingsActions.changeViewSetting({
            orderBookReversed: !orderBookReversed
        } as any);
        setOrderBookReversed(!orderBookReversed);
    };

    const hideFunctionButtonsToggle = () => {
        SettingsActions.changeViewSetting({
            hideFunctionButtons: !hideFunctionButtons
        } as any);
        setHideFunctionButtons(!hideFunctionButtons);
    };

    const toggleMarketPicker = (asset: any) => {
        const show = !!asset;

        if (show) {
            showMarketPickerModal();
        }

        setMarketPickerAsset(asset);
    };

    const moveOrderBook = () => {
        if (verticalOrderForm) {
            moveOrderForm();
        }
        SettingsActions.changeViewSetting({
            verticalOrderBook: !verticalOrderBook
        } as any);
        setVerticalOrderBook(!verticalOrderBook);
    };

    const moveOrderForm = () => {
        if (verticalOrderBook) {
            moveOrderBook();
        }
        SettingsActions.changeViewSetting({
            verticalOrderForm: !verticalOrderForm
        } as any);
        setVerticalOrderForm(!verticalOrderForm);
    };

    const togglePersonalize = () => {
        if (!isPersonalizeModalVisible) {
            setIsPersonalizeModalVisible(true);
            setIsPersonalizeModalLoaded(true);
        } else {
            setIsPersonalizeModalVisible(false);
        }
    };

    const toggleScrollbars = () => {
        SettingsActions.changeViewSetting({
            hideScrollbars: !hideScrollbars
        } as any);
        setHideScrollbars(!hideScrollbars);
    };

    const toggleSingleColumnOrderForm = () => {
        SettingsActions.changeViewSetting({
            singleColumnOrderForm: !singleColumnOrderForm
        } as any);
        setSingleColumnOrderForm(!singleColumnOrderForm);
    };

    const mirrorPanelsToggle = () => {
        setMirrorPanels(!mirrorPanels);
        SettingsActions.changeViewSetting({
            mirrorPanels: !mirrorPanels
        } as any);
    };

    const currentPriceClick = (type: "bid" | "ask", price: any) => {
        const isBid = type === "bid";
        const current = {...(type === "bid" ? bid : ask)};
        current.price = price[isBid ? "invert" : "clone"]();
        current.priceText = current.price.toReal();
        if (isBid) {
            setForSaleHelper(current) || setReceiveHelper(current);
        } else {
            setReceiveHelper(current) || setForSaleHelper(current);
        }
        if (isBid) setBid(current);
        else setAsk(current);
    };

    const orderbookClick = (order: any) => {
        const isBid = order.isBid();
        const forSale = order.totalToReceive({noCache: true});
        const toReceive = forSale.times(order.sellPrice());

        const newPrice = new Price({
            base: isBid ? toReceive : forSale,
            quote: isBid ? forSale : toReceive
        });

        const current = {...(isBid ? bid : ask)};
        current.price = newPrice;
        current.priceText = newPrice.toReal();

        const other = {
            for_sale: forSale,
            forSaleText: forSale.getAmount({real: true}),
            to_receive: toReceive,
            toReceiveText: toReceive.getAmount({real: true}),
            price: newPrice,
            priceText: newPrice.toReal()
        };

        if (isBid) {
            setForSaleHelper(current) || setReceiveHelper(current);
        } else {
            setReceiveHelper(current) || setForSaleHelper(current);
        }

        if (isBid) {
            setBid(current);
            setAsk(other);
        } else {
            setAsk(current);
            setBid(other);
        }
    };

    const borrowQuote = () => showBorrowQuoteModal();
    const borrowBase = () => showBorrowBaseModal();

    const onDeposit = (type: string) => {
        setDepositModalType(type);
        showDepositModal();
    };

    const onBuy = (type: string) => {
        setBuyModalType(type);
        showDepositBridgeModal();
    };

    const getSettlementInfo = () => {
        let showCallLimit = false;
        if (feedPrice) {
            if (feedPrice.inverted) {
                showCallLimit = lowestCallPrice <= feedPrice.toReal();
            } else {
                showCallLimit = lowestCallPrice >= feedPrice.toReal();
            }
        }
        return !!(
            showCallLimit &&
            lowestCallPrice &&
            !quoteAsset.getIn(["bitasset", "is_prediction_market"])
        );
    };

    const setTabVerticalPanelState = (tab: string) => {
        setTabVerticalPanel(tab);
        SettingsActions.changeViewSetting({tabVerticalPanel: tab} as any);
    };

    const onChangeFeeAsset = (type: string, value: any) => {
        if (type === "buy") {
            setBuyFeeAssetIdx(value);
            SettingsActions.changeViewSetting({buyFeeAssetIdx: value} as any);
        } else {
            setSellFeeAssetIdx(value);
            SettingsActions.changeViewSetting({sellFeeAssetIdx: value} as any);
        }
    };

    const onChangeChartHeight = ({
        value,
        increase
    }: {
        value?: number;
        increase?: boolean;
    }) => {
        let newHeight = value ? value : chartHeight + (increase ? 20 : -20);
        if (newHeight < 425) {
            newHeight = 425;
        }
        if (newHeight > 1000) {
            newHeight = 1000;
        }

        setChartHeight(newHeight);
        SettingsActions.changeViewSetting({chartHeight: newHeight} as any);
    };

    const toggleBuySellPosition = () => {
        setBuySellTop(!buySellTop);
        SettingsActions.changeViewSetting({buySellTop: !buySellTop} as any);
    };

    const onInputPrice = (type: "bid" | "ask", e: any) => {
        const current = {...(type === "bid" ? bid : ask)};
        const isBid = type === "bid";
        current.price = new Price({
            base: current[isBid ? "for_sale" : "to_receive"],
            quote: current[isBid ? "to_receive" : "for_sale"],
            real: parseFloat(e.target.value) || 0
        });

        if (isBid) {
            setForSaleHelper(current) || setReceiveHelper(current);
        } else {
            setReceiveHelper(current) || setForSaleHelper(current);
        }

        current.priceText = e.target.value;
        if (isBid) setBid(current);
        else setAsk(current);
    };

    const onInputSell = (type: "bid" | "ask", isBid: boolean, e: any) => {
        const current = {...(type === "bid" ? bid : ask)};
        current.for_sale.setAmount({real: parseFloat(e.target.value) || 0});
        if (current.price.isValid()) {
            setReceiveHelper(current);
        } else {
            setPriceHelper(current);
        }

        current.forSaleText = e.target.value;
        setPriceTextHelper(current, type === "bid");

        if (type === "bid") setBid(current);
        else setAsk(current);
    };

    const onInputReceive = (type: "bid" | "ask", isBid: boolean, e: any) => {
        const current = {...(type === "bid" ? bid : ask)};
        current.to_receive.setAmount({real: parseFloat(e.target.value) || 0});

        if (current.price.isValid()) {
            setForSaleHelper(current);
        } else {
            setPriceHelper(current);
        }

        current.toReceiveText = e.target.value;
        setPriceTextHelper(current, type === "bid");
        if (type === "bid") setBid(current);
        else setAsk(current);
    };

    const isMarketFrozen = () => {
        const baseWhiteList = baseAsset
            .getIn(["options", "whitelist_markets"])
            .toJS();
        const quoteWhiteList = quoteAsset
            .getIn(["options", "whitelist_markets"])
            .toJS();
        const baseBlackList = baseAsset
            .getIn(["options", "blacklist_markets"])
            .toJS();
        const quoteBlackList = quoteAsset
            .getIn(["options", "blacklist_markets"])
            .toJS();

        if (
            quoteWhiteList.length &&
            quoteWhiteList.indexOf(baseAsset.get("id")) === -1
        ) {
            return {isFrozen: true};
        }
        if (
            baseWhiteList.length &&
            baseWhiteList.indexOf(quoteAsset.get("id")) === -1
        ) {
            return {isFrozen: true};
        }

        if (
            quoteBlackList.length &&
            quoteBlackList.indexOf(baseAsset.get("id")) !== -1
        ) {
            return {isFrozen: true};
        }
        if (
            baseBlackList.length &&
            baseBlackList.indexOf(quoteAsset.get("id")) !== -1
        ) {
            return {isFrozen: true};
        }

        return {isFrozen: false};
    };

    const onChangeMobilePanel = (val: string[]) => setMobileKey(val);

    const {isFrozen} = isMarketFrozen();

    let centerContainerWidth = width;
    if (centerRef.current) {
        centerContainerWidth = centerRef.current.clientWidth;
    }

    let base: any = null,
        quote: any = null,
        accountBalance: any = null,
        quoteBalance: any = null,
        baseBalance: any = null,
        coreBalance: any = null,
        quoteSymbol,
        baseSymbol,
        showCallLimit = false,
        latest: any,
        changeClass: any;

    const showVolumeChart = viewSettings.get("showVolumeChart", true);

    const smallScreen = width < 850 ? true : false;
    const tinyScreen = width < 640 ? true : false;

    const effectiveHideScrollbars = tinyScreen ? true : hideScrollbars;

    if (quoteAsset.size && baseAsset.size && currentAccount.size) {
        base = baseAsset;
        quote = quoteAsset;
        baseSymbol = base.get("symbol");
        quoteSymbol = quote.get("symbol");

        accountBalance = currentAccount.get("balances").toJS();

        if (accountBalance) {
            for (const id in accountBalance) {
                if (id === quote.get("id")) {
                    quoteBalance = accountBalance[id];
                }
                if (id === base.get("id")) {
                    baseBalance = accountBalance[id];
                }
                if (id === "1.3.0") {
                    coreBalance = accountBalance[id];
                }
            }
        }

        showCallLimit = getSettlementInfo();
    }

    const quoteIsBitAsset = quoteAsset.get("bitasset_data_id") ? true : false;
    const baseIsBitAsset = baseAsset.get("bitasset_data_id") ? true : false;

    const {
        combinedBids,
        combinedAsks,
        lowestAsk,
        highestBid,
        flatBids,
        flatAsks,
        flatCalls,
        flatSettles,
        groupedBids,
        groupedAsks
    } = marketData;

    const spread =
        lowestAsk && highestBid ? lowestAsk.getPrice() - highestBid.getPrice() : 0;

    if (activeMarketHistory.size) {
        const latest_two = activeMarketHistory.take(2);
        latest = latest_two.first();
        const second_latest = latest_two.last();

        changeClass =
            latest.getPrice() === second_latest.getPrice()
                ? ""
                : latest.getPrice() - second_latest.getPrice() > 0
                ? "change-up"
                : "change-down";
    }

    if (!coreAsset || !Object.keys(feeStatus).length) {
        return null;
    }

    const {
        sellFeeAsset,
        sellFeeAssets,
        sellFee,
        buyFeeAsset,
        buyFeeAssets,
        buyFee
    } = getFeeAssets(quote, base, coreAsset);

    const hasPrediction =
        base.getIn(["bitasset", "is_prediction_market"]) ||
        quote.getIn(["bitasset", "is_prediction_market"]);

    const minChartHeight = 300;
    const thisChartHeight = Math.max(
        height > 1100 ? chartHeight : chartHeight - 125,
        minChartHeight
    );

    const isPanelActive = activePanels.length >= 1 ? true : false;
    const isPredictionMarket = base.getIn(["bitasset", "is_prediction_market"]);

    let actionCardIndex = 0;

    const buySellTitle = (isBidTitle: boolean) => {
        return (
            <div className="exchange-content-header">
                <TranslateWithLinks
                    string="exchange.buysell_formatter"
                    noLink
                    noTip
                    keys={[
                        {
                            type: "asset",
                            value: quoteAsset.get("symbol"),
                            arg: "asset"
                        },
                        {
                            type: "translate",
                            value: isBidTitle ? "exchange.buy" : "exchange.sell",
                            arg: "direction"
                        }
                    ]}
                />
            </div>
        );
    };

    const buyForm =
        isFrozen ? null : tinyScreen && !mobileKey.includes("buySellTab") ? null : (
            <Tabs
                animated={false}
                activeKey={viewSettings.get("order-form-bid") || "limit"}
                onChange={(value: any) =>
                    handleOrderTypeTabChange("bid", value)
                }
                tabBarExtraContent={<div>{buySellTitle(true)}</div>}
                defaultActiveKey={"limit"}
                className={cnames(
                    "exchange--buy-sell-form",
                    verticalOrderForm && !smallScreen
                        ? ""
                        : centerContainerWidth > 1200
                        ? "medium-6 large-6 xlarge-4"
                        : centerContainerWidth > 800
                        ? "medium-6"
                        : "",
                    "small-12 exchange-padded middle-content",
                    flipBuySell
                        ? `order-${buySellTop ? 2 : 3} large-order-${
                              buySellTop ? 2 : 5
                          } sell-form`
                        : `order-${buySellTop ? 1 : 2} large-order-${
                              buySellTop ? 1 : 4
                          } buy-form`
                )}
            >
                <Tabs.TabPane
                    tab={counterpart.translate("exchange.limit")}
                    key={"limit"}
                >
                    <BuySell
                        key={`actionCard_${actionCardIndex++}`}
                        onBorrow={baseIsBitAsset ? borrowBase : null}
                        onBuy={() => onBuy("bid")}
                        onDeposit={() => onDeposit("bid")}
                        currentAccount={currentAccount}
                        backedCoin={backedCoins.find(
                            (a: any) => a.symbol === base.get("symbol")
                        )}
                        currentBridges={
                            bridgeCoins.get(base.get("symbol")) || null
                        }
                        isOpen={buySellOpen}
                        parentWidth={centerContainerWidth}
                        styles={{
                            padding: 5,
                            paddingRight: mirrorPanels ? 15 : 5
                        }}
                        type="bid"
                        hideHeader={true}
                        expirationType={expirationType["bid"]}
                        expirations={EXPIRATIONS}
                        expirationCustomTime={expirationCustomTime["bid"]}
                        onExpirationTypeChange={(e: any) =>
                            handleExpirationChange("bid", e)
                        }
                        onExpirationCustomChange={(time: any) =>
                            handleCustomExpirationChange("bid", time)
                        }
                        amount={numberExponentToLarge(bid.toReceiveText)}
                        price={numberExponentToLarge(bid.priceText)}
                        total={numberExponentToLarge(bid.forSaleText)}
                        quote={quote}
                        base={base}
                        amountChange={(e: any) => onInputReceive("bid", true, e)}
                        priceChange={(e: any) => onInputPrice("bid", e)}
                        setPrice={(price: any) => currentPriceClick("bid", price)}
                        totalChange={(e: any) => onInputSell("bid", false, e)}
                        balance={baseBalance}
                        balanceId={base.get("id")}
                        onSubmit={(short: boolean, e: any) =>
                            createLimitOrderConfirm(
                                quote,
                                base,
                                baseBalance,
                                coreBalance,
                                buyFeeAsset,
                                "buy",
                                short,
                                e
                            )
                        }
                        balancePrecision={base.get("precision")}
                        currentPrice={lowestAsk.getPrice()}
                        currentPriceObject={lowestAsk}
                        account={currentAccount.get("name")}
                        fee={buyFee}
                        hasFeeBalance={feeStatus[buyFee.asset_id].hasBalance}
                        feeAssets={buyFeeAssets}
                        feeAsset={buyFeeAsset}
                        onChangeFeeAsset={(value: any) =>
                            onChangeFeeAsset("buy", value)
                        }
                        isPredictionMarket={base.getIn([
                            "bitasset",
                            "is_prediction_market"
                        ])}
                        onFlip={!flipBuySell ? flipBuySellToggle : undefined}
                        onTogglePosition={
                            buySellTop && !verticalOrderBook
                                ? toggleBuySellPosition
                                : undefined
                        }
                        moveOrderForm={
                            !smallScreen && (!flipBuySell || verticalOrderForm)
                                ? moveOrderForm
                                : undefined
                        }
                        verticalOrderForm={!smallScreen ? verticalOrderForm : false}
                        singleColumnOrderForm={singleColumnOrderForm}
                        hideFunctionButtons={hideFunctionButtons}
                    />
                </Tabs.TabPane>
                <Tabs.TabPane
                    tab={counterpart.translate("exchange.scaled")}
                    key={"scaled"}
                >
                    <ScaledOrderTab
                        expirationType={expirationType["bid"]}
                        expirations={EXPIRATIONS}
                        expirationCustomTime={expirationCustomTime["bid"]}
                        onExpirationTypeChange={(e: any) =>
                            handleExpirationChange("bid", e)
                        }
                        onExpirationCustomChange={(time: any) =>
                            handleCustomExpirationChange("bid", time)
                        }
                        currentPrice={lowestAsk.getPrice()}
                        lastClickedPrice={ask && ask.priceText}
                        currentAccount={currentAccount}
                        createScaledOrder={createScaledOrder}
                        type={"bid"}
                        quoteAsset={quote}
                        baseAsset={base}
                    />
                </Tabs.TabPane>
            </Tabs>
        );

    const sellForm =
        isFrozen ? null : tinyScreen && !mobileKey.includes("buySellTab") ? null : (
            <Tabs
                activeKey={viewSettings.get("order-form-ask") || "limit"}
                onChange={(value: any) =>
                    handleOrderTypeTabChange("ask", value)
                }
                animated={false}
                tabBarExtraContent={<div>{buySellTitle(false)}</div>}
                defaultActiveKey={"limit"}
                className={cnames(
                    "exchange--buy-sell-form",
                    verticalOrderForm && !smallScreen
                        ? ""
                        : centerContainerWidth > 1200
                        ? "medium-6 large-6 xlarge-4"
                        : centerContainerWidth > 800
                        ? "medium-6"
                        : "",
                    "small-12 exchange-padded middle-content",
                    flipBuySell
                        ? `order-${buySellTop ? 1 : 2} large-order-${
                              buySellTop ? 1 : 4
                          } buy-form`
                        : `order-${buySellTop ? 2 : 3} large-order-${
                              buySellTop ? 2 : 5
                          } sell-form`
                )}
            >
                <Tabs.TabPane
                    tab={counterpart.translate("exchange.limit")}
                    key={"limit"}
                >
                    <BuySell
                        key={`actionCard_${actionCardIndex++}`}
                        onBorrow={quoteIsBitAsset ? borrowQuote : null}
                        onBuy={() => onBuy("ask")}
                        onDeposit={() => onDeposit("ask")}
                        currentAccount={currentAccount}
                        backedCoin={backedCoins.find(
                            (a: any) => a.symbol === quote.get("symbol")
                        )}
                        currentBridges={
                            bridgeCoins.get(quote.get("symbol")) || null
                        }
                        isOpen={buySellOpen}
                        parentWidth={centerContainerWidth}
                        styles={{
                            padding: 5,
                            paddingRight: mirrorPanels ? 15 : 5
                        }}
                        type="ask"
                        hideHeader={true}
                        amount={numberExponentToLarge(ask.forSaleText)}
                        price={numberExponentToLarge(ask.priceText)}
                        total={numberExponentToLarge(ask.toReceiveText)}
                        quote={quote}
                        base={base}
                        expirationType={expirationType["ask"]}
                        expirations={EXPIRATIONS}
                        expirationCustomTime={expirationCustomTime["ask"]}
                        onExpirationTypeChange={(e: any) =>
                            handleExpirationChange("ask", e)
                        }
                        onExpirationCustomChange={(time: any) =>
                            handleCustomExpirationChange("ask", time)
                        }
                        amountChange={(e: any) => onInputSell("ask", false, e)}
                        priceChange={(e: any) => onInputPrice("ask", e)}
                        setPrice={(price: any) => currentPriceClick("ask", price)}
                        totalChange={(e: any) => onInputReceive("ask", true, e)}
                        balance={quoteBalance}
                        balanceId={quote.get("id")}
                        onSubmit={(short: boolean, e: any) =>
                            createLimitOrderConfirm(
                                base,
                                quote,
                                quoteBalance,
                                coreBalance,
                                sellFeeAsset,
                                "sell",
                                short,
                                e
                            )
                        }
                        balancePrecision={quote.get("precision")}
                        currentPrice={highestBid.getPrice()}
                        currentPriceObject={highestBid}
                        account={currentAccount.get("name")}
                        fee={sellFee}
                        hasFeeBalance={feeStatus[sellFee.asset_id].hasBalance}
                        feeAssets={sellFeeAssets}
                        feeAsset={sellFeeAsset}
                        onChangeFeeAsset={(value: any) =>
                            onChangeFeeAsset("sell", value)
                        }
                        isPredictionMarket={quote.getIn([
                            "bitasset",
                            "is_prediction_market"
                        ])}
                        onFlip={flipBuySell ? flipBuySellToggle : undefined}
                        onTogglePosition={
                            buySellTop && !verticalOrderBook
                                ? toggleBuySellPosition
                                : undefined
                        }
                        moveOrderForm={
                            !smallScreen && (flipBuySell || verticalOrderForm)
                                ? moveOrderForm
                                : undefined
                        }
                        verticalOrderForm={!smallScreen ? verticalOrderForm : false}
                        singleColumnOrderForm={singleColumnOrderForm}
                        hideFunctionButtons={hideFunctionButtons}
                    />
                </Tabs.TabPane>

                <Tabs.TabPane
                    tab={counterpart.translate("exchange.scaled")}
                    key={"scaled"}
                >
                    <ScaledOrderTab
                        expirationType={expirationType["ask"]}
                        expirations={EXPIRATIONS}
                        expirationCustomTime={expirationCustomTime["ask"]}
                        onExpirationTypeChange={(e: any) =>
                            handleExpirationChange("ask", e)
                        }
                        onExpirationCustomChange={(time: any) =>
                            handleCustomExpirationChange("ask", time)
                        }
                        currentPrice={highestBid.getPrice()}
                        lastClickedPrice={ask && ask.priceText}
                        currentAccount={currentAccount}
                        createScaledOrder={createScaledOrder}
                        type="ask"
                        baseAsset={base}
                        quoteAsset={quote}
                    />
                </Tabs.TabPane>
            </Tabs>
        );

    const myMarkets =
        tinyScreen && !mobileKey.includes("myMarkets") ? null : (
            <MyMarkets
                key={`actionCard_${actionCardIndex++}`}
                className="left-order-book no-overflow order-9"
                style={{
                    minWidth: 350,
                    height: smallScreen ? 680 : "calc(100vh - 215px)",
                    padding: smallScreen ? 10 : 0
                }}
                headerStyle={{
                    width: "100%",
                    display: !smallScreen ? "display: none" : ""
                }}
                noHeader={true}
                listHeight={height - 450}
                columns={[
                    {name: "star", index: 1},
                    {name: "market", index: 2},
                    {name: "vol", index: 3},
                    {name: "price", index: 4},
                    {name: "change", index: 5}
                ]}
                findColumns={[
                    {name: "market", index: 1},
                    {name: "issuer", index: 2},
                    {name: "vol", index: 3},
                    {name: "add", index: 4}
                ]}
                current={`${quoteSymbol}_${baseSymbol}`}
                activeTab={tabVerticalPanel ? tabVerticalPanel : "my-market"}
            />
        );

    const orderBook =
        tinyScreen && !mobileKey.includes("orderBook") ? null : (
            <OrderBook
                ref={orderBookRef}
                key={`actionCard_${actionCardIndex++}`}
                latest={latest && latest.getPrice()}
                changeClass={changeClass}
                orders={marketLimitOrders}
                calls={marketCallOrders}
                invertedCalls={invertedCalls}
                combinedBids={combinedBids}
                combinedAsks={combinedAsks}
                highestBid={highestBid}
                lowestAsk={lowestAsk}
                totalBids={totals.bid}
                totalAsks={totals.ask}
                base={base}
                quote={quote}
                baseSymbol={baseSymbol as string}
                quoteSymbol={quoteSymbol as string}
                onClick={orderbookClick}
                horizontal={!verticalOrderBook || smallScreen ? true : false}
                flipOrderBook={flipOrderBook}
                orderBookReversed={orderBookReversed}
                marketReady={marketReady}
                wrapperClass={cnames(
                    centerContainerWidth > 1200
                        ? "xlarge-8"
                        : centerContainerWidth > 800
                        ? ""
                        : "",
                    "medium-12 large-12",
                    "small-12 grid-block orderbook no-padding align-spaced no-overflow wrap shrink",
                    `order-${buySellTop ? 3 : 1} xlarge-order-${
                        buySellTop ? 4 : 1
                    }`
                )}
                innerClass={cnames(
                    centerContainerWidth > 1200
                        ? "medium-6"
                        : centerContainerWidth > 800
                        ? "medium-6 large-6"
                        : "",
                    "small-12 middle-content",
                    !tinyScreen ? "exchange-padded" : ""
                )}
                currentAccount={currentAccount.get("id")}
                handleGroupOrderLimitChange={onGroupOrderLimitChange}
                trackedGroupsConfig={trackedGroupsConfig}
                currentGroupOrderLimit={currentGroupOrderLimit}
                groupedBids={groupedBids}
                groupedAsks={groupedAsks}
                isPanelActive={activePanels.length >= 1}
                onTogglePosition={
                    !buySellTop ? toggleBuySellPosition : undefined
                }
                moveOrderBook={!smallScreen ? moveOrderBook : undefined}
                smallScreen={smallScreen}
                hideScrollbars={effectiveHideScrollbars}
                autoScroll={autoScroll}
                onFlipOrderBook={flipOrderBookToggle}
                hideFunctionButtons={hideFunctionButtons}
            />
        );

    let panelWidth = 350;

    if (
        orderBookRef.current &&
        orderBookRef.current.verticalStickyTable &&
        orderBookRef.current.verticalStickyTable.current &&
        orderBookRef.current.verticalStickyTable.current.scrollData
    ) {
        panelWidth = orderBookRef.current.verticalStickyTable.current.scrollData
            .scrollWidth;
    }

    const marketHistory =
        tinyScreen && !mobileKey.includes("marketHistory") ? null : (
            <MarketHistory
                key={`actionCard_${actionCardIndex++}`}
                className={cnames(
                    panelTabs["history"] == 0
                        ? centerContainerWidth > 1200
                            ? "medium-6 large-6 xlarge-4"
                            : centerContainerWidth > 800
                            ? "medium-6"
                            : ""
                        : "medium-12",
                    "no-padding no-overflow middle-content small-12 order-6"
                )}
                innerClass={!tinyScreen ? "exchange-padded" : ""}
                innerStyle={{paddingBottom: !tinyScreen ? "1.2rem" : "0"}}
                noHeader={panelTabs["history"] == 0 ? false : true}
                history={activeMarketHistory}
                currentAccount={currentAccount}
                myHistory={currentAccount.get("history")}
                base={base}
                quote={quote}
                baseSymbol={baseSymbol}
                quoteSymbol={quoteSymbol}
                activeTab={"history"}
                tinyScreen={tinyScreen}
                isPanelActive={isPanelActive}
                hideScrollbars={effectiveHideScrollbars}
            />
        );

    const myMarketHistory =
        tinyScreen && !mobileKey.includes("myMarketHistory") ? null : (
            <MarketHistory
                key={`actionCard_${actionCardIndex++}`}
                className={cnames(
                    panelTabs["my_history"] == 0
                        ? centerContainerWidth > 1200
                            ? "medium-6 large-6 xlarge-4"
                            : centerContainerWidth > 800
                            ? "medium-6"
                            : ""
                        : "medium-12",
                    "no-padding no-overflow middle-content small-12",
                    verticalOrderBook || verticalOrderForm ? "order-4" : "order-3"
                )}
                innerClass={!tinyScreen ? "exchange-padded" : ""}
                innerStyle={{paddingBottom: !tinyScreen ? "1.2rem" : "0"}}
                noHeader={panelTabs["my_history"] == 0 ? false : true}
                history={activeMarketHistory}
                currentAccount={currentAccount}
                myHistory={currentAccount.get("history")}
                base={base}
                quote={quote}
                baseSymbol={baseSymbol}
                quoteSymbol={quoteSymbol}
                activeTab={"my_history"}
                tinyScreen={tinyScreen}
                isPanelActive={isPanelActive}
                hideScrollbars={effectiveHideScrollbars}
            />
        );

    const myOpenOrders =
        tinyScreen && !mobileKey.includes("myOpenOrders") ? null : (
            <MarketOrders
                key={`actionCard_${actionCardIndex++}`}
                style={{marginBottom: !tinyScreen ? 15 : 0}}
                className={cnames(
                    panelTabs["my_orders"] == 0
                        ? centerContainerWidth > 1200
                            ? "medium-6 large-6 xlarge-4"
                            : centerContainerWidth > 800
                            ? "medium-6"
                            : ""
                        : "medium-12",
                    "no-padding no-overflow middle-content small-12 order-7"
                )}
                innerClass={!tinyScreen ? "exchange-padded" : ""}
                innerStyle={{paddingBottom: !tinyScreen ? "1.2rem" : "0"}}
                noHeader={panelTabs["my_orders"] == 0 ? false : true}
                orders={marketLimitOrders}
                settleOrders={marketSettleOrders}
                currentAccount={currentAccount}
                base={base}
                quote={quote}
                baseSymbol={baseSymbol as string}
                quoteSymbol={quoteSymbol as string}
                activeTab={"my_orders"}
                onCancel={cancelLimitOrder}
                flipMyOrders={viewSettings.get("flipMyOrders")}
                feedPrice={feedPrice}
                smallScreen={smallScreen}
                tinyScreen={tinyScreen}
                hidePanel={hidePanel}
                isPanelActive={isPanelActive}
                hideScrollbars={effectiveHideScrollbars}
            />
        );

    const settlementOrders =
        marketSettleOrders.size === 0 ||
        (tinyScreen && !mobileKey.includes("settlementOrders")) ? null : (
            <MarketOrders
                key={`actionCard_${actionCardIndex++}`}
                style={{marginBottom: !tinyScreen ? 15 : 0}}
                className={cnames(
                    panelTabs["open_settlement"] == 0
                        ? centerContainerWidth > 1200
                            ? "medium-6 large-6 xlarge-4"
                            : centerContainerWidth > 800
                            ? "medium-6"
                            : ""
                        : "medium-12",
                    "no-padding no-overflow middle-content small-12 order-8"
                )}
                innerClass={!tinyScreen ? "exchange-padded" : ""}
                innerStyle={{paddingBottom: !tinyScreen ? "1.2rem" : "0"}}
                noHeader={panelTabs["open_settlement"] == 0 ? false : true}
                orders={marketLimitOrders}
                settleOrders={marketSettleOrders}
                currentAccount={currentAccount}
                base={base}
                quote={quote}
                baseSymbol={baseSymbol as string}
                quoteSymbol={quoteSymbol as string}
                activeTab={"open_settlement"}
                onCancel={cancelLimitOrder}
                flipMyOrders={viewSettings.get("flipMyOrders")}
                feedPrice={feedPrice}
                smallScreen={smallScreen}
                tinyScreen={tinyScreen}
                hidePanel={hidePanel}
                isPanelActive={isPanelActive}
                hideScrollbars={effectiveHideScrollbars}
            />
        );

    const tradingViewChart =
        (!tinyScreen && !(chartType == "price_chart")) ||
        (tinyScreen && !mobileKey.includes("tradingViewChart")) ? null : (
            <TradingViewPriceChart
                locale={props.locale}
                dataFeed={props.dataFeed}
                baseSymbol={baseSymbol}
                quoteSymbol={quoteSymbol}
                marketReady={marketReady}
                theme={settings.get("themes")}
                buckets={buckets}
                bucketSize={bucketSize}
                currentPeriod={currentPeriod}
                chartHeight={thisChartHeight}
                chartZoom={tinyScreen ? false : chartZoom}
                chartTools={tinyScreen ? false : chartTools}
                mobile={tinyScreen}
            />
        );

    const deptHighChart =
        (!tinyScreen && !(chartType == "market_depth")) ||
        (tinyScreen && !mobileKey.includes("deptHighChart")) ? null : (
            <DepthHighChart
                marketReady={marketReady}
                orders={marketLimitOrders}
                showCallLimit={showCallLimit}
                call_orders={marketCallOrders}
                flat_asks={flatAsks}
                flat_bids={flatBids}
                flat_calls={showCallLimit ? flatCalls : []}
                flat_settles={settings.get("showSettles") && flatSettles}
                settles={marketSettleOrders}
                invertedCalls={invertedCalls}
                totalBids={totals.bid}
                totalAsks={totals.ask}
                base={base}
                quote={quote}
                height={thisChartHeight}
                isPanelActive={isPanelActive}
                onClick={(chartEvent: any) =>
                    depthChartClick(base, quote, chartEvent)
                }
                feedPrice={!hasPrediction && feedPrice && feedPrice.toReal()}
                spread={spread}
                LCP={showCallLimit ? lowestCallPrice : null}
                hasPrediction={hasPrediction}
                noFrame={false}
                theme={settings.get("themes")}
                centerRef={centerRef.current}
                activePanels={activePanels}
            />
        );

    const tradingChartHeader = (
        <div
            className={"exchange--chart-control"}
            style={{
                height: 33,
                right: chartType == "price_chart" ? "6rem" : "15rem",
                top: "1px",
                position: "absolute",
                zIndex: 1,
                padding: "0.2rem"
            }}
        >
            {chartType == "price_chart" && (
                <Tooltip
                    title={counterpart.translate(
                        "exchange.settings.tooltip.chart_tools"
                    )}
                >
                    <AntIcon
                        style={{
                            cursor: "pointer",
                            fontSize: "1.4rem",
                            marginRight: "0.6rem"
                        }}
                        onClick={chartToolsToggle}
                        type="tool"
                    />
                </Tooltip>
            )}
            <Tooltip
                title={counterpart.translate(
                    "exchange.settings.tooltip.increase_chart_height"
                )}
            >
                <AntIcon
                    style={{
                        cursor: "pointer",
                        fontSize: "1.4rem",
                        marginRight: "0.6rem"
                    }}
                    onClick={() => {
                        onChangeChartHeight({increase: true});
                    }}
                    type={"up"}
                />
            </Tooltip>
            <Tooltip
                title={counterpart.translate(
                    "exchange.settings.tooltip.decrease_chart_height"
                )}
            >
                <AntIcon
                    style={{
                        cursor: "pointer",
                        fontSize: "1.4rem",
                        marginRight: "0.6rem"
                    }}
                    onClick={() => {
                        onChangeChartHeight({increase: false});
                    }}
                    type={"down"}
                />
            </Tooltip>
            <Tooltip
                title={
                    chartType == "market_depth"
                        ? counterpart.translate(
                              "exchange.settings.tooltip.show_price_chart"
                          )
                        : counterpart.translate(
                              "exchange.settings.tooltip.show_market_depth"
                          )
                }
            >
                <AntIcon
                    style={{
                        cursor: "pointer",
                        fontSize: "1.4rem"
                    }}
                    onClick={() => {
                        if (chartType == "market_depth") {
                            toggleChart("price_chart");
                        } else {
                            toggleChart("market_depth");
                        }
                    }}
                    type={chartType == "market_depth" ? "bar-chart" : "area-chart"}
                />
            </Tooltip>
        </div>
    );

    const buySellTab = (
        <div
            key={`actionCard_${actionCardIndex++}`}
            className={"left-order-book small-12"}
            style={{
                paddingLeft: 5,
                width: !smallScreen ? 300 : "auto"
            }}
        >
            <Tabs
                defaultActiveKey="buy"
                activeKey={tabBuySell}
                onChange={(tab: any) => {
                    setTabBuySell(tab);
                    SettingsActions.changeViewSetting({
                        tabBuySell: tab
                    } as any);
                }}
                style={{
                    padding: "0px !important",
                    margin: "0px !important"
                }}
            >
                <Tabs.TabPane
                    tab={
                        <TranslateWithLinks
                            string="exchange.buysell_formatter"
                            noLink
                            noTip={false}
                            keys={[
                                {
                                    type: "asset",
                                    value: quote.get("symbol"),
                                    arg: "asset"
                                },
                                {
                                    type: "translate",
                                    value: isPredictionMarket
                                        ? "exchange.short"
                                        : "exchange.buy",
                                    arg: "direction"
                                }
                            ]}
                        />
                    }
                    key="buy"
                >
                    {buyForm}
                </Tabs.TabPane>
                <Tabs.TabPane
                    tab={
                        <TranslateWithLinks
                            string="exchange.buysell_formatter"
                            noLink
                            noTip={false}
                            keys={[
                                {
                                    type: "asset",
                                    value: quote.get("symbol"),
                                    arg: "asset"
                                },
                                {
                                    type: "translate",
                                    value: isPredictionMarket
                                        ? "exchange.short"
                                        : "exchange.sell",
                                    arg: "direction"
                                }
                            ]}
                        />
                    }
                    key="sell"
                >
                    {sellForm}
                </Tabs.TabPane>
            </Tabs>
        </div>
    );

    const groupTabs: any = {1: [], 2: []};
    const groupStandalone: any[] = [];

    Object.keys(panelTabs)
        .sort()
        .map(a => {
            if (panelTabs[a] == 0) {
                if (a == "my_history") {
                    groupStandalone.push(myMarketHistory);
                }
                if (a == "history") {
                    groupStandalone.push(marketHistory);
                }
                if (a == "my_orders") {
                    groupStandalone.push(myOpenOrders);
                }
                if (a == "open_settlement" && settlementOrders !== null) {
                    groupStandalone.push(settlementOrders);
                }
            } else {
                if (a == "my_history") {
                    groupTabs[panelTabs[a]].push(
                        <Tabs.TabPane
                            tab={translator.translate("exchange.my_history")}
                            key="my_history"
                        >
                            {myMarketHistory}
                        </Tabs.TabPane>
                    );
                }
                if (a == "history") {
                    groupTabs[panelTabs[a]].push(
                        <Tabs.TabPane
                            tab={translator.translate("exchange.history")}
                            key="history"
                        >
                            {marketHistory}
                        </Tabs.TabPane>
                    );
                }
                if (a == "my_orders") {
                    groupTabs[panelTabs[a]].push(
                        <Tabs.TabPane
                            tab={translator.translate("exchange.my_orders")}
                            key="my_orders"
                        >
                            {myOpenOrders}
                        </Tabs.TabPane>
                    );
                }
                if (a == "open_settlement" && settlementOrders !== null) {
                    groupTabs[panelTabs[a]].push(
                        <Tabs.TabPane
                            tab={translator.translate(
                                "exchange.settle_orders"
                            )}
                            key="open_settlement"
                        >
                            {settlementOrders}
                        </Tabs.TabPane>
                    );
                }
            }
        });

    Object.keys(panelTabsActive).map(thisTabsId => {
        Object.keys(panelTabs).map(thisPanelName => {
            let stop = false;
            if (!stop && thisTabsId == panelTabs[thisPanelName]) {
                panelTabsActive[thisTabsId] = !panelTabsActive[thisTabsId]
                    ? thisPanelName
                    : panelTabsActive[thisTabsId];
                stop = true;
            }
        });
    });

    let groupTabsCount = groupStandalone.length;

    Object.keys(groupTabs).map(tab => {
        if (groupTabs[tab].length) {
            groupTabsCount++;
        }
    });

    const setPanelTabInGroup = (group: number, activetab: string) => {
        const newPanelTabsActive = {...panelTabsActive};
        Object.keys(newPanelTabsActive).map(a => {
            if (a == String(group)) {
                newPanelTabsActive[a] = activetab;
            }
        });
        setPanelTabsActive(newPanelTabsActive);
        SettingsActions.changeViewSetting({
            panelTabsActive: newPanelTabsActive
        } as any);
    };

    const groupTabbed1 =
        groupTabs[1].length > 0 ? (
            <div
                key={`actionCard_${actionCardIndex++}`}
                className={cnames(
                    centerContainerWidth > 1200
                        ? groupTabsCount == 1
                            ? "medium-12 xlarge-4"
                            : "medium-6 xlarge-4 "
                        : centerContainerWidth > 800
                        ? groupTabsCount == 1
                            ? "medium-12"
                            : "medium-6"
                        : "",
                    "small-12 order-5",
                    verticalOrderBook ? "xlarge-order-5" : "",
                    !verticalOrderBook && !verticalOrderForm
                        ? centerContainerWidth < 1200
                            ? "xlarge-order-5"
                            : "xlarge-order-2"
                        : ""
                )}
                style={{paddingRight: 5}}
            >
                <Tabs
                    activeKey={panelTabsActive[1]}
                    onChange={(tab: any) => setPanelTabInGroup(1, tab)}
                >
                    {groupTabs[1]}
                </Tabs>
            </div>
        ) : null;

    const groupTabbed2 =
        groupTabs[2].length > 0 ? (
            <div
                key={`actionCard_${actionCardIndex++}`}
                className={cnames(
                    centerContainerWidth > 1200
                        ? groupTabsCount == 1
                            ? "medium-12 xlarge-4"
                            : "medium-6 xlarge-4 "
                        : centerContainerWidth > 800
                        ? groupTabsCount == 1
                            ? "medium-12"
                            : "medium-6"
                        : "",
                    "small-12 order-6"
                )}
                style={{paddingRight: 5}}
            >
                <Tabs
                    activeKey={panelTabsActive[2]}
                    onChange={(tab: any) => setPanelTabInGroup(2, tab)}
                >
                    {groupTabs[2]}
                </Tabs>
            </div>
        ) : null;

    const emptyDiv =
        groupTabsCount > 2 ? null : (
            <div
                className={cnames(
                    centerContainerWidth > 1200 &&
                        (verticalOrderBook || verticalOrderBook)
                        ? "xlarge-order-6 xlarge-8 order-9"
                        : "",
                    "small-12 grid-block orderbook no-padding align-spaced no-overflow wrap"
                )}
                key={`actionCard_${actionCardIndex++}`}
            >
                &nbsp;
            </div>
        );

    let actionCards: any = [];
    if (!smallScreen) {
        if (!verticalOrderForm) {
            actionCards.push(buyForm);
            actionCards.push(sellForm);
        }

        if (!verticalOrderBook) {
            actionCards.push(orderBook);
        }

        if (verticalOrderBook || verticalOrderForm) {
            actionCards.push(emptyDiv);
        }

        actionCards.push(groupStandalone);
        actionCards.push(groupTabbed1);
        actionCards.push(groupTabbed2);
    } else if (!tinyScreen) {
        actionCards.push(buyForm);
        actionCards.push(sellForm);
        actionCards.push(orderBook);
        actionCards.push(groupStandalone);
        actionCards.push(groupTabbed1);
        actionCards.push(groupTabbed2);
        actionCards.push(
            <div
                className="order-10 small-12"
                key={`actionCard_${actionCardIndex++}`}
            >
                <Tabs
                    defaultActiveKey="my-market"
                    activeKey={tabVerticalPanel}
                    onChange={(tab: any) => setTabVerticalPanelState(tab)}
                >
                    <Tabs.TabPane
                        tab={translator.translate("exchange.market_name")}
                        key="my-market"
                    />
                    <Tabs.TabPane
                        tab={translator.translate("exchange.more")}
                        key="find-market"
                    />
                </Tabs>
                {myMarkets}
            </div>
        );
    } else {
        actionCards = (
            <Collapse
                activeKey={mobileKey}
                onChange={(val: any) => onChangeMobilePanel(val)}
                style={{paddingRight: 8}}
            >
                <Collapse.Panel
                    header={translator.translate("exchange.price_history")}
                    key="tradingViewChart"
                >
                    {tradingViewChart}
                </Collapse.Panel>
                <Collapse.Panel
                    header={translator.translate("exchange.order_depth")}
                    key="deptHighChart"
                >
                    {deptHighChart}
                </Collapse.Panel>
                <Collapse.Panel
                    header={translator.translate("exchange.buy_sell")}
                    key="buySellTab"
                >
                    {buySellTab}
                </Collapse.Panel>
                <Collapse.Panel
                    header={translator.translate("exchange.order_book")}
                    key="orderBook"
                >
                    {orderBook}
                </Collapse.Panel>
                <Collapse.Panel
                    header={translator.translate("exchange.history")}
                    key="marketHistory"
                >
                    {marketHistory}
                </Collapse.Panel>
                {settlementOrders !== null ? (
                    <Collapse.Panel
                        header={translator.translate(
                            "exchange.settle_orders"
                        )}
                        key="settlementOrders"
                    >
                        {settlementOrders}
                    </Collapse.Panel>
                ) : null}
                <Collapse.Panel
                    header={translator.translate("exchange.my_history")}
                    key="myMarketHistory"
                >
                    {myMarketHistory}
                </Collapse.Panel>
                <Collapse.Panel
                    header={translator.translate("exchange.my_orders")}
                    key="myOpenOrders"
                >
                    {myOpenOrders}
                </Collapse.Panel>
                <Collapse.Panel
                    header={translator.translate("exchange.market_name")}
                    key="myMarkets"
                >
                    <Tabs
                        defaultActiveKey="my-market"
                        activeKey={tabVerticalPanel}
                        onChange={(tab: any) => setTabVerticalPanelState(tab)}
                    >
                        <Tabs.TabPane
                            tab={translator.translate("exchange.market_name")}
                            key="my-market"
                        />
                        <Tabs.TabPane
                            tab={translator.translate("exchange.more")}
                            key="find-market"
                        />
                    </Tabs>
                    {myMarkets}
                </Collapse.Panel>
            </Collapse>
        );
    }

    let leftPanel = null;
    let rightPanel = null;
    let leftPanelContainer = null;
    let rightPanelContainer = null;
    let enableToggleLeft = false;
    let enableToggleRight = false;

    if (!smallScreen) {
        if (verticalOrderBook) {
            leftPanel = (
                <div
                    className="left-order-book no-padding no-overflow"
                    style={{
                        display: "block",
                        height: "calc(100vh - 170px)",
                        width: panelWidth
                    }}
                >
                    {orderBook}
                </div>
            );
        }

        if (verticalOrderForm) {
            leftPanel = (
                <div
                    className="left-order-book no-padding no-overflow"
                    style={{
                        display: "block",
                        height: "calc(100vh - 170px)",
                        width: 300
                    }}
                >
                    {buySellTab}
                </div>
            );
        }

        rightPanel = (
            <div
                className="left-order-book no-padding no-overflow"
                style={{display: "block"}}
                key={`actionCard_${actionCardIndex++}`}
            >
                <div
                    className="v-align no-padding align-center grid-block footer shrink column"
                    data-intro={translator.translate("walkthrough.my_markets")}
                >
                    <Tabs
                        defaultActiveKey="my-market"
                        activeKey={tabVerticalPanel}
                        onChange={(tab: any) => setTabVerticalPanelState(tab)}
                    >
                        <Tabs.TabPane
                            tab={translator.translate("exchange.market_name")}
                            key="my-market"
                        />
                        <Tabs.TabPane
                            tab={translator.translate("exchange.more")}
                            key="find-market"
                        />
                    </Tabs>
                </div>
                {myMarkets}
            </div>
        );

        if ((!mirrorPanels && leftPanel) || (mirrorPanels && rightPanel)) {
            enableToggleLeft = true;
        }
        if ((!mirrorPanels && rightPanel) || (mirrorPanels && leftPanel)) {
            enableToggleRight = true;
        }

        leftPanelContainer = (
            <div className="grid-block left-column shrink no-overflow">
                {activePanels.includes("left")
                    ? mirrorPanels
                        ? rightPanel
                        : leftPanel
                    : null}
                {enableToggleLeft ? (
                    <div
                        style={{
                            width: "auto",
                            paddingTop: "calc(50vh - 80px)"
                        }}
                        onClick={() => togglePanel("left")}
                    >
                        <AntIcon
                            data-intro={translator.translate(
                                "walkthrough.panel_hide"
                            )}
                            type={
                                activePanels.includes("left")
                                    ? "caret-left"
                                    : "caret-right"
                            }
                        />
                    </div>
                ) : null}
            </div>
        );

        rightPanelContainer = (
            <div className="grid-block left-column shrink no-overflow">
                {enableToggleRight ? (
                    <div
                        style={{
                            width: "auto",
                            paddingTop: "calc(50vh - 80px)"
                        }}
                        onClick={() => togglePanel("right")}
                    >
                        <AntIcon
                            data-intro={translator.translate(
                                "walkthrough.panel_hide"
                            )}
                            type={
                                activePanels.includes("right")
                                    ? "caret-right"
                                    : "caret-left"
                            }
                        />
                    </div>
                ) : null}
                {activePanels.includes("right")
                    ? !mirrorPanels
                        ? rightPanel
                        : leftPanel
                    : null}
            </div>
        );
    }

    return (
        <div className="grid-block vertical">
            {!marketReady ? <LoadingIndicator /> : null}
            <ExchangeHeader
                hasAnyPriceAlert={hasAnyPriceAlert}
                showPriceAlertModal={showPriceAlertModal}
                account={currentAccount}
                quoteAsset={quoteAsset}
                baseAsset={baseAsset}
                hasPrediction={hasPrediction}
                starredMarkets={starredMarkets}
                lowestAsk={lowestAsk}
                highestBid={highestBid}
                lowestCallPrice={lowestCallPrice}
                showCallLimit={showCallLimit}
                feedPrice={feedPrice}
                marketReady={marketReady}
                latestPrice={latest && latest.getPrice()}
                marketStats={marketStats}
                selectedMarketPickerAsset={marketPickerAsset}
                onToggleMarketPicker={toggleMarketPicker}
                onTogglePersonalize={togglePersonalize}
                showVolumeChart={showVolumeChart}
            />

            <div className="grid-block page-layout market-layout">
                {isMarketPickerModalVisible || isMarketPickerModalLoaded ? (
                    <MarketPicker
                        visible={isMarketPickerModalVisible}
                        showModal={showMarketPickerModal}
                        hideModal={hideMarketPickerModal}
                        marketPickerAsset={marketPickerAsset}
                        onToggleMarketPicker={toggleMarketPicker}
                        {...props}
                    />
                ) : null}

                {isPersonalizeModalVisible || isPersonalizeModalLoaded ? (
                    <Personalize
                        visible={isPersonalizeModalVisible}
                        hideModal={hidePersonalizeModal}
                        viewSettings={viewSettings}
                        chartType={chartType}
                        chartHeight={chartHeight}
                        onChangeChartHeight={onChangeChartHeight}
                        handleGroupOrderLimitChange={onGroupOrderLimitChange}
                        trackedGroupsConfig={trackedGroupsConfig}
                        currentGroupOrderLimit={currentGroupOrderLimit}
                        verticalOrderBook={verticalOrderBook}
                        hideScrollbars={effectiveHideScrollbars}
                        mirrorPanels={mirrorPanels}
                        panelTabs={panelTabs}
                        singleColumnOrderForm={singleColumnOrderForm}
                        buySellTop={buySellTop}
                        flipBuySell={flipBuySell}
                        flipOrderBook={flipOrderBook}
                        tinyScreen={tinyScreen}
                        smallScreen={smallScreen}
                        orderBookReversed={orderBookReversed}
                        chartZoom={chartZoom}
                        chartTools={chartTools}
                        hideFunctionButtons={hideFunctionButtons}
                        onMoveOrderBook={moveOrderBook}
                        onMirrorPanels={mirrorPanelsToggle}
                        onToggleScrollbars={toggleScrollbars}
                        onSetAutoscroll={setAutoscroll}
                        onToggleChart={toggleChart}
                        onSetPanelTabs={() => {}}
                        onToggleSingleColumnOrderForm={
                            toggleSingleColumnOrderForm
                        }
                        onToggleBuySellPosition={toggleBuySellPosition}
                        onFlipBuySell={flipBuySellToggle}
                        onFlipOrderBook={flipOrderBookToggle}
                        onOrderBookReversed={orderBookReversedToggle}
                        onChartZoom={chartZoomToggle}
                        onChartTools={chartToolsToggle}
                        onHideFunctionButtons={hideFunctionButtonsToggle}
                    />
                ) : null}

                <AccountNotifications />

                {leftPanelContainer}

                <div
                    style={{paddingTop: 0}}
                    className={cnames("grid-block main-content vertical no-overflow")}
                >
                    <div
                        className="grid-block vertical no-padding ps-container"
                        id="CenterContent"
                        ref={centerRef}
                        data-intro={
                            tinyScreen
                                ? translator.translate(
                                      "walkthrough.collapsed_items"
                                  )
                                : null
                        }
                    >
                        {!tinyScreen ? (
                            <div>
                                {tradingChartHeader}
                                {chartType && chartType == "price_chart" ? (
                                    <div
                                        className="grid-block shrink no-overflow"
                                        id="market-charts"
                                    >
                                        {tradingViewChart}
                                    </div>
                                ) : null}

                                {chartType && chartType == "market_depth" ? (
                                    <div className="grid-block vertical no-padding shrink">
                                        {deptHighChart}
                                    </div>
                                ) : null}
                            </div>
                        ) : null}

                        <div className="grid-block no-overflow wrap shrink">
                            {actionCards}
                        </div>
                    </div>
                </div>

                {rightPanelContainer}
            </div>

            {quoteIsBitAsset &&
            (isBorrowQuoteModalVisible || isBorrowQuoteModalLoaded) ? (
                <BorrowModal
                    visible={isBorrowQuoteModalVisible}
                    hideModal={hideBorrowQuoteModal}
                    quoteAssetObj={quoteAsset.get("id")}
                    backingAssetObj={quoteAsset.getIn([
                        "bitasset",
                        "options",
                        "short_backing_asset"
                    ])}
                    accountObj={currentAccount}
                />
            ) : null}
            {baseIsBitAsset &&
            (isBorrowBaseModalVisible || isBorrowBaseModalLoaded) ? (
                <BorrowModal
                    visible={isBorrowBaseModalVisible}
                    hideModal={hideBorrowBaseModal}
                    quoteAssetObj={baseAsset.get("id")}
                    backingAssetObj={baseAsset.getIn([
                        "bitasset",
                        "options",
                        "short_backing_asset"
                    ])}
                    accountObj={currentAccount}
                />
            ) : null}

            {isDepositModalVisible || isDepositModalLoaded ? (
                <SimpleDepositWithdraw
                    visible={isDepositModalVisible}
                    hideModal={hideDepositModal}
                    action="deposit"
                    fiatModal={false}
                    account={currentAccount}
                    sender={currentAccount}
                    asset={depositModalType === "bid" ? base : quote}
                    modalId={
                        "simple_deposit_modal" +
                        (depositModalType === "bid" ? "" : "_ask")
                    }
                    balance={
                        depositModalType === "bid" ? baseBalance : quoteBalance
                    }
                    {...backedCoins.find(
                        (a: any) =>
                            a.symbol ===
                            (depositModalType === "bid"
                                ? base.get("symbol")
                                : quote.get("symbol"))
                    )}
                />
            ) : null}

            {isDepositBridgeModalVisible || isDepositBridgeModalLoaded ? (
                <SimpleDepositBlocktradesBridge
                    visible={isDepositBridgeModalVisible}
                    hideModal={hideDepositBridgeModal}
                    action="deposit"
                    account={currentAccount.get("name")}
                    sender={currentAccount.get("id")}
                    asset={
                        buyModalType === "bid"
                            ? base.get("id")
                            : quote.get("id")
                    }
                    modalId={
                        "simple_bridge_modal" +
                        (buyModalType === "bid" ? "" : "_ask")
                    }
                    balances={[
                        buyModalType === "bid" ? baseBalance : quoteBalance
                    ]}
                    bridges={
                        bridgeCoins.get(
                            buyModalType === "bid"
                                ? base.get("symbol")
                                : quote.get("symbol")
                        ) || null
                    }
                />
            ) : null}

            {isConfirmBuyOrderModalVisible || isConfirmBuyOrderModalLoaded ? (
                <ConfirmOrderModal
                    visible={isConfirmBuyOrderModalVisible}
                    hideModal={hideConfirmBuyOrderModal}
                    type="buy"
                    onForce={() =>
                        forceBuyOrSell("buy", buyFeeAsset, baseBalance, coreBalance)
                    }
                    diff={buyDiff}
                    hasOrders={combinedAsks.length > 0}
                />
            ) : null}

            {isConfirmSellOrderModalVisible || isConfirmSellOrderModalLoaded ? (
                <ConfirmOrderModal
                    visible={isConfirmSellOrderModalVisible}
                    hideModal={hideConfirmSellOrderModal}
                    type="sell"
                    onForce={() =>
                        forceBuyOrSell(
                            "sell",
                            sellFeeAsset,
                            quoteBalance,
                            coreBalance
                        )
                    }
                    diff={sellDiff}
                    hasOrders={combinedBids.length > 0}
                />
            ) : null}

            <PriceAlert
                onSave={handlePriceAlertSave}
                rules={getPriceAlertRules()}
                latestPrice={latest && latest.getPrice()}
                quoteAsset={quoteAsset.get("id")}
                baseAsset={baseAsset.get("id")}
                visible={isPriceAlertModalVisible}
                showModal={showPriceAlertModal}
                hideModal={hidePriceAlertModal}
            />
        </div>
    );
}

const Exchange = React.memo(ExchangeInner, exchangePropsAreEqual);

export default Exchange;
