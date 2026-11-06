// TypeScript port of the legacy HtlcExtend.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";

interface HtlcExtendProps {
    op: any;
}

export const HtlcExtend = ({op}: HtlcExtendProps) => {
    return (
        <span className="right-td">
            <TranslateWithLinks
                string="operation.htlc_extend"
                keys={[
                    {
                        type: "account",
                        value: op[1].update_issuer,
                        arg: "update_issuer"
                    },
                    {
                        type: "timespan",
                        arg: "seconds_to_add",
                        value: op[1].seconds_to_add
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
