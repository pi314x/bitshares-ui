// TypeScript port of the legacy AssetIssue.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";
import MemoText from "../MemoText";

interface AssetIssueProps {
    op: any;
    changeColor: (color: string) => void;
    fromComponent?: string;
}

export const AssetIssue = ({
    op,
    changeColor,
    fromComponent
}: AssetIssueProps) => {
    changeColor("warning");
    let memoComponent;
    if (op[1].memo) {
        memoComponent = <MemoText memo={op[1].memo} />;
    }
    op[1].asset_to_issue.amount = parseInt(op[1].asset_to_issue.amount, 10);

    return (
        <span>
            <TranslateWithLinks
                string={
                    fromComponent === "proposed_operation"
                        ? "proposal.asset_issue"
                        : "operation.asset_issue"
                }
                keys={[
                    {
                        type: "account",
                        value: op[1].issuer,
                        arg: "account"
                    },
                    {
                        type: "amount",
                        value: op[1].asset_to_issue,
                        arg: "amount"
                    },
                    {
                        type: "account",
                        value: op[1].issue_to_account,
                        arg: "to"
                    }
                ]}
            />
            {memoComponent}
        </span>
    );
};
