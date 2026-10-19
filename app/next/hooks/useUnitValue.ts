// The value of amounts of assets in the user's chosen currency (Settings >
// preferred unit of account), kept up to date: it registers the market stats the
// conversion needs for as long as the calling component is mounted.
import * as React from "react";
import {List} from "immutable";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "./useChainStoreTick";
import {useReduxState} from "./useReduxState";
import {useMarketStatsSubscription} from "./useMarketStatsSubscription";
import {selectSettingsState} from "../../store/slices/settingsSlice";
import {selectMarkets} from "../../store/slices/marketsSlice";
import {convertAssetValue} from "../dashboard/balanceCalculations";
import {formatUnitValue, toHuman} from "../../lib/common/unitValue";

export interface UnitValue {
    /** The chosen currency, once the chain has told what it is. */
    unit: {id: string; symbol: string; precision: number} | null;
    /** `units` (smallest steps) of the asset in the unit, human; null: no price. */
    valueOf(assetId: string, units: number | bigint): number | null;
    /** The same as text ("1,234.56 XBTSX.USDT"), or null. */
    format(assetId: string, units: number | bigint): string | null;
}

// The chain store's asset, or null while it is not there (or not set up).
function assetOf(idOrSymbol: string): any {
    try {
        const asset: any = (ChainStore as any).getAsset(idOrSymbol);
        return asset && typeof asset.get === "function" ? asset : null;
    } catch (e) {
        return null;
    }
}

export function useUnitValue(assetIds: string[]): UnitValue {
    useChainStoreTick();
    const settings = useReduxState<any>(selectSettingsState);
    const marketsState = useReduxState<any>(selectMarkets);
    const stats = marketsState.allMarketStats;

    const unitSymbol: string = settings.settings.get("unit") || "BTS";
    const toAsset: any = assetOf(unitSymbol);
    const core: any = assetOf("1.3.0");
    const known = !!toAsset;

    const fromAssets: any[] = [];
    assetIds.forEach(id => {
        const asset = assetOf(id);
        if (asset) fromAssets.push(asset);
    });
    // a stable list as long as the same assets are asked for
    const key = fromAssets.map(a => a.get("id")).join(",");
    const list = React.useMemo(() => List(fromAssets), [key]);
    useMarketStatsSubscription(
        list,
        known ? toAsset : undefined,
        core || undefined,
        stats
    );

    const unit = known
        ? {
              id: toAsset.get("id") as string,
              symbol: toAsset.get("symbol") as string,
              precision: toAsset.get("precision") as number
          }
        : null;

    const valueOf = (assetId: string, units: number | bigint) => {
        if (!unit || !core) return null;
        const amount = Number(units);
        if (assetId === unit.id) return toHuman(amount, unit.precision);
        const from = assetOf(assetId);
        if (!from) return null;
        return toHuman(
            convertAssetValue(amount, from, toAsset, stats, core),
            unit.precision
        );
    };

    return {
        unit,
        valueOf,
        format: (assetId, units) => {
            const value = valueOf(assetId, units);
            return value === null || !unit
                ? null
                : formatUnitValue(value, unit);
        }
    };
}
