// TypeScript/function-component port of the legacy ExchangeContainer.jsx
// (Exchange/ final batch, docs/UI_MIGRATION_PLAN.md Phase 8). This is
// the `/market/:marketID` route entry point: resolves the quote/base
// asset pair from the URL, wires up the market-data subscription
// lifecycle, and renders the already-ported `Exchange.tsx`.
//
// Not security-sensitive per AGENTS.md in the sense of building or
// signing a transaction (grepped for `WalletDb`/`WalletApi`/
// `ApplicationApi\.` - none appear), but this file orchestrates several
// `MarketsActions.` calls that manage the live market-data subscription/
// listener lifecycle (not transaction submission) - every one of them
// is preserved exactly, in the same lifecycle phase, per the task brief:
// - `MarketsActions.subscribeMarket.defer(baseAsset, quoteAsset,
//   bucketSize, currentGroupOrderLimit)` (`_subToMarket`, called from
//   both the mount effect and the resubscribe-on-market-change effect).
// - `MarketsActions.unSubscribeMarket(...)` (the unmount cleanup, with
//   the *current* quote/base asset ids at the moment of unmount - see
//   "stateRef/propsRef mirror" below - and again, with the *previous*
//   subscription's ids parsed from `state.sub`, inside the resubscribe
//   effect before re-subscribing to the new market).
// - `MarketsActions.cancelLimitOrderSuccess`/`closeCallOrderSuccess`/
//   `callOrderUpdate`/`feedUpdate`/`settleOrderUpdate`, each wired to
//   the shared `bitsharesjs` `EmitterInstance()` singleton's
//   `"cancel-order"`/`"close-call"`/`"call-order-update"`/
//   `"bitasset-update"`/`"settle-order-update"` events in the mount
//   effect, and unwired (`emitter.off`) in that same effect's cleanup -
//   exactly the original's `UNSAFE_componentWillMount`/
//   `componentWillUnmount` pairing.
//
// Two original classes:
//
// 1. `ExchangeContainer` (no lifecycle, a pure `render()`): was an
//    `AltContainer` subscribed to `[MarketsStore, AccountStore,
//    SettingsStore, WalletUnlockStore, IntlStore]` with a ~25-entry
//    `inject` object of per-store derived values (plus one,
//    `backedCoins`/`bridgeCoins`, read from `GatewayStore`, which is
//    *not* in that `stores` list - a real, preserved quirk: a
//    `GatewayStore`-only change never by itself causes this to
//    re-render/re-read; those two values only go stale-refresh whenever
//    one of the five *subscribed* stores' changes forces a re-render
//    anyway). Split into an outer `ExchangeContainer` (no hooks - computes
//    `symbols` from the route param and renders the Page404 guard
//    *before* any store is ever touched, matching the original never
//    mounting its `AltContainer` at all for a degenerate "same asset
//    twice" URL) and an inner `ExchangeContainerCore` (all five
//    `useAltStore` subscriptions, this migration's standard `connect`/
//    `AltContainer` replacement, applied per-store since the original's
//    `inject` functions each read from a specific store rather than
//    from one). `GatewayStore` is read via a plain, non-subscribed
//    `GatewayStore.getState()` call each render, reproducing the exact
//    "not in `stores`" quirk above rather than "fixing" it into a sixth
//    `useAltStore` subscription.
//
//    `dataFeed: () => new DataFeed()` is a function-valued `inject`
//    entry, so the original constructs a *brand-new* `DataFeed`
//    instance on every single `AltContainer` re-render (i.e. on every
//    tick of any of the five subscribed stores, not just once) - kept
//    verbatim as `new DataFeed()` computed directly in the render body
//    on every `ExchangeContainerCore` render, not memoized away; this is
//    the original's own behavior; further downstream,
//    `TradingViewPriceChart.tsx`'s `UNSAFE_componentWillReceiveProps`
//    equivalent only actually reacts the first time a `dataFeed` prop
//    appears regardless (see that file's header comment), so the churn
//    here doesn't visibly change anything, same as before.
//
// 2. `ExchangeSubscriber = BindToChainState(ExchangeSubscriber, {
//    show_loader: true})` (required `currentAccount: ChainAccount`,
//    `quoteAsset`/`baseAsset`/`coreAsset: ChainAsset`, `defaultProps:
//    {currentAccount: "1.2.3", coreAsset: "1.3.0"}`) becomes
//    `ExchangeSubscriber` (a `Container`+`Core` split, same approach as
//    `Blockchain/Fees.tsx`/`Modal/ProposalModal.tsx`): `Container`
//    resolves all four via `ChainStore.getAsset`/`getAccount` +
//    `useChainStoreTick()`, gating on *any* of them still being
//    `undefined` (not falsy - `BindToChainState.jsx`'s exact semantics:
//    a resolved `null`, e.g. an invalid/missing asset symbol, still
//    renders through) with the `{show_loader: true}` fallback (a
//    `<LoadingIndicator/>` + "Loading ..." fragment, transcribed
//    verbatim from `BindToChainState.jsx`'s own JSX for that case,
//    since neither `defaultProps.tempComponent` is set here). `coreAsset`
//    is never actually passed by any real caller (grepped: neither
//    `App.jsx`'s route nor `ExchangeContainerCore`'s `<ExchangeSubscriber
//    .../>` below ever sets it) - it therefore always resolves
//    `defaultProps.coreAsset`, `"1.3.0"`, exactly as before.
//
//    `Core` is the original `ExchangeSubscriber` class body:
//    - `UNSAFE_componentWillMount` + `componentWillUnmount` become one
//      mount-only `useEffect(() => {...; return () => {...};}, [])`,
//      per this migration's established treatment. The *cleanup*
//      reads `propsRef.current` (a plain, every-render-updated
//      `useRef` mirror of `props` - this migration's `stateRef` pattern,
//      applied to props) rather than the mount effect's own closed-over
//      props, so it unsubscribes from whatever market was *actually
//      current* at unmount time - which can differ from the market at
//      mount time, since `ExchangeContainer`/`ExchangeSubscriber` is the
//      same component instance across a market switch (the route's
//      `:marketID` param changes without remounting), exactly the case
//      the task brief calls out. The *mount* half still subscribes to
//      whatever `quoteAsset`/`baseAsset` are current *at mount* (no ref
//      needed there - mount only ever runs once, with the props it was
//      given).
//    - The emitter listeners registered in that same mount effect
//      (`newCallListener`/`settleOrderListener`) read
//      `this.props.baseAsset`/`quoteAsset` *dynamically*, on every
//      invocation, in the original (a live class instance's `this.props`
//      is always current) - not a one-time snapshot from when the
//      listener was registered. Reproduced with the same `propsRef`
//      mirror inside each listener body, so a later market switch is
//      correctly reflected without re-registering the listeners (which
//      the original never does either - they're wired up exactly once,
//      in `UNSAFE_componentWillMount`).
//    - `callListener`/`limitListener`/`newCallListener`/
//      `feedUpdateListener`/`settleOrderListener`, and the shared
//      `emitter = EmitterInstance()` singleton itself, are kept as
//      module-level `let`/`const` bindings outside the component
//      function, exactly as the original declared them outside the
//      class - shared across every mounted instance of this component,
//      same pre-existing quirk as `Console.tsx`'s module-level
//      `cmd_history`, not "fixed" into per-instance refs.
//    - `UNSAFE_componentWillReceiveProps` becomes a second effect keyed
//      on `[props]` (the whole props object, not individual fields):
//      this component's actual props object is only ever reconstructed
//      when its *parent* (`ExchangeContainerCore`) re-renders - which
//      happens on every chain-store tick, mirroring how often the
//      original's `BindToChainState` wrapper (itself independently
//      subscribed to `ChainStore`) re-renders and so re-invokes
//      `UNSAFE_componentWillReceiveProps` - while a purely-local
//      `setState` inside *this* component (e.g. from `_subToMarket`)
//      does not recreate that props object, so the effect correctly
//      does *not* re-fire for that case, matching the original (an
//      internal `setState` triggers `shouldComponentUpdate`/`render`,
//      never `componentWillReceiveProps`, which only fires for new
//      props from the parent). Mount-skipped via the established
//      `isMountRef` guard (`UNSAFE_componentWillReceiveProps` never
//      fires on mount in the original either). A `prevPropsRef`,
//      updated to the latest `props` at the end of every invocation,
//      stands in for `this.props` read *before* it's overwritten by
//      `nextProps` - matching the original's exact timing, where
//      `this.props` is still the *previous* props for the whole
//      duration of this lifecycle method (needed for the
//      `this.props.history.push(...)` call, which must push using the
//      *previous* props' `history` object).
//    - The original's `if (!this.state.sub) { return
//      this._subToMarket(nextProps); }` early-`return` (skipping the
//      symbol-comparison branch below it in the same invocation) is
//      reproduced with a `do {...} while (false)` block and `break`,
//      the closest direct equivalent to a lifecycle method's bare
//      `return` in the middle of a function body.
//    - `shouldComponentUpdate` doesn't exist on this class (only on the
//      unrelated `Exchange.jsx`/`TradingViewPriceChart.jsx`), so no SCU
//      translation is needed here.
//
// Confirmed, preserved bug (TS-forced adjustment to keep it, not fix
// it): the `settle-order-update` emitter listener calls
// `market_utils.isMarketAsset(...)`, but the original file never
// imports `market_utils` anywhere (grepped the whole file - no
// `import market_utils` line exists, unlike e.g. `Exchange.tsx`'s own
// `import market_utils from "common/market_utils";`) - so every time
// a `"settle-order-update"` event actually fires, the original throws
// a `ReferenceError: market_utils is not defined` inside that listener
// (caught nowhere - `bitsharesjs`'s `EmitterInstance` doesn't wrap
// listener invocation in a try/catch), meaning `MarketsActions.
// settleOrderUpdate` is never actually reached from this listener in
// practice. TypeScript, unlike plain JS, resolves identifiers
// statically, so leaving the reference genuinely unimported would be a
// compile error here (not a runtime-only one, as in the original) -
// `declare const market_utils: any;` below satisfies `tsc` without
// creating an actual runtime binding, so the exact same
// `ReferenceError` still occurs at runtime, unchanged.
import * as React from "react";
import MarketsStore from "stores/MarketsStore";
import AccountStore from "stores/AccountStore";
import SettingsStore from "stores/SettingsStore";
import GatewayStore from "stores/GatewayStore";
import IntlStore from "stores/IntlStore";
import WalletUnlockStore from "stores/WalletUnlockStore";
import Exchange from "./Exchange";
import {ChainStore, EmitterInstance} from "bitsharesjs";
import MarketsActions from "actions/MarketsActions";
import {DataFeed} from "components/Exchange/tradingViewClasses";
import Page404 from "../Page404/Page404";
import LoadingIndicator from "../LoadingIndicator";
import {useAltStore} from "../../next/hooks/useAltStore";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

// See the header comment's last paragraph: intentionally not imported,
// to reproduce the original's missing-import `ReferenceError` bug
// verbatim while still satisfying `tsc`.
declare const market_utils: any;

export interface ExchangeContainerProps {
    match: {params: {marketID: string}};
    history?: any;
    location?: any;
    [key: string]: any;
}

function ExchangeContainerCore(props: {
    symbols: string[];
    history?: any;
    location?: any;
}) {
    const {symbols} = props;

    const marketsState = useAltStore<any>(MarketsStore);
    const accountState = useAltStore<any>(AccountStore);
    const settingsState = useAltStore<any>(SettingsStore);
    const walletUnlockState = useAltStore<any>(WalletUnlockStore);
    const intlState = useAltStore<any>(IntlStore);

    // `GatewayStore` is read fresh every render but *not* subscribed -
    // see header comment.
    const gatewayState = GatewayStore.getState();

    const injectedProps = {
        hasAnyPriceAlert: (SettingsStore as any).hasAnyPriceAlert(
            symbols[0],
            symbols[1]
        ),
        priceAlert: settingsState.priceAlert,
        locale: intlState.currentLocale,
        lockedWalletState: walletUnlockState.locked,
        marketLimitOrders: marketsState.marketLimitOrders,
        marketCallOrders: marketsState.marketCallOrders,
        invertedCalls: marketsState.invertedCalls,
        marketSettleOrders: marketsState.marketSettleOrders,
        marketData: marketsState.marketData,
        totals: marketsState.totals,
        activeMarketHistory: marketsState.activeMarketHistory,
        bucketSize: marketsState.bucketSize,
        buckets: marketsState.buckets,
        lowestCallPrice: marketsState.lowestCallPrice,
        feedPrice: marketsState.feedPrice,
        currentAccount: accountState.currentAccount,
        myActiveAccounts: accountState.myActiveAccounts,
        viewSettings: settingsState.viewSettings,
        settings: settingsState.settings,
        exchange: settingsState.exchange,
        starredMarkets: settingsState.starredMarkets,
        marketDirections: settingsState.marketDirections,
        marketStats: marketsState.marketStats,
        marketReady: marketsState.marketReady,
        backedCoins: gatewayState.backedCoins.get("OPEN", []),
        bridgeCoins: gatewayState.bridgeCoins,
        miniDepthChart: settingsState.viewSettings.get("miniDepthChart", true),

        dataFeed: new DataFeed(),

        trackedGroupsConfig: marketsState.trackedGroupsConfig,
        currentGroupOrderLimit: marketsState.currentGroupLimit
    };

    return (
        <ExchangeSubscriber
            history={props.history}
            location={props.location}
            quoteAsset={symbols[0]}
            baseAsset={symbols[1]}
            {...injectedProps}
        />
    );
}

export default function ExchangeContainer(props: ExchangeContainerProps) {
    const symbols = props.match.params.marketID.toUpperCase().split("_");
    if (symbols[0] === symbols[1]) {
        return <Page404 subtitle="market_not_found_subtitle" />;
    }
    return (
        <ExchangeContainerCore
            symbols={symbols}
            history={props.history}
            location={props.location}
        />
    );
}

const emitter = EmitterInstance();
let callListener: any,
    limitListener: any,
    newCallListener: any,
    feedUpdateListener: any,
    settleOrderListener: any;

interface ExchangeSubscriberProps {
    currentAccount?: any;
    quoteAsset: any;
    baseAsset: any;
    coreAsset?: any;
    history?: any;
    [key: string]: any;
}

interface ExchangeSubscriberState {
    sub: string | null;
}

function ExchangeSubscriberCore(props: ExchangeSubscriberProps) {
    const [state, setState] = React.useState<ExchangeSubscriberState>({
        sub: null
    });
    const mergeState = (patch: Partial<ExchangeSubscriberState>) =>
        setState(prev => ({...prev, ...patch}));

    const propsRef = React.useRef(props);
    propsRef.current = props;
    const prevPropsRef = React.useRef(props);
    const isMountRef = React.useRef(true);

    const subToMarket = (
        p: any,
        newBucketSize?: any,
        newGroupLimit?: any
    ) => {
        const {quoteAsset, baseAsset} = p;
        let {bucketSize, currentGroupOrderLimit} = p;
        if (newBucketSize) {
            bucketSize = newBucketSize;
        }
        if (newGroupLimit) {
            currentGroupOrderLimit = newGroupLimit;
        }
        if (quoteAsset.get("id") && baseAsset.get("id")) {
            (MarketsActions.subscribeMarket as any).defer(
                baseAsset,
                quoteAsset,
                bucketSize,
                currentGroupOrderLimit
            );
            mergeState({
                sub: `${quoteAsset.get("id")}_${baseAsset.get("id")}`
            });
        }
    };

    // UNSAFE_componentWillMount + componentWillUnmount.
    React.useEffect(() => {
        const p = propsRef.current;
        if (p.quoteAsset === null || p.baseAsset === null) {
            return;
        }
        if (p.quoteAsset.toJS && p.baseAsset.toJS) {
            subToMarket(p);
            // this._addMarket(this.props.quoteAsset.get("symbol"), this.props.baseAsset.get("symbol"));
        }

        emitter.on(
            "cancel-order",
            (limitListener = MarketsActions.cancelLimitOrderSuccess)
        );
        emitter.on(
            "close-call",
            (callListener = MarketsActions.closeCallOrderSuccess)
        );

        emitter.on(
            "call-order-update",
            (newCallListener = (call_order: any) => {
                const {asset_id: coBase} = call_order.call_price.base;
                const {asset_id: coQuote} = call_order.call_price.quote;
                const baseId = propsRef.current.baseAsset.get("id"),
                    quoteId = propsRef.current.quoteAsset.get("id");
                if (
                    (coBase === baseId || coBase === quoteId) &&
                    (coQuote === baseId || coQuote === quoteId)
                ) {
                    MarketsActions.callOrderUpdate(call_order);
                }
            })
        );
        emitter.on(
            "bitasset-update",
            (feedUpdateListener = MarketsActions.feedUpdate)
        );
        emitter.on(
            "settle-order-update",
            (settleOrderListener = (object: any) => {
                const {isMarketAsset, marketAsset} = market_utils.isMarketAsset(
                    propsRef.current.quoteAsset,
                    propsRef.current.baseAsset
                );

                if (isMarketAsset && marketAsset.id === object.balance.asset_id) {
                    MarketsActions.settleOrderUpdate(marketAsset.id);
                }
            })
        );

        return () => {
            const cp = propsRef.current;
            if (cp.quoteAsset === null || cp.baseAsset === null) {
                return;
            }

            MarketsActions.unSubscribeMarket(
                cp.quoteAsset.get("id"),
                cp.baseAsset.get("id")
            );
            if (emitter) {
                emitter.off("cancel-order", limitListener);
                emitter.off("close-call", callListener);
                emitter.off("call-order-update", newCallListener);
                emitter.off("bitasset-update", feedUpdateListener);
                emitter.off("settle-order-update", settleOrderListener);
            }
        };
    }, []);

    // UNSAFE_componentWillReceiveProps.
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            prevPropsRef.current = props;
            return;
        }

        const nextProps = props;
        const prevProps = prevPropsRef.current;

        do {
            if (nextProps.quoteAsset === null || nextProps.baseAsset === null) {
                break;
            }

            /* Prediction markets should only be shown in one direction, if the link goes to the wrong one we flip it */
            if (
                nextProps.baseAsset &&
                nextProps.baseAsset.getIn(["bitasset", "is_prediction_market"])
            ) {
                prevProps.history.push(
                    `/market/${nextProps.baseAsset.get(
                        "symbol"
                    )}_${nextProps.quoteAsset.get("symbol")}`
                );
            }

            if (nextProps.quoteAsset && nextProps.baseAsset) {
                if (!state.sub) {
                    subToMarket(nextProps);
                    break;
                }
            }

            if (
                nextProps.quoteAsset.get("symbol") !==
                    prevProps.quoteAsset.get("symbol") ||
                nextProps.baseAsset.get("symbol") !==
                    prevProps.baseAsset.get("symbol")
            ) {
                const currentSub = (state.sub as string).split("_");
                MarketsActions.unSubscribeMarket(
                    currentSub[0],
                    currentSub[1]
                ).then(() => {
                    subToMarket(nextProps);
                });
            }
        } while (false);

        prevPropsRef.current = props;
    }, [props]);

    if (props.quoteAsset === null || props.baseAsset === null) {
        return <Page404 subtitle="market_not_found_subtitle" />;
    }

    return <Exchange {...props} sub={state.sub} subToMarket={subToMarket} />;
}

function ExchangeSubscriber(props: ExchangeSubscriberProps) {
    useChainStoreTick();

    // `BindToChainState.jsx`'s exact per-key fallback:
    // `props[key] || defaultProps[key]` for `currentAccount`/`coreAsset`
    // (which have `defaultProps`), no fallback for `quoteAsset`/
    // `baseAsset` (which don't).
    const currentAccountProp = props.currentAccount || "1.2.3";
    const coreAssetProp = props.coreAsset || "1.3.0";

    const resolvedCurrentAccount = (ChainStore as any).getAccount(
        currentAccountProp
    );
    const resolvedQuoteAsset = props.quoteAsset
        ? (ChainStore as any).getAsset(props.quoteAsset)
        : undefined;
    const resolvedBaseAsset = props.baseAsset
        ? (ChainStore as any).getAsset(props.baseAsset)
        : undefined;
    const resolvedCoreAsset = (ChainStore as any).getAsset(coreAssetProp);

    if (
        resolvedCurrentAccount === undefined ||
        resolvedQuoteAsset === undefined ||
        resolvedBaseAsset === undefined ||
        resolvedCoreAsset === undefined
    ) {
        return (
            <React.Fragment>
                <LoadingIndicator />
                <span className="text-center">Loading ...</span>
            </React.Fragment>
        );
    }

    return (
        <ExchangeSubscriberCore
            {...props}
            currentAccount={resolvedCurrentAccount}
            quoteAsset={resolvedQuoteAsset}
            baseAsset={resolvedBaseAsset}
            coreAsset={resolvedCoreAsset}
        />
    );
}
