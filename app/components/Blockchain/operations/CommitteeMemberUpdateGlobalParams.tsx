// TypeScript port of the legacy CommitteeMemberUpdateGlobalParams.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";

interface CommitteeMemberUpdateGlobalParamsProps {
    fromComponent?: string;
}

export const CommitteeMemberUpdateGlobalParams = ({
    fromComponent
}: CommitteeMemberUpdateGlobalParamsProps) => {
    return (
        <span>
            <TranslateWithLinks
                string={
                    fromComponent === "proposed_operation"
                        ? "proposal.committee_member_update_global_parameters"
                        : "operation.committee_member_update_global_parameters"
                }
                keys={[
                    {
                        type: "account",
                        value: "1.2.0",
                        arg: "account"
                    }
                ]}
            />
        </span>
    );
};
