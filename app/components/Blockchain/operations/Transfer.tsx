// TypeScript port of the legacy Transfer.jsx (Phase 5,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes - already a
// function component, so this just adds types.
import * as React from "react";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";
import MemoText from "../MemoText";

interface TransferProps {
    op: any;
    proposer?: any;
    index?: any;
    changeColor: (color: string) => void;
}

export const Transfer = ({op, changeColor}: TransferProps) => {
    changeColor("success"); // color of a label
    let memoComponent = null;

    if (op[1].memo) {
        memoComponent = <MemoText memo={op[1].memo} />;
    }
    op[1].amount.amount = parseFloat(op[1].amount.amount);

    return (
        <span className="right-td">
            <div className="inline-block">
                <div>
                    <TranslateWithLinks
                        string="operation.transfer"
                        keys={[
                            {
                                type: "account",
                                value: op[1].from,
                                arg: "from"
                            },
                            {
                                type: "amount",
                                value: op[1].amount,
                                arg: "amount"
                            },
                            {
                                type: "account",
                                value: op[1].to,
                                arg: "to"
                            }
                        ]}
                    />
                    {memoComponent}
                </div>
            </div>
        </span>
    );
};
