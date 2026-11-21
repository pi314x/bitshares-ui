// TypeScript port of the legacy TransferFromBlind.jsx (Phase 5,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes - already a
// function component, so this just adds types.
import * as React from "react";
import Translate from "react-translate-component";
import FormattedAsset from "../../Utility/FormattedAsset";

interface TransferFromBlindProps {
    op: any;
    linkToAccount: (nameOrId: any) => React.ReactNode;
    fromComponent?: string;
}

export const TransferFromBlind = ({
    op,
    linkToAccount,
    fromComponent
}: TransferFromBlindProps) => {
    return (
        <span>
            {linkToAccount(op[1].to)}
            &nbsp;
            <Translate
                component="span"
                content={
                    fromComponent === "proposed_operation"
                        ? "proposal.received"
                        : "transaction.received"
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
