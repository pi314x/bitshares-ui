// TypeScript port of the legacy OverrideTransfer.jsx (Phase 5,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes - already a
// function component, so this just adds types.
import * as React from "react";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";

interface OverrideTransferProps {
    op: any;
    fromComponent?: string;
}

export const OverrideTransfer = ({
    op,
    fromComponent
}: OverrideTransferProps) => {
    return (
        <TranslateWithLinks
            string={
                fromComponent === "proposed_operation"
                    ? "proposal.override_transfer"
                    : "operation.override_transfer"
            }
            keys={[
                {
                    type: "account",
                    value: op[1].issuer,
                    arg: "issuer"
                },
                {type: "account", value: op[1].from, arg: "from"},
                {type: "account", value: op[1].to, arg: "to"},
                {type: "amount", value: op[1].amount, arg: "amount"}
            ]}
        />
    );
};
