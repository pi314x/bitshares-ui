// TypeScript port of the legacy HtlcRedeemed.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";

interface HtlcRedeemedProps {
    op: any;
}

export const HtlcRedeemed = ({op}: HtlcRedeemedProps) => {
    return (
        <span className="right-td">
            <TranslateWithLinks
                string="operation.htlc_redeemed"
                keys={[
                    {
                        type: "account",
                        value: op[1].to,
                        arg: "to"
                    },
                    {
                        type: "account",
                        value: op[1].from,
                        arg: "from"
                    },
                    {
                        type: "amount",
                        value: op[1].amount,
                        arg: "amount",
                        decimalOffset:
                            op[1].amount.asset_id === "1.3.0" ? 5 : null
                    },
                    {
                        value: op[1].htlc_id,
                        arg: "htlc_id"
                    }
                ]}
            />
        </span>
    );
};
