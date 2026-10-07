// TypeScript port of the legacy AssetClaimPool.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";

interface AssetClaimPoolProps {
    op: any;
}

export const AssetClaimPool = ({op}: AssetClaimPoolProps) => {
    return (
        <TranslateWithLinks
            string="operation.asset_claim_pool"
            keys={[
                {
                    type: "account",
                    value: op[1].issuer,
                    arg: "account"
                },
                {
                    type: "asset",
                    value: op[1].asset_id,
                    arg: "asset"
                },
                {
                    type: "amount",
                    value: op[1].amount_to_claim,
                    arg: "amount"
                }
            ]}
        />
    );
};
