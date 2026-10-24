// TypeScript/functional-component port of the legacy
// BalanceClaimAssetTotal.jsx (Phase 5, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes. `connect()`'s `getProps()` (a bare
// `BalanceClaimActiveStore.getState()` passthrough) is replaced by
// `useReduxState(selectBalanceClaimActive)`.
import * as React from "react";
import FormattedAsset from "components/Utility/FormattedAsset";
import Translate from "react-translate-component";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectBalanceClaimActive} from "../../store/slices/balanceClaimActiveSlice";

export default function BalanceClaimAssetTotals() {
    const {balances} = useReduxState<any>(selectBalanceClaimActive);

    if (balances === undefined)
        return (
            <div>
                <Translate content="wallet.loading_balances" />
                &hellip;
            </div>
        );

    const total_by_asset = balances
        .groupBy((v: any) => v.balance.asset_id)
        .map((l: any) =>
            l.reduce((r: any, v: any) => r + Number(v.balance.amount), 0)
        );

    if (!total_by_asset.size) return <div>None</div>;

    return (
        <div>
            {total_by_asset
                .map((total: any, asset_id: any) => (
                    <div key={asset_id}>
                        <FormattedAsset
                            color="info"
                            amount={total}
                            asset={asset_id}
                        />
                    </div>
                ))
                .valueSeq()
                .toArray()}
        </div>
    );
}
