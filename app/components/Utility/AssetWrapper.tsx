// TypeScript/functional-component port of the legacy AssetWrapper.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md, `Utility/` batch 11) - a HOC
// factory (`AssetWrapper(Component, options)`), not a component itself,
// so it stays an exported plain function (not a React function
// component) exactly as before; only its *internals* move to hooks.
//
// Structural change (not a behavior change, same substitution used
// throughout this migration): the original built two layers of
// `BindToChainState`-wrapped class components -
// `AssetsResolver = BindToChainState(AssetsResolver)` (resolving each
// configured `propNames` entry from a raw asset id/List-of-ids into a
// real chain `Asset` via `ChainStore.getAsset`, singular-case marked
// `.isRequired` so an unresolved asset blocks rendering) and
// `DynamicObjectResolver = BindToChainState(DynamicObjectResolver)`
// (resolving a `dos` list of `dynamic_asset_data_id`s into a
// `getDynamicObject(id)` lookup for `withDynamic: true` callers) - both
// replaced by a single function component using `useChainStoreTick()` +
// direct `ChainStore.getAsset`/`getObject` calls, matching
// `WithdrawModalNew.tsx`'s `WithdrawModalAccountContainer` precedent for
// the "required chain prop, no show_loader option" case (render a bare
// `<span />` - or `options.defaultProps.tempComponent`, e.g. `"tr"` for
// the one caller inside a `<table>` - until it resolves) referenced in
// this batch's task description, and this migration's already-landed
// `Exchange/MarketRow.tsx` port (an out-of-scope file ported in an
// earlier, different batch) for the exact same `AssetWrapper(..., {
// propNames: ["quote", "base"], withDynamic: true, ...})` shape: that
// port already established and verified (its own tsc/eslint/test/build
// run) that `getDynamicObject(id)` can be implemented as a direct,
// one-line `ChainStore.getObject(id)` read, with no need to separately
// collect a `dos` list of ids first - `ChainStore.getObject` is a
// synchronous cache read either way (identical result, same
// autosubscribe-on-miss side effect), so the whole `DynamicObjectResolver`
// class - and the `dos`-list-building step in the original's resolver
// loop - collapses away entirely. Verified via grep (`getDynamicObject`,
// `\bdos\b` across `app/`) that no caller anywhere reads a `dos` prop
// itself (only the `getDynamicObject` callback its old resolution fed),
// confirming this is a safe simplification for every current caller
// (several already-ported `.tsx` files, e.g. `Account/FeePoolOperation
// .tsx`, `Account/AccountAssets.tsx`, `Modal/SettleModal.tsx`,
// `Blockchain/BidCollateralOperation.tsx`, plus out-of-scope `.jsx`
// callers `Utility/AmountSelector.jsx`/`AmountSelectorStyleGuide.jsx`/
// `EquivalentPrice.jsx`/`EquivalentValueComponent.jsx` - none typed, so
// runtime-compatible is what matters for those, confirmed by this exact
// resolution shape).
//
// Dropped as confirmed dead (grepped `refs\.bound_component|\.bound_component`
// across the whole app - no matches outside this file and
// `BindToChainState.jsx` itself): the original's legacy string ref
// (`<Component ref="bound_component" />`) on the wrapped component - it
// had no reader anywhere.
//
// Simplified (not a behavior change for any current caller, singular or
// list mode): the original routed every resolved/pass-through prop
// through `React.Children.only(this.props.children)` +
// `React.cloneElement` on a *fixed*, always-identical single child
// (`<Component ref="bound_component" />`, never anything caller-supplied
// - the exported `Wrapper`'s own `render()` always hardcoded that child
// and never rendered `this.props.children`, so children passed by an
// external caller to the exported wrapped component were always silently
// dropped, preserved here by this component simply not accepting/
// forwarding a `children` prop either). Because that child was fixed,
// the clone step reduces to "compute the final prop set, then render
// `<Component {...finalProps} />` directly" - which is what this file
// does, instead of performing a `cloneElement` whose `config` argument
// also always included a self-referential `children: <the same element
// being cloned>` entry (since "children" was never in `options
// .propNames` and so always ended up in `passTroughProps`, which was
// spread into the `cloneElement` config) - inert for every current
// wrapped component (grepped each `AssetWrapper`-wrapped component for a
// `this.props.children` read: none renders it), so dropping it changes
// nothing observable.
//
// Preserved verbatim (not "fixed"): singular ("asList: false") resolution
// mirrors `BindToChainState.jsx`'s `chain_assets` category exactly,
// including that a prop falls back to its default via plain `||` (so an
// explicit `null`/`""`/`0` passed by a caller is treated the same as
// "not passed" and replaced by the default - not `??`), and that the
// "required but unresolved" gate checks specifically for `undefined`
// (not `null`) - so an asset that `ChainStore.getAsset` explicitly
// resolves to `null` (rare, but possible) is treated as "resolved" and
// rendered through as `null`, not as a blocking loading state. List
// ("asList: true") resolution mirrors the `chain_assets_list` category's
// sparse-array quirk (the loop increments its index *before* assigning,
// so real items start at array index 1, with a hole at index 0) before
// `.filter(a => !!a)` compacts it - same quirk already documented for
// `Utility/AssetSelect.tsx`'s/`Account/BalanceWrapper.tsx`'s identical
// resolution category.
import * as React from "react";
import {getDisplayName} from "common/reactUtils";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import {List} from "immutable";

interface AssetWrapperOptions {
    propNames?: string[];
    defaultProps?: {[key: string]: any};
    asList?: boolean;
    withDynamic?: boolean;
    [key: string]: any;
}

/**
 * HOC that resolves either a number of assets directly with ChainAsset,
 * or a list of assets with ChainAssets
 *
 *  Options
 *  -'propNames' an array of prop names to be resolved as assets. (defaults to "asset" or "assets")
 *  -'defaultProps' default values to use for objects (optional)
 *  -'asList' defines whether to use ChainAssetsList or not (useful for resolving large quantities of assets)
 *  -'withDynamic' defines whether to also resolve dynamic objects or not
 */
function AssetWrapper(
    Component: React.ComponentType<any>,
    options: AssetWrapperOptions = {}
): React.ComponentType<any> {
    const asList = !!options.asList;
    const withDynamic = !!options.withDynamic;
    const propNames: string[] = options.propNames || [asList ? "assets" : "asset"];
    const tempComponent =
        options.defaultProps && options.defaultProps.tempComponent;

    const defaultValues: {[key: string]: any} = propNames.reduce(
        (res: {[key: string]: any}, key: string) => {
            const current = options.defaultProps && options.defaultProps[key];
            res[key] = asList ? List(current || []) : current || "1.3.0";
            return res;
        },
        {}
    );

    function resolveAssetsList(prop: any): any[] {
        const result: any[] = [];
        if (!prop) return result;
        let index = 0;
        prop.forEach((obj_id: any) => {
            ++index;
            if (obj_id) {
                result[index] = (ChainStore as any).getAsset(obj_id);
            }
        });
        return result;
    }

    function AssetsResolver(props: any) {
        useChainStoreTick();

        const resolved: {[key: string]: any} = {};
        let blocked = false;

        propNames.forEach(name => {
            const rawValue = props[name] || defaultValues[name];
            if (asList) {
                resolved[name] = resolveAssetsList(rawValue).filter(
                    (a: any) => !!a
                );
            } else {
                const value = rawValue
                    ? (ChainStore as any).getAsset(rawValue)
                    : undefined;
                if (value === undefined) blocked = true;
                resolved[name] = value;
            }
        });

        if (blocked) {
            // Matches BindToChainState's fallback for an unresolved
            // *required* prop when `options.show_loader` isn't set (it
            // never is, for this wrapper chain): render an inert
            // placeholder - `defaultProps.tempComponent` (e.g. "tr") if
            // configured, a plain `<span />` otherwise - until it
            // resolves.
            return tempComponent ? React.createElement(tempComponent) : (
                <span />
            );
        }

        const finalProps: any = {...props};
        delete finalProps.children;
        propNames.forEach(name => {
            finalProps[name] = resolved[name];
        });
        if (withDynamic) {
            finalProps.getDynamicObject = (id: any) =>
                (ChainStore as any).getObject(id);
        }

        return <Component {...finalProps} />;
    }

    AssetsResolver.displayName = `Wrapper(${getDisplayName(Component)})`;
    return AssetsResolver;
}

export default AssetWrapper;
