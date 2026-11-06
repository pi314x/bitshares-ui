// TypeScript port of the legacy WitnessUpdate.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";

interface WitnessUpdateProps {
    op: any;
    linkToAccount: (nameOrId: any) => React.ReactNode;
    fromComponent?: string;
}

export const WitnessUpdate = ({
    op,
    linkToAccount,
    fromComponent
}: WitnessUpdateProps) => {
    if (fromComponent === "proposed_operation") {
        return (
            <span>
                <Translate component="span" content="proposal.witness_update" />
                &nbsp;
                {linkToAccount(op[1].witness_account)}
            </span>
        );
    } else {
        return (
            <span>
                <TranslateWithLinks
                    string="operation.witness_update"
                    keys={[
                        {
                            type: "account",
                            value: op[1].witness_account,
                            arg: "account"
                        }
                    ]}
                />
            </span>
        );
    }
};
