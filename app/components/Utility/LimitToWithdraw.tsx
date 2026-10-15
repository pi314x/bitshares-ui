// TypeScript/functional-component port of the legacy LimitToWithdraw.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import FormattedAsset from "./FormattedAsset";

interface LimitToWithdrawProps {
    amount?: any;
    assetId?: any;
    asPercentage?: any;
    assetInfo?: any;
    replace?: any;
    hide_asset?: boolean;
}

function LimitToWithdraw({
    amount,
    assetId,
    asPercentage,
    assetInfo,
    replace,
    hide_asset = false
}: LimitToWithdrawProps) {
    return (
        <FormattedAsset
            amount={amount}
            asset={assetId}
            asPercentage={asPercentage}
            assetInfo={assetInfo}
            replace={replace}
            hide_asset={hide_asset}
        />
    );
}

export default LimitToWithdraw;
