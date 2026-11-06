// TypeScript port of the legacy TransferToBlind.jsx (Phase 5,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes - already a
// function component, so this just adds types.
import * as React from "react";
import Translate from "react-translate-component";
import FormattedAsset from "../../Utility/FormattedAsset";

interface TransferToBlindProps {
    op: any;
    linkToAccount: (nameOrId: any) => React.ReactNode;
    fromComponent?: string;
}

export const TransferToBlind = ({
    op,
    linkToAccount,
    fromComponent
}: TransferToBlindProps) => {
    return (
        <span>
            {linkToAccount(op[1].from)}
            &nbsp;
            <Translate
                component="span"
                content={
                    fromComponent === "proposed_operation"
                        ? "proposal.sent"
                        : "transaction.sent"
                }
            />
            &nbsp;
            <FormattedAsset
                style={{fontWeight: "bold"}}
                amount={op[1].amount.amount}
                asset={op[1].amount.asset_id}
            />
        </span>
    );
};
