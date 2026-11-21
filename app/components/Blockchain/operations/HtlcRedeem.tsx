// TypeScript port of the legacy HtlcRedeem.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";
import {Tooltip} from "../../../design-system/Tooltip";
import counterpart from "counterpart";

interface HtlcRedeemProps {
    op: any;
    changeColor: (color: string) => void;
}

export const HtlcRedeem = ({op, changeColor}: HtlcRedeemProps) => {
    changeColor("success");
    return (
        <React.Fragment>
            <span className="right-td">
                <TranslateWithLinks
                    string="operation.htlc_redeem"
                    keys={[
                        {
                            type: "account",
                            value: op[1].redeemer,
                            arg: "redeemer"
                        },
                        {
                            value: op[1].htlc_id,
                            arg: "htlc_id"
                        }
                    ]}
                />
            </span>
            <div className="memo" style={{paddingTop: 5, cursor: "help"}}>
                <Tooltip
                    placement="bottom"
                    title={counterpart.translate("htlc.preimage_explanation")}
                >
                    <span className="inline-block">
                        {counterpart.translate("htlc.preimage") +
                            ": " +
                            op[1].preimage}
                    </span>
                </Tooltip>
            </div>
        </React.Fragment>
    );
};
