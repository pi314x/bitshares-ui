// TypeScript port of the legacy AssetUpdateIssuer.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";

interface AssetUpdateIssuerProps {
    op: any;
}

export const AssetUpdateIssuer = ({op}: AssetUpdateIssuerProps) => {
    return (
        <TranslateWithLinks
            string="operation.asset_update_issuer"
            keys={[
                {
                    type: "account",
                    value: op[1].issuer,
                    arg: "from_account"
                },
                {
                    type: "account",
                    value: op[1].new_issuer,
                    arg: "to_account"
                },
                {
                    type: "asset",
                    value: op[1].asset_to_update,
                    arg: "asset"
                }
            ]}
        />
    );
};
