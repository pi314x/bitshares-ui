// TypeScript port of the legacy AccountUpgrade.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";

interface AccountUpgradeProps {
    op: any;
    linkToAccount: (nameOrId: any) => React.ReactNode;
    fromComponent?: string;
}

export const AccountUpgrade = ({
    op,
    linkToAccount,
    fromComponent
}: AccountUpgradeProps) => {
    if (fromComponent === "proposed_operation") {
        if (op[1].upgrade_to_lifetime_member) {
            return (
                <span>
                    {linkToAccount(op[1].account_to_upgrade)} &nbsp;
                    <Translate
                        component="span"
                        content="proposal.lifetime_upgrade_account"
                    />
                </span>
            );
        } else {
            return (
                <span>
                    {linkToAccount(op[1].account_to_upgrade)} &nbsp;
                    <Translate
                        component="span"
                        content="proposal.annual_upgrade_account"
                    />
                </span>
            );
        }
    } else {
        return (
            <span>
                <TranslateWithLinks
                    string={
                        op[1].upgrade_to_lifetime_member
                            ? "operation.lifetime_upgrade_account"
                            : "operation.annual_upgrade_account"
                    }
                    keys={[
                        {
                            type: "account",
                            value: op[1].account_to_upgrade,
                            arg: "account"
                        }
                    ]}
                />
            </span>
        );
    }
};
