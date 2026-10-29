// TypeScript port of the legacy TicketCreate.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Dropped as confirmed dead (visible directly in the original file, no
// grep needed): the `FormattedAsset` and `ChainTypes` imports were never
// referenced anywhere in the component.
import * as React from "react";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";
import counterpart from "counterpart";

interface TicketCreateProps {
    op: any;
    linkToAccount?: (nameOrId: any) => React.ReactNode;
    fromComponent?: string;
}

export const TicketCreate = ({op}: TicketCreateProps) => {
    return (
        <span>
            <TranslateWithLinks
                string="operation.ticket_create"
                keys={[
                    {
                        type: "account",
                        value: op[1].account,
                        arg: "account"
                    },
                    {
                        type: "amount",
                        value: op[1].amount,
                        arg: "amount"
                    }
                ]}
            />
            &nbsp; (
            {counterpart.translate(
                "operation.ticket_types." + op[1].target_type
            )}
            )
        </span>
    );
};
