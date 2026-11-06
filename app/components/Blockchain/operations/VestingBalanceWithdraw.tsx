// TypeScript port of the legacy VestingBalanceWithdraw.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";

interface VestingBalanceWithdrawProps {
    op: any;
    fromComponent?: string;
}

export const VestingBalanceWithdraw = ({
    op,
    fromComponent
}: VestingBalanceWithdrawProps) => {
    return (
        <TranslateWithLinks
            string={
                fromComponent === "proposed_operation"
                    ? "proposal.vesting_balance_withdraw"
                    : "operation.vesting_balance_withdraw"
            }
            keys={[
                {
                    type: "account",
                    value: op[1].owner,
                    arg: "account"
                },
                {type: "amount", value: op[1].amount, arg: "amount"}
            ]}
        />
    );
};
