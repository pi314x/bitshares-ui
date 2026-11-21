// TypeScript port of the legacy ProposalCreate.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";
import ProposedOperation from "../ProposedOperation";

const ShortObjectId = ({objectId}: {objectId: any}) => {
    if (typeof objectId === "string") {
        const parts = objectId.split(".");
        const {length} = parts;
        if (length > 0) return "#" + parts[length - 1];
    }
    return objectId;
};

interface ProposalCreateProps {
    op: any;
    result?: any;
    fromComponent?: string;
}

export const ProposalCreate = ({
    op,
    result,
    fromComponent
}: ProposalCreateProps) => {
    if (fromComponent === "proposed_operation") {
        return (
            <span>
                <Translate
                    component="span"
                    content="proposal.proposal_create"
                />
            </span>
        );
    } else {
        return (
            <div className="inline-block">
                <span>
                    <TranslateWithLinks
                        string="operation.proposal_create"
                        keys={[
                            {
                                type: "account",
                                value: op[1] && op[1].fee_paying_account,
                                arg: "account"
                            },
                            {
                                value: result ? (
                                    <ShortObjectId objectId={result[1]} />
                                ) : (
                                    ""
                                ),
                                arg: "proposal"
                            }
                        ]}
                    />
                    :
                </span>
                <div>
                    {op[1] &&
                        op[1].proposed_ops.map((o: any, index: number) => {
                            return (
                                <ProposedOperation
                                    op={o.op}
                                    key={index}
                                    index={index}
                                    inverted={false}
                                    hideFee={true}
                                    hideOpLabel={true}
                                    hideDate={true}
                                    proposal={true}
                                />
                            );
                        })}
                </div>
            </div>
        );
    }
};
