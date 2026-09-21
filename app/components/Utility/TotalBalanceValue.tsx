// TypeScript/functional-component port of the legacy TotalBalanceValue.jsx
// (Phase 2, docs/UI_MIGRATION_PLAN.md). Reused by DashboardList.tsx,
// MarginPosition.jsx and AccountOverview.jsx exactly as the .jsx version
// was - same props, same displayed values.
//
// This replaces the legacy BindToChainState/AssetWrapper/MarketStatsCheck
// HOC stack with direct ChainStore reads plus useChainStoreTick /
// useMarketStatsSubscription (app/next/hooks) - simpler, but it means this
// component re-renders on every chain/market-stats event rather than only
// when its own shouldComponentUpdate/MarketStatsCheck logic decided a
// relevant market changed. That's a perf tradeoff, not a correctness one:
// the legacy per-market change-detection was there to cut down needless
// re-renders, not to affect what value gets displayed. See
// docs/UI_MIGRATION_PLAN.md's Phase 2 progress notes.
//
// The actual balance/collateral/debt math is NOT reimplemented here - it's
// imported from app/next/dashboard/balanceCalculations.ts, which is
// unit-tested against real mainnet account data (AGENTS.md: treat balance
// display as security-sensitive, prefer well-tested diffs over refactors).
import * as React from "react";
import {List} from "immutable";
import {ChainStore} from "bitsharesjs";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import {Tooltip} from "bitshares-ui-style-guide";
import FormattedAsset from "./FormattedAsset";
import SettingsStore from "stores/SettingsStore";
import MarketsStore from "stores/MarketsStore";
import {useAltStore} from "../../next/hooks/useAltStore";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import {useMarketStatsSubscription} from "../../next/hooks/useMarketStatsSubscription";
import {
    AssetAmounts,
    BalanceAmount,
    computeTotalValue,
    buildTotalsTooltip
} from "../../next/dashboard/balanceCalculations";

export interface TotalBalanceValueProps {
    balances: List<string>;
    collateral?: AssetAmounts;
    debt?: AssetAmounts;
    openOrders?: AssetAmounts;
    label?: string;
    hide_asset?: boolean;
    noTip?: boolean;
    inHeader?: boolean;
}

export default function TotalBalanceValue(props: TotalBalanceValueProps) {
    const {
        balances,
        collateral = {},
        debt = {},
        openOrders = {},
        label,
        hide_asset,
        noTip,
        inHeader = false
    } = props;

    useChainStoreTick();
    const settingsState = useAltStore<any>(SettingsStore);
    const marketsState = useAltStore<any>(MarketsStore);
    const allMarketStats = marketsState.allMarketStats;

    const balanceAmounts: BalanceAmount[] = [];
    const fromAssetIds: {[id: string]: true} = {};

    balances.forEach(balanceId => {
        const balance = ChainStore.getObject(balanceId);
        if (!balance) return;
        const assetType = balance.get("asset_type");
        balanceAmounts.push({
            asset_id: assetType,
            amount: parseInt(balance.get("balance"), 10)
        });
        fromAssetIds[assetType] = true;
    });
    Object.keys(collateral).forEach(id => (fromAssetIds[id] = true));
    Object.keys(debt).forEach(id => (fromAssetIds[id] = true));
    Object.keys(openOrders).forEach(id => (fromAssetIds[id] = true));

    const assetsById: {[id: string]: any} = {};
    Object.keys(fromAssetIds).forEach(id => {
        const asset = ChainStore.getAsset(id);
        if (asset) assetsById[id] = asset;
    });
    const fromAssets = List(Object.values(assetsById));

    const preferredUnit = !settingsState.settings.get("unit")
        ? "1.3.0"
        : settingsState.settings.get("unit");
    const toAsset = ChainStore.getAsset(preferredUnit);
    const coreAsset = ChainStore.getAsset("1.3.0");

    useMarketStatsSubscription(fromAssets, toAsset, coreAsset, allMarketStats);

    if (!toAsset || !coreAsset) {
        return <span />;
    }

    const {totalValue, assetValues} = computeTotalValue({
        balances: balanceAmounts,
        collateral,
        debt,
        openOrders,
        assetsById,
        toAsset,
        coreAsset,
        allMarketStats
    });

    const decimalOffset =
        toAsset.get("symbol").indexOf("BTC") === -1
            ? toAsset.get("precision") - 2
            : 4;

    const labelNode = label ? (
        <span className="font-secondary">
            <Translate content={label} />:{" "}
        </span>
    ) : null;

    if (!inHeader) {
        return (
            <span>
                {labelNode}
                <FormattedAsset
                    noTip={noTip}
                    noPrefix
                    hide_asset={hide_asset}
                    amount={totalValue}
                    asset={toAsset.get("id")}
                    decimalOffset={decimalOffset}
                />
            </span>
        );
    }

    const {html: totalsTip} = buildTotalsTooltip({
        assetValues,
        assetsById,
        toAsset,
        translateTotalEstimate: () =>
            counterpart.translate("account.total_estimate")
    });

    return (
        <Tooltip placement="bottom" title={totalsTip}>
            <div className="tooltip inline-block">
                {labelNode}
                <FormattedAsset
                    noTip
                    noPrefix
                    hide_asset={hide_asset}
                    amount={totalValue}
                    asset={toAsset.get("id")}
                    decimalOffset={decimalOffset}
                />
            </div>
        </Tooltip>
    );
}
