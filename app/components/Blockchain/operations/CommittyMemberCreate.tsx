// TypeScript port of the legacy CommittyMemberCreate.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes (including the
// original file/component's "Committy" typo, kept for a minimal diff).
import * as React from "react";
import Translate from "react-translate-component";

interface CommittyMemberCreateProps {
    op: any;
    linkToAccount: (nameOrId: any) => React.ReactNode;
    fromComponent?: string;
}

export const CommittyMemberCreate = ({
    op,
    linkToAccount,
    fromComponent
}: CommittyMemberCreateProps) => {
    return (
        <span>
            <Translate
                component="span"
                content={
                    fromComponent === "proposed_operation"
                        ? "proposal.committee_member_create"
                        : "transaction.committee_member_create"
                }
            />
            &nbsp;
            {linkToAccount(op[1].committee_member_account)}
        </span>
    );
};
