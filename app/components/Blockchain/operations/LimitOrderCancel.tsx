// TypeScript port of the legacy LimitOrderCancel.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";

interface LimitOrderCancelProps {
    op: any;
    changeColor: (color: string) => void;
    fromComponent?: string;
    linkToAccount: (nameOrId: any) => React.ReactNode;
}

export const LimitOrderCancel = ({
    op,
    changeColor,
    fromComponent,
    linkToAccount
}: LimitOrderCancelProps) => {
    changeColor("cancel");

    if (fromComponent === "proposed_operation") {
        return (
            <span>
                {linkToAccount(op[1].fee_paying_account)}
                &nbsp;
                <Translate
                    component="span"
                    content="proposal.limit_order_cancel"
                />
                &nbsp;#
                {op[1].order.substring(4)}
            </span>
        );
    } else {
        return (
            <span>
                <TranslateWithLinks
                    string="operation.limit_order_cancel"
                    keys={[
                        {
                            type: "account",
                            value: op[1].fee_paying_account,
                            arg: "account"
                        }
                    ]}
                    params={{
                        order: op[1].order.substring(4)
                    }}
                />
            </span>
        );
    }
};
