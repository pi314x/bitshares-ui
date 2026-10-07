// TypeScript/functional-component port of the legacy PMAssetsContainer.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Not security-sensitive itself (no direct transaction/signing calls) -
// it only fetches asset/account data and forwards it, plus a couple of
// `AssetActions.getAssetList` read/list-refresh dispatches, to the
// sibling `PredictionMarkets` component, which is where the actual
// transaction-building logic (`AssetActions.assetGlobalSettle`, etc.)
// lives.
//
// This is the route-level component (lazy-loaded by `App.jsx`), wrapped
// with `bindToCurrentAccount` at its own export - same as the original.
// Note this wrapping only gates rendering behind a loaded `currentAccount`
// (showing `LoadingIndicator` until then); the resolved account is never
// actually read or forwarded to `<PredictionMarkets>` from this file -
// `PredictionMarkets.tsx` independently wraps *itself* with
// `bindToCurrentAccount` too and reads `currentAccount` there. This
// results in the account being resolved/gated on twice in sequence, which
// is exactly what the original two-file structure already did - not
// "fixed" here.
//
// `connect(PMAssetsContainer, {listenTo() {return [AssetStore,
// MarketsStore]}, getProps() {...}})` is replaced with two
// `useAltStore(...)` calls, this migration's established Alt.js-store
// adapter (`app/next/hooks/useAltStore.ts`). Only `AssetStore`'s
// `assets` is actually read anywhere in this file; `MarketsStore`'s
// derived props (`bucketSize`/`currentGroupOrderLimit`/
// `marketLimitOrders`) were part of the original `getProps()` but never
// read anywhere in this file either - `useAltStore(MarketsStore)` is
// still called (its return value discarded, same precedent as
// `Account/CreateAccount.tsx`/`CreateAccountPassword.tsx`'s
// `useAltStore(AccountStore);`) purely to preserve the original's
// re-render-on-`MarketsStore`-change subscription.
//
// Split into an outer store-subscribing `PMAssetsContainer` and an inner
// `PMAssetsContainerCore` (this migration's established Container+Core
// split), matching how the original's `class PMAssetsContainer` itself
// was already the "core" and `connect(...)` was the store-subscribing
// wrapper.
//
// `UNSAFE_componentWillMount`'s one-time whitelisted-issuers/prediction-
// markets fetch is replicated with a mount-only `useEffect` (empty
// dependency array, no skip-first-render guard needed since the original
// ran this exactly once on mount too).
//
// `componentDidUpdate`'s `prevProps.assets !== this.props.assets &&
// this.state.fetchAllAssets` re-fetch is replicated with a mount-skip
// `useEffect` keyed on `assets` (`componentDidUpdate` never fires on
// mount, so the skip guard is required here, unlike the mount effect
// above) that reads `state.fetchAllAssets` via a `stateRef` mirror (this
// migration's established pattern for reading current-but-not-dependency
// state inside a callback) rather than adding `fetchAllAssets` to the
// dependency array, since the original only reacted to `assets` changing,
// not to `fetchAllAssets` changing.
//
// `fetchAllAssets()`'s `this.setState(update, callback)` is replicated by
// calling the state update and the callback's `setTimeout(...)` body
// directly in sequence - the callback never reads the just-committed
// state (only dispatches `AssetActions.getAssetList("", 100)` after a
// fixed 300ms delay), so there is no stale-closure risk in firing it
// immediately after `mergeState` rather than waiting for React to commit
// first.
import * as React from "react";
import AssetActions from "actions/AssetActions";
import AssetStore from "stores/AssetStore";
import PredictionMarkets from "./PredictionMarkets";
import MarketsStore from "../../stores/MarketsStore";
import {getPredictionMarketIssuers} from "../../lib/chain/onChainConfig";
import {ChainStore, FetchChainObjects} from "bitsharesjs";
import assetUtils from "common/asset_utils";
import {bindToCurrentAccount} from "../Utility/BindToCurrentAccount";
import {useAltStore} from "../../next/hooks/useAltStore";

const _convertPredictionMarketForUI = (asset: any) => {
    let market_fee = 0;
    let max_market_fee = 0;
    if (asset.forPredictions.flagBooleans["charge_market_fee"]) {
        market_fee = asset.options.market_fee_percent;
        max_market_fee = asset.options.max_market_fee;
    }
    const bitassetData = asset.bitasset_data || asset.bitasset || {};
    const uiMarketData = {
        asset: asset,
        short_backing_asset:
            bitassetData.options.short_backing_asset || "1.3.0",
        asset_id: asset.id,
        issuer: asset.issuer,
        description: asset.forPredictions.description.main,
        symbol: asset.symbol,
        condition: asset.forPredictions.description.condition,
        expiry: asset.forPredictions.description.expiry,
        options: asset.options,
        marketConfidence: 0,
        marketLikelihood: 0,
        market_fee,
        max_market_fee
    };
    return uiMarketData;
};

interface PMAssetsContainerState {
    lastAssetSymbol: string;
    predictionMarkets: any[];
    fetching: boolean;
    whitelistedIssuers: any[];
    fetchAllAssets: boolean;
}

interface PMAssetsContainerCoreProps {
    assets: any;
}

function PMAssetsContainerCore({assets}: PMAssetsContainerCoreProps) {
    const [state, setState] = React.useState<PMAssetsContainerState>({
        lastAssetSymbol: "",
        predictionMarkets: [],
        fetching: true,
        whitelistedIssuers: [],
        fetchAllAssets: false
    });
    const stateRef = React.useRef(state);
    stateRef.current = state;

    const mergeState = (patch: Partial<PMAssetsContainerState>) =>
        setState(prev => ({...prev, ...patch}));

    const _isPredictionMarket = (asset: any): boolean => {
        if (!asset) {
            return false;
        }
        const bitassetData = asset.bitasset_data || asset.bitasset || {};
        return bitassetData.is_prediction_market;
    };

    const _normalizePredictionMarketAsset = (asset: any) => {
        if (!asset.forPredictions) {
            asset.forPredictions = {
                description: (assetUtils as any).parseDescription(
                    asset.options.description
                ),
                flagBooleans: (assetUtils as any).getFlagBooleans(
                    asset.options.flags,
                    true
                )
            };
        }
        return _convertPredictionMarketForUI(asset);
    };

    const _getPredictionMarketList = (assetsArg: any) => {
        return [...assetsArg]
            .map((asset: any) => asset[1])
            .filter(_isPredictionMarket)
            .map(_normalizePredictionMarketAsset);
    };

    const _getWhitelistedAssets = async (whitelistedIssuers: any) => {
        let assetsList: any[] = [];
        const accountObjects = await FetchChainObjects(
            (ChainStore as any).getAccount,
            whitelistedIssuers,
            undefined,
            {}
        );
        accountObjects.forEach((item: any) => {
            if (item) {
                item = item.toJS();
                assetsList = [...assetsList, ...item.assets];
            }
        });
        const assetsObjects = await FetchChainObjects(
            (ChainStore as any).getAsset,
            assetsList,
            undefined,
            {}
        );
        return assetsObjects.map((item: any) => item.toJS());
    };

    const isMountRef = React.useRef(true);
    React.useEffect(() => {
        if (!isMountRef.current) return;
        isMountRef.current = false;
        getPredictionMarketIssuers().then((whitelistedIssuers: any) => {
            _getWhitelistedAssets(whitelistedIssuers).then(
                (fetchedAssets: any) => {
                    const predictionMarkets = fetchedAssets
                        .filter(_isPredictionMarket)
                        .map(_normalizePredictionMarketAsset);
                    mergeState({
                        whitelistedIssuers,
                        predictionMarkets,
                        fetching: false
                    });
                }
            );
        });
        // eslint-disable-next-line
    }, []);

    const isUpdateMountRef = React.useRef(true);
    React.useEffect(() => {
        if (isUpdateMountRef.current) {
            isUpdateMountRef.current = false;
            return;
        }
        if (!stateRef.current.fetchAllAssets) return;
        const lastAsset = (assets as any)
            .sort((a: any, b: any) => {
                if (a.symbol > b.symbol) {
                    return 1;
                } else if (a.symbol < b.symbol) {
                    return -1;
                } else {
                    return 0;
                }
            })
            .last();
        const predictionMarkets = _getPredictionMarketList(assets);
        (AssetActions as any).getAssetList.defer(lastAsset.symbol, 100);
        const fetchingFinished =
            stateRef.current.lastAssetSymbol === lastAsset.symbol;
        setTimeout(() => {
            mergeState({
                predictionMarkets: predictionMarkets,
                lastAssetSymbol: lastAsset.symbol,
                fetchAllAssets: !fetchingFinished,
                fetching: !fetchingFinished
            });
        }, 0);
        // eslint-disable-next-line
    }, [assets]);

    const triggerFetchAllAssets = () => {
        mergeState({
            fetching: true,
            fetchAllAssets: true
        });
        // wait for 150ms to make sure loading is displayed
        // (BindToCurrentAccount and PredictioMarketsOverviewTable are both debounced)
        setTimeout(() => (AssetActions as any).getAssetList("", 100), 300);
    };

    return (
        <PredictionMarkets
            assets={assets}
            whitelistedIssuers={state.whitelistedIssuers}
            predictionMarkets={state.predictionMarkets}
            loading={state.fetching}
            fetchAllAssets={triggerFetchAllAssets}
        />
    );
}

function PMAssetsContainer() {
    const assetState = useAltStore<any>(AssetStore);
    useAltStore(MarketsStore);

    return <PMAssetsContainerCore assets={assetState.assets} />;
}

export default bindToCurrentAccount(PMAssetsContainer as any);
