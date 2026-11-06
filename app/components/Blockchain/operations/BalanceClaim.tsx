// TypeScript port of the legacy BalanceClaim.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes. The
// `BindToChainState.Wrapper` render-prop usage is kept exactly as-is
// (not part of this migration's BindToChainState-replacement scope).
/* eslint-disable react/display-name */
import * as React from "react";
import Translate from "react-translate-component";
import BindToChainState from "../../Utility/BindToChainState";
import utils from "common/utils";
import TranslateWithLinks from "../../Utility/TranslateWithLinks";

const BindToChainStateWrapper = (BindToChainState as any).Wrapper;

interface BalanceClaimProps {
    op: any;
    changeColor: (color: string) => void;
    linkToAccount: (nameOrId: any) => React.ReactNode;
    fromComponent?: string;
}

export const BalanceClaim = ({
    op,
    changeColor,
    linkToAccount,
    fromComponent
}: BalanceClaimProps) => {
    changeColor("success");
    op[1].total_claimed.amount = parseInt(op[1].total_claimed.amount, 10);

    if (fromComponent === "proposed_operation") {
        return (
            <span>
                {linkToAccount(op[1].deposit_to_account)}
                &nbsp;
                <BindToChainStateWrapper asset={op[1].total_claimed.asset_id}>
                    {({asset}: any) => (
                        <Translate
                            component="span"
                            content="proposal.balance_claim"
                            balance_amount={(utils as any).format_asset(
                                op[1].total_claimed.amount,
                                asset
                            )}
                            balance_id={op[1].balance_to_claim.substring(5)}
                        />
                    )}
                </BindToChainStateWrapper>
            </span>
        );
    } else {
        return (
            <span>
                <TranslateWithLinks
                    string="operation.balance_claim"
                    keys={[
                        {
                            type: "account",
                            value: op[1].deposit_to_account,
                            arg: "account"
                        },
                        {
                            type: "amount",
                            value: op[1].total_claimed,
                            arg: "amount"
                        }
                    ]}
                />
            </span>
        );
    }
};
