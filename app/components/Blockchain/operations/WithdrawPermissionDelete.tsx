// TypeScript port of the legacy WithdrawPermissionDelete.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";

interface WithdrawPermissionDeleteProps {
    op: any;
    linkToAccount: (nameOrId: any) => React.ReactNode;
    fromComponent?: string;
}

export const WithdrawPermissionDelete = ({
    op,
    linkToAccount,
    fromComponent
}: WithdrawPermissionDeleteProps) => {
    if (fromComponent === "proposed_operation") {
        return (
            <span>
                <Translate
                    component="span"
                    content="proposal.withdraw_permission_delete"
                />
                &nbsp;
                {linkToAccount(op[1].withdraw_from_account)}
                <Translate component="span" content="proposal.to" />
                &nbsp;
                {linkToAccount(op[1].authorized_account)}
            </span>
        );
    } else {
        return (
            <span>
                <Translate
                    component="span"
                    content="transaction.withdraw_permission_delete"
                />
                &nbsp;
                {linkToAccount(op[1].withdraw_from_account)}
                <Translate component="span" content="transaction.to" />
                &nbsp;
                {linkToAccount(op[1].authorized_account)}
            </span>
        );
    }
};
