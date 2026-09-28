// TypeScript port of the legacy BidCollateral.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";

interface BidCollateralProps {
    op: any;
}

export const BidCollateral = ({op}: BidCollateralProps) => {
    return (
        <TranslateWithLinks
            string="operation.bid_collateral"
            keys={[
                {
                    type: "account",
                    value: op[1].bidder,
                    arg: "bid_account"
                },
                {
                    type: "amount",
                    value: op[1].additional_collateral,
                    arg: "collateral"
                },
                {
                    type: "amount",
                    value: op[1].debt_covered,
                    arg: "debt"
                }
            ]}
        />
    );
};
