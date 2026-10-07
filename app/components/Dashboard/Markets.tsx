// TypeScript/functional-component port of the legacy Markets.jsx (Phase
// 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes. The last
// of `Dashboard/`'s dependency-chain files ported directly by the
// orchestrating session (after `MarketsTable.jsx` was already ported to
// `.tsx` in an earlier delegated batch, which this file depends on via
// `import MarketsTable from "./MarketsTable"`), together with its own
// dependent `DashboardPage.tsx` (ported in the same commit).
//
// Not security-sensitive per AGENTS.md: grepped for `WalletApi`,
// `WalletDb`, `.add_type_operation`, `process_transaction` - none appear.
// This file only assembles market lists for display; no transaction is
// ever built or signed here.
//
// `TopMarkets` is exported but, per `MarketsTable.tsx`'s own header
// comment (which lists its 3 callers), never imported/rendered anywhere
// else in the app (grep-confirmed) - ported faithfully anyway, consistent
// with this migration's established handling of orphaned-but-exported
// code (e.g. `Forms/RefcodeInput.tsx`), not dropped.
//
// `connect(Component, {listenTo, getProps})` on both `StarredMarkets` and
// `FeaturedMarkets` is replaced by `useAltStore(...)` calls in each
// component's own body (no separate Container/Core split needed here -
// both stay simple enough to keep the store reads inline). `FeaturedMarkets`
// additionally `listenTo`s `MarketsStore` without ever reading anything
// from it in `getProps()` - `useAltStore(MarketsStore)`'s return value is
// discarded, purely to preserve the original's re-render-on-`MarketsStore`
// -change subscription (same precedent as `Account/CreateAccount.tsx`'s
// `useAltStore(AccountStore);`).
//
// `FeaturedMarkets`' `shouldComponentUpdate(nextProps)` is a pure
// re-render guard (`!utils.are_equal_shallow(nextProps, this.props)`) -
// there is no `componentDidUpdate` in this file for it to also gate, so
// it's dropped entirely, per this migration's general rule.
//
// `UNSAFE_componentWillMount` (calls `this.update()`, i.e. with the
// current `this.state`/`this.props` at mount) and
// `UNSAFE_componentWillReceiveProps(nextProps)` (calls
// `this.update(nextProps)` unconditionally on every subsequent props
// change - the original has no field comparison at all here) are
// combined into a single mount-flag-guarded `useEffect`: the first run
// (mount) calls `update()` with the current closure's props (equivalent
// to the original's `this.update()` defaulting to `this.props`); every
// later run (the effect re-firing because a dependency changed) calls
// `update()` with the current props again, replicating "runs on every
// props change, unconditionally". The effect is keyed on `[markets,
// quotes]` (the two props `update`/`_getMarkets` actually read) - note
// `quotes` is a brand-new array literal on every `DashboardPage.tsx`
// render (`quotes={[q].concat(getPossibleGatewayPrefixes([q]))}`), so in
// practice this effect re-fires on literally every parent render, exactly
// matching the original class's `UNSAFE_componentWillReceiveProps` firing
// unconditionally on every parent re-render (it was never wrapped in
// `PureComponent`/`React.memo`-equivalent shallow-prop-diffing).
//
// Preserved verbatim, not "fixed": `_getMarkets`'s testnet fallback
// branch (`chainID !== "4018d784"`) returns a **plain JS array of
// `[base, quote]` tuples** (`[["TEST", "PEG.FAKEUSD"], ["TEST",
// "BTWTY"]]`), while the mainnet branch returns `props.markets`, an
// Immutable Map (from `SettingsStore`, since `update()` later calls
// `.has()`/`.set()` on the result). `update()`'s subsequent
// `.filter(market => ... market.base)` reads a `.base` property that
// doesn't exist on a plain array's tuple elements (always `undefined`),
// and would go on to call `.has()`/`.set()` - methods a plain JS array
// doesn't have - if reached on testnet. This is a real, reachable-on-
// testnet-only bug in the original; typed loosely (`any`) and
// transcribed exactly, not restructured to share a single type between
// the two branches.
import * as React from "react";
import {Apis} from "bitsharesjs-ws";
import SettingsStore from "stores/SettingsStore";
import MarketsStore from "stores/MarketsStore";
import MarketsTable from "./MarketsTable";
import {useAltStore} from "../../next/hooks/useAltStore";

function StarredMarkets() {
    const settingsState = useAltStore<any>(SettingsStore);

    return (
        <MarketsTable
            markets={settingsState.starredMarkets}
            forceDirection={true}
            isFavorite
        />
    );
}

interface FeaturedMarketsCoreProps {
    quotes: any[];
    markets: any;
}

interface FeaturedMarketsState {
    chainID: any;
    markets: any;
}

function FeaturedMarketsCore({quotes, markets}: FeaturedMarketsCoreProps) {
    const getInitialChainID = () => {
        let chainID = (Apis as any).instance().chain_id;
        if (chainID) chainID = chainID.substr(0, 8);
        return chainID;
    };

    const [state, setState] = React.useState<FeaturedMarketsState>(() => ({
        chainID: getInitialChainID(),
        markets: []
    }));
    const stateRef = React.useRef(state);
    stateRef.current = state;

    const _getMarkets = (s: FeaturedMarketsState, props: {markets: any}) => {
        const {chainID} = s;

        if (chainID === "4018d784") {
            return props.markets;
        } else {
            // assume testnet
            return [
                ["TEST", "PEG.FAKEUSD"],
                ["TEST", "BTWTY"]
            ];
        }
    };

    const update = (props: {markets: any; quotes: any[]}) => {
        let updatedMarkets = _getMarkets(stateRef.current, props);

        updatedMarkets = updatedMarkets.filter((market: any) => {
            /* Only use markets corresponding to the current tab */
            return props.quotes[0] === market.base;
        });

        /* Add the possible gateway assets */
        for (let i = 1; i < props.quotes.length; i++) {
            updatedMarkets.forEach((m: any) => {
                const obj = {quote: m.quote, base: props.quotes[i]};
                const marketKey = `${obj.quote}_${obj.base}`;
                if (obj.quote !== obj.base && !updatedMarkets.has(marketKey)) {
                    updatedMarkets = updatedMarkets.set(marketKey, obj);
                }
            });
        }
        setState(prev => ({...prev, markets: updatedMarkets}));
    };

    const isMountRef = React.useRef(true);
    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            update({markets, quotes});
            return;
        }
        update({markets, quotes});
        // eslint-disable-next-line
    }, [markets, quotes]);

    return (
        <MarketsTable
            markets={state.markets}
            showFlip={false}
            isFavorite={false}
        />
    );
}

function FeaturedMarkets({quotes}: {quotes: any[]}) {
    useAltStore(MarketsStore);
    const settingsState = useAltStore<any>(SettingsStore);

    let defaultMarkets = settingsState.defaultMarkets;
    const userMarkets = settingsState.userMarkets;

    if (userMarkets.size) {
        userMarkets.forEach((market: any, key: any) => {
            if (!defaultMarkets.has(key))
                defaultMarkets = defaultMarkets.set(key, market);
        });
    }

    return <FeaturedMarketsCore quotes={quotes} markets={defaultMarkets} />;
}

function TopMarkets() {
    return <MarketsTable markets={[]} />;
}

export {StarredMarkets, FeaturedMarkets, TopMarkets};
