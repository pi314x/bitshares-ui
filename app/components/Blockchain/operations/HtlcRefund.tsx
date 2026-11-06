// TypeScript port of the legacy HtlcRefund.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";

interface HtlcRefundProps {
    op: any;
    changeColor: (color: string) => void;
}

export const HtlcRefund = ({op, changeColor}: HtlcRefundProps) => {
    changeColor("warning");
    return (
        <span className="right-td">
            <TranslateWithLinks
                string="operation.htlc_refund"
                keys={[
                    {
                        value: op[1].htlc_id,
                        arg: "htlc_id"
                    },
                    {
                        type: "account",
                        value: op[1].to,
                        arg: "to"
                    }
                ]}
            />
        </span>
    );
};
