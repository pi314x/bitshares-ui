// TypeScript port of the legacy MarketStatsCheck.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md, `Utility/` batch 11).
//
// ** Deliberate deviation from this batch's "convert to a TypeScript
// function component" instruction - flagged prominently for review. **
// `MarketStatsCheck` is not itself a renderable component (it declares no
// `render()` method anywhere in its original or this file) - it is a
// mixin-style base class providing only lifecycle hooks
// (`UNSAFE_componentWillMount`/`UNSAFE_componentWillReceiveProps`/
// `componentWillUnmount`) and helper methods
// (`_statsChanged`/`_useDirectMarket`/`_checkDirectMarkets`/
// `_startUpdates`/`_stopUpdates`) that manage live
// `MarketsActions.getMarketStatsInterval(...)` subscriptions, meant to be
// combined with a subclass that supplies its own `render()`.
//
// Grepping the whole app for `extends MarketStatsCheck` (as this
// migration's established rule requires before converting any exported
// class - see the "General rule adopted" note under `Utility/` batch 1
// in this plan) finds exactly two subclasses, and *both* are out of this
// batch's scope and must not be touched per this task's own instructions:
// `Utility/EquivalentPrice.jsx`'s `class EquivalentPrice extends
// MarketStatsCheck` and `Utility/EquivalentValueComponent.jsx`'s `class
// ValueComponent extends MarketStatsCheck`. Both subclasses rely on
// *inheriting* this class's React lifecycle methods (so React actually
// invokes `UNSAFE_componentWillMount`/`_startUpdates`/`componentWillUnmount`
// on their instances and keeps fetching live market stats) and both call
// `super.shouldComponentUpdate(np)` directly. Turning this class into a
// plain function/hook (as instructed, and as every other file in this
// batch became) would make `class EquivalentPrice extends MarketStatsCheck`
// extend a non-component value: `super.shouldComponentUpdate(...)` would
// throw, and - more importantly - every inherited lifecycle method would
// silently stop being invoked by React at all, since they would no
// longer live on `EquivalentPrice`'s/`ValueComponent`'s prototype chain,
// silently killing the live market-stats subscriptions that back
// `EquivalentPrice`/`EquivalentValueComponent` (consumed, per this plan's
// `Utility/` batch 1 note, by the real `Modal/DepositModal.jsx` and
// `Dashboard/SimpleDepositWithdraw.jsx` deposit/withdraw screens). Neither
// `tsc`, `eslint`, `yarn test`, nor `yarn build` would catch this - it is
// a pure runtime behavior break with no compile-time or test signal
// (confirmed via grep: no test file anywhere under `app/__tests__`
// references `EquivalentPrice`, `EquivalentValueComponent`,
// `AmountSelector`, `BalanceValueComponent`, `DepositModal`, or
// `SimpleDepositWithdraw`).
//
// Given that conflict, this file is ported to TypeScript (typed, `.tsx`
// extension, same mechanical cleanup as the rest of this batch) but kept
// as an ES6 class extending `React.Component` - exactly the shape the
// project's own established rule says to keep until `EquivalentPrice.jsx`/
// `EquivalentValueComponent.jsx` are themselves converted (a follow-up
// batch, per this plan's `Utility/` batch 1 note and this task's own
// "AmountSelector.jsx/AmountSelectorStyleGuide.jsx... held back for a
// follow-up batch" framing, which already anticipates `EquivalentPrice
// .jsx`/`EquivalentValueComponent.jsx` needing their own future
// conversion pass). No logic changes - every method body, condition, and
// the commented-out dead branch in `_startUpdates` are transcribed
// verbatim, only with type annotations added.
import * as React from "react";
import MarketsActions from "actions/MarketsActions";
import marketUtils from "common/market_utils";
import utils from "common/utils";

interface MarketStatsCheckProps {
    fromAsset?: any;
    fromAssets?: any[];
    toAsset: any;
    coreAsset?: any;
    allMarketStats: any;
    [key: string]: any;
}

class MarketStatsCheck extends React.Component<MarketStatsCheckProps> {
    fromStatsIntervals: {[key: string]: () => void};
    directStatsIntervals: {[key: string]: () => void};
    toStatsInterval: (() => void) | null;
    updatesTimer?: any;

    constructor(props: MarketStatsCheckProps) {
        super(props);
        this.fromStatsIntervals = {};
        this.directStatsIntervals = {};
        this.toStatsInterval = null;
    }

    _statsChanged(newStats: any = {}, oldStats: any = {}): boolean {
        if (!newStats.price) return false;
        else if (!oldStats.price) return true;
        return (
            newStats.volumeBase !== oldStats.volumeBase ||
            !newStats.price.equals(oldStats.price)
        );
    }

    _useDirectMarket(props: any): boolean {
        const {fromAsset, toAsset, allMarketStats} = props;
        if (!fromAsset) return false;
        const {marketName: directMarket} = marketUtils.getMarketName(
            toAsset,
            fromAsset
        );

        const directStats = allMarketStats.get(directMarket);

        if (directStats && directStats.volumeBase === 0) return false;

        return true;
    }

    _checkDirectMarkets(props: any): any[] {
        const {fromAsset, toAsset, allMarketStats} = props;
        let {fromAssets} = props;
        if (!fromAssets && fromAsset) fromAssets = [fromAsset];

        return fromAssets
            .filter((a: any) => !!a)
            .map((asset: any) => {
                return this._useDirectMarket({
                    fromAsset: asset,
                    toAsset,
                    allMarketStats
                })
                    ? asset.get("symbol")
                    : null;
            })
            .filter((a: any) => !!a);
    }

    UNSAFE_componentWillMount() {
        this._startUpdates(this.props);
    }

    UNSAFE_componentWillReceiveProps(np: any) {
        const currentDirectMarkets = this._checkDirectMarkets(this.props);
        const newDirectMarkets = this._checkDirectMarkets(np);
        if (
            !(utils as any).are_equal_shallow(
                currentDirectMarkets,
                newDirectMarkets
            )
        ) {
            this._startUpdates(np);
        }

        if (
            np.toAsset &&
            this.props.asset &&
            this.props.toAsset.get("symbol") !== np.asset.get("symbol")
        ) {
            this._startUpdates(np);
        }
    }

    _startUpdates(props: any) {
        /* Only run this every x seconds */
        if (!!this.updatesTimer) return;
        this.updatesTimer = setTimeout(() => {
            this.updatesTimer = null;
        }, 10 * 1000);
        const {coreAsset, fromAsset, toAsset} = props;
        let {fromAssets} = props;
        if (!fromAssets && fromAsset) fromAssets = [fromAsset];

        const directMarkets = fromAssets
            .map((asset: any) => {
                const {marketName: directMarket} = marketUtils.getMarketName(
                    props.toAsset,
                    asset
                );
                const useDirectMarket = this._useDirectMarket({
                    toAsset,
                    fromAsset: asset,
                    allMarketStats: props.allMarketStats
                });

                if (
                    useDirectMarket &&
                    toAsset &&
                    toAsset.get("id") !== asset.get("id")
                ) {
                    if (!this.directStatsIntervals[directMarket]) {
                        setTimeout(() => {
                            this.directStatsIntervals[
                                directMarket
                            ] = (MarketsActions as any).getMarketStatsInterval(
                                5 * 60 * 1000,
                                asset,
                                toAsset
                            );
                        }, 50);
                    }
                }
                // else if (this.directStatsIntervals[directMarket]) {
                //     console.log(directMarket, "directStatsIntervals exists, clearing");
                //     this.directStatsIntervals[directMarket]();
                // }

                return useDirectMarket ? directMarket : null;
            })
            .filter((a: any) => !!a);

        const indirectAssets = fromAssets.filter((f: any) => {
            const {marketName: directMarket} = marketUtils.getMarketName(
                props.toAsset,
                f
            );

            return directMarkets.indexOf(directMarket) === -1;
        });

        if (coreAsset && indirectAssets.length) {
            // From assets
            indirectAssets.forEach((asset: any) => {
                if (asset && asset.get("id") !== coreAsset.get("id")) {
                    const {marketName} = marketUtils.getMarketName(
                        coreAsset,
                        asset
                    );
                    if (!this.fromStatsIntervals[marketName]) {
                        setTimeout(() => {
                            this.fromStatsIntervals[
                                marketName
                            ] = (MarketsActions as any).getMarketStatsInterval(
                                5 * 60 * 1000,
                                coreAsset,
                                asset
                            );
                        }, 50);
                    }
                }
            });

            // To asset
            if (props.toAsset.get("id") !== coreAsset.get("id")) {
                // wrap this in a timeout to prevent dispatch in the middle of a dispatch
                this.toStatsInterval = (MarketsActions as any).getMarketStatsInterval(
                    5 * 60 * 1000,
                    coreAsset,
                    props.toAsset
                );
            }
        }
    }

    _stopUpdates() {
        for (const key in this.fromStatsIntervals) {
            this.fromStatsIntervals[key]();
            delete this.fromStatsIntervals[key];
        }
        for (const key in this.directStatsIntervals) {
            this.directStatsIntervals[key]();
            delete this.directStatsIntervals[key];
        }
        if (this.toStatsInterval) this.toStatsInterval();
        this.toStatsInterval = null;
    }

    componentWillUnmount() {
        this._stopUpdates();
    }

    shouldComponentUpdate(np: any): boolean {
        const {fromAsset} = this.props;
        let {fromAssets} = this.props;

        const {marketName: toMarket} = marketUtils.getMarketName(
            np.toAsset,
            np.coreAsset
        );

        if (!fromAssets && fromAsset) fromAssets = [fromAsset];
        function getMarketNames(assets: any, toAsset: any) {
            return assets
                .map((asset: any) => {
                    if (!asset) return null;
                    const {marketName} = marketUtils.getMarketName(
                        asset,
                        toAsset
                    );
                    return marketName;
                })
                .filter((a: any) => !!a);
        }

        const directMarkets = getMarketNames(fromAssets, np.toAsset);
        const indirectMarkets = getMarketNames(fromAssets, np.coreAsset);

        const indirectCheck = indirectMarkets.reduce((a: any, b: any) => {
            return (
                a ||
                this._statsChanged(
                    np.allMarketStats.get(b),
                    this.props.allMarketStats.get(b)
                )
            );
        }, false);

        const directCheck = directMarkets.reduce((a: any, b: any) => {
            return (
                a ||
                this._statsChanged(
                    np.allMarketStats.get(b),
                    this.props.allMarketStats.get(b)
                )
            );
        }, false);

        return (
            this._statsChanged(
                np.allMarketStats.get(toMarket),
                this.props.allMarketStats.get(toMarket)
            ) ||
            indirectCheck ||
            directCheck
        );
    }
}

export default MarketStatsCheck;
