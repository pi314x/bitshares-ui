// TypeScript port of the legacy AssetClaimFees.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes. The
// `BindToChainState.Wrapper` render-prop usage is kept exactly as-is
// (not part of this migration's BindToChainState-replacement scope).
/* eslint-disable react/display-name */
import * as React from "react";
import BindToChainState from "../../Utility/BindToChainState";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";

const BindToChainStateWrapper = (BindToChainState as any).Wrapper;

interface AssetClaimFeesProps {
    op: any;
    changeColor: (color: string) => void;
    linkToAccount: (nameOrId: any) => React.ReactNode;
}

export const AssetClaimFees = ({
    op,
    changeColor,
    linkToAccount
}: AssetClaimFeesProps) => {
    changeColor("success");
    op[1].amount_to_claim.amount = parseInt(op[1].amount_to_claim.amount, 10);

    return (
        <span>
            {linkToAccount(op[1].issuer)}
            &nbsp;
            <BindToChainStateWrapper asset={op[1].amount_to_claim.asset_id}>
                {({asset}: any) => (
                    <TranslateWithLinks
                        string="transaction.asset_claim_fees"
                        keys={[
                            {
                                type: "amount",
                                value: op[1].amount_to_claim,
                                arg: "balance_amount"
                            },
                            {
                                type: "asset",
                                value: asset.get("id"),
                                arg: "asset"
                            }
                        ]}
                    />
                )}
            </BindToChainStateWrapper>
        </span>
    );
};
