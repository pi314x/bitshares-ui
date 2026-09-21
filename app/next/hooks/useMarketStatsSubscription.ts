// Ports the market-stats subscription logic from
// app/components/Utility/MarketStatsCheck.jsx (the base class TotalValue
// extended) to a hook. This is the piece that keeps MarketsStore's
// allMarketStats populated for the asset pairs a balance display actually
// needs, by registering polling intervals through the existing
// MarketsActions/MarketsStore machinery (docs/UI_MIGRATION_PLAN.md's
// "reuse, don't rewrite": the interval polling and order-book-derived
// price stats themselves are NOT reimplemented here, only the routing
// logic that decides which asset pairs to poll directly vs. via the core
// asset).
import * as React from "react";
import {List, Map as ImmutableMap} from "immutable";
import marketUtils from "common/market_utils";
import MarketsActions from "actions/MarketsActions";

type ChainAsset = any;
type MarketStats = any;

function useDirectMarket(
    fromAsset: ChainAsset,
    toAsset: ChainAsset,
    allMarketStats: ImmutableMap<string, MarketStats>
): boolean {
    if (!fromAsset) return false;
    const {marketName: directMarket} = marketUtils.getMarketName(
        toAsset,
        fromAsset
    );
    const directStats = allMarketStats.get(directMarket);
    if (directStats && directStats.volumeBase === 0) return false;
    return true;
}

/**
 * Registers polling for the market stats needed to convert `fromAssets`
 * into `toAsset` (directly, or indirectly through `coreAsset`), for as
 * long as the calling component is mounted.
 */
export function useMarketStatsSubscription(
    fromAssets: List<ChainAsset>,
    toAsset: ChainAsset | undefined,
    coreAsset: ChainAsset | undefined,
    allMarketStats: ImmutableMap<string, MarketStats>
): void {
    const directIntervals = React.useRef<{[marketName: string]: () => void}>(
        {}
    );
    const fromIntervals = React.useRef<{[marketName: string]: () => void}>(
        {}
    );
    const toInterval = React.useRef<(() => void) | null>(null);
    const throttleTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
        null
    );

    React.useEffect(() => {
        if (!toAsset) return;
        if (throttleTimer.current) return;
        throttleTimer.current = setTimeout(() => {
            throttleTimer.current = null;
        }, 10 * 1000);

        const directMarkets = fromAssets
            .map(asset => {
                const {marketName: directMarket} = marketUtils.getMarketName(
                    toAsset,
                    asset
                );
                const isDirect = useDirectMarket(
                    asset,
                    toAsset,
                    allMarketStats
                );
                if (isDirect && toAsset.get("id") !== asset.get("id")) {
                    if (!directIntervals.current[directMarket]) {
                        setTimeout(() => {
                            directIntervals.current[
                                directMarket
                            ] = MarketsActions.getMarketStatsInterval(
                                5 * 60 * 1000,
                                asset,
                                toAsset
                            );
                        }, 50);
                    }
                }
                return isDirect ? directMarket : null;
            })
            .filter((a: string | null) => !!a)
            .toArray();

        const indirectAssets = fromAssets.filter(asset => {
            const {marketName: directMarket} = marketUtils.getMarketName(
                toAsset,
                asset
            );
            return directMarkets.indexOf(directMarket) === -1;
        });

        if (coreAsset && indirectAssets.size) {
            indirectAssets.forEach(asset => {
                if (asset && asset.get("id") !== coreAsset.get("id")) {
                    const {marketName} = marketUtils.getMarketName(
                        coreAsset,
                        asset
                    );
                    if (!fromIntervals.current[marketName]) {
                        setTimeout(() => {
                            fromIntervals.current[
                                marketName
                            ] = MarketsActions.getMarketStatsInterval(
                                5 * 60 * 1000,
                                coreAsset,
                                asset
                            );
                        }, 50);
                    }
                }
            });

            if (toAsset.get("id") !== coreAsset.get("id")) {
                toInterval.current = MarketsActions.getMarketStatsInterval(
                    5 * 60 * 1000,
                    coreAsset,
                    toAsset
                );
            }
        }
    }, [fromAssets, toAsset, coreAsset, allMarketStats]);

    React.useEffect(() => {
        return () => {
            Object.keys(directIntervals.current).forEach(key => {
                directIntervals.current[key]();
                delete directIntervals.current[key];
            });
            Object.keys(fromIntervals.current).forEach(key => {
                fromIntervals.current[key]();
                delete fromIntervals.current[key];
            });
            if (toInterval.current) toInterval.current();
            toInterval.current = null;
        };
    }, []);
}
