// TypeScript port of the legacy CallOrderUpdate.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";

interface CallOrderUpdateProps {
    op: any;
    changeColor: (color: string) => void;
    fromComponent?: string;
}

export const CallOrderUpdate = ({
    op,
    changeColor,
    fromComponent
}: CallOrderUpdateProps) => {
    changeColor("warning");

    return (
        <span>
            <TranslateWithLinks
                string={
                    fromComponent === "proposed_operation"
                        ? "proposal.call_order_update"
                        : "operation.call_order_update"
                }
                keys={[
                    {
                        type: "account",
                        value: op[1].funding_account,
                        arg: "account"
                    },
                    {
                        type: "asset",
                        value: op[1].delta_debt.asset_id,
                        arg: "debtSymbol"
                    },
                    {
                        type: "amount",
                        value: op[1].delta_debt,
                        arg: "debt"
                    },
                    {
                        type: "amount",
                        value: op[1].delta_collateral,
                        arg: "collateral"
                    }
                ]}
            />
        </span>
    );
};
