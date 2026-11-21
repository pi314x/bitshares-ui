// TypeScript port of the legacy AssetSettleCancel.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";

interface AssetSettleCancelProps {
    op: any;
}

export const AssetSettleCancel = ({op}: AssetSettleCancelProps) => {
    return (
        <TranslateWithLinks
            string="operation.asset_settle_cancel"
            keys={[
                {
                    type: "account",
                    value: op[1].account,
                    arg: "account"
                },
                {type: "amount", value: op[1].amount, arg: "amount"}
            ]}
        />
    );
};
