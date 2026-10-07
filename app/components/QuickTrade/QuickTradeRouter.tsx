// TypeScript/function-component port of the legacy QuickTradeRouter.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md) - the `/instant-trade[/:marketID]`
// route entry point. Parses the route's `marketID` param into a
// sell/receive symbol pair, 404s on a degenerate "same asset twice"
// market, resolves both symbols into chain `Asset` objects, and renders
// `QuickTrade` once both are available. Mechanical translation, no logic
// changes to the symbol parsing or the 404 condition.
//
// Not security-sensitive per AGENTS.md on its own (no `WalletDb`/signing
// here - it only resolves assets and renders `QuickTrade`), but it feeds
// `QuickTrade.tsx`'s `assetToSell`/`assetToReceive` props, which that
// file's `handleSell()` ultimately uses to build the real submitted
// order - so the asset-resolution logic below is translated byte-for-
// byte from the original, not simplified.
//
// Grepped every `console.*` call in this file: one, the `__DEV__`-gated
// `console.log("QuickTradeRouter", symbols)` - no password/key material,
// kept verbatim.
//
// ----------------------------------------------------------------------
// `BindToChainState(QuickTradeSubscriber, {show_loader: true})` - what
// `show_loader` actually does here
// ----------------------------------------------------------------------
// The original wraps a tiny `QuickTradeSubscriber` class (`static
// propTypes = {assetToSell: ChainTypes.ChainAsset, assetToReceive:
// ChainTypes.ChainAsset}`, `static defaultProps = {assetToSell: "CNY",
// assetToReceive: "BTS"}`) with `BindToChainState(QuickTradeSubscriber,
// {show_loader: true})`. Reading `BindToChainState.jsx`'s `render()`
// closely (per the task's instruction to verify rather than assume):
// `options.show_loader`'s branch only fires inside a loop over
// `this.required_props` - the subset of `propTypes` entries whose value
// is literally some `ChainTypes.X.isRequired` (checked via
// `checkIfRequired`). Neither `assetToSell` nor `assetToReceive` is
// marked `.isRequired` here (unlike, say, a `ChainTypes.ChainAccount
// .isRequired` elsewhere in the app), so `required_props` is empty for
// this component and that loop's body - including the `show_loader`
// branch - never runs. **`show_loader: true` has no observable effect
// for this specific usage** - confirmed by tracing `BindToChainState`'s
// actual control flow, not assumed from the option name. `Wrapper`'s
// `render()` therefore always falls through to `<Component {...props}
// {...this.state} />`, i.e. `QuickTradeSubscriber` always renders with
// whatever `assetToSell`/`assetToReceive` `ChainStore.getAsset(...)` has
// resolved so far (`undefined` before the chain store has the data,
// `null` if resolution explicitly failed, or the resolved asset Map).
// The *actual* "not ready yet" fallback that visibly matters is
// `QuickTradeSubscriber`'s own `render()`: `return null` unless both
// `this.props.assetToReceive.get` and `this.props.assetToSell.get` are
// truthy. So this port's Container below reproduces that same `return
// null` fallback directly - not a loading spinner - matching what the
// app actually showed before.
//
// Also worth noting from that same read: `BindToChainState`'s
// `UNSAFE_componentWillMount` calls `this.update()` (synchronously, pre-
// paint) before the very first render, and for this component `_update`
// never actually hits a real `await` (the only `await` in `_update` is
// inside a loop over `chain_liquidity_pools`, which is empty here), so
// its `setState` lands before that first render paints - there is no
// one-frame flash of `assetToSell`/`assetToReceive` being `undefined`
// props on the very first render. The Container below reproduces the
// same timing for free: `ChainStore.getAsset(...)` is a synchronous
// cache read, called directly during render under `useChainStoreTick()`,
// so there's no extra render needed to pick up an already-cached asset
// either.
//
// `defaultProps = {assetToSell: "CNY", assetToReceive: "BTS"}` becomes
// the `|| "CNY"` / `|| "BTS"` fallback below, applied to the *symbol*
// before the `ChainStore.getAsset` lookup - matching exactly where
// `BindToChainState`'s own per-prop resolution loop applies a
// `defaultProps` fallback (`props[key] || ... || this.default_props[key]`,
// i.e. only when the prop itself is falsy, same as `symbols[0] || ""`
// being an empty string whenever `marketID` has no `_`-separated second
// symbol).
import * as React from "react";
import Page404 from "../Page404/Page404";
import QuickTrade from "./QuickTrade";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

interface QuickTradeAssetsContainerProps {
    assetToSell: string;
    assetToReceive: string;
    [key: string]: any;
}

function QuickTradeAssetsContainer(props: QuickTradeAssetsContainerProps) {
    useChainStoreTick();
    const {assetToSell: assetToSellSymbol, assetToReceive: assetToReceiveSymbol, ...rest} = props;
    const assetToSell = ChainStore.getAsset(assetToSellSymbol || "CNY");
    const assetToReceive = ChainStore.getAsset(assetToReceiveSymbol || "BTS");

    if (!!(assetToReceive && assetToReceive.get) && !!(assetToSell && assetToSell.get)) {
        return (
            <QuickTrade
                {...rest}
                assetToSell={assetToSell}
                assetToReceive={assetToReceive}
            />
        );
    }
    return null;
}

interface QuickTradeRouterProps {
    match: {params: {marketID?: string}};
    [key: string]: any;
}

function QuickTradeRouter(props: QuickTradeRouterProps) {
    const symbols = !!props.match.params.marketID
        ? props.match.params.marketID.toUpperCase().split("_")
        : ["", ""];
    if (symbols.length == 2 && !!symbols[0] && symbols[0] === symbols[1]) {
        return <Page404 subtitle="market_not_found_subtitle" />;
    }
    if (__DEV__) {
        console.log("QuickTradeRouter", symbols);
    }
    return (
        <QuickTradeAssetsContainer
            {...props}
            assetToSell={symbols[0] || ""}
            assetToReceive={symbols.length == 2 ? symbols[1] : ""}
        />
    );
}

export default QuickTradeRouter;
