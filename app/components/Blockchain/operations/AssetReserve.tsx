// TypeScript port of the legacy AssetReserve.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";

interface AssetReserveProps {
    op: any;
    fromComponent?: string;
}

export const AssetReserve = ({op, fromComponent}: AssetReserveProps) => {
    return (
        <span>
            <TranslateWithLinks
                string={
                    fromComponent === "proposed_operation"
                        ? "proposal.asset_reserve"
                        : "operation.asset_reserve"
                }
                keys={[
                    {
                        type: "account",
                        value: op[1].payer,
                        arg: "account"
                    },
                    {
                        type: "amount",
                        value: op[1].amount_to_reserve,
                        arg: "amount"
                    }
                ]}
            />
        </span>
    );
};
