// TypeScript port of the legacy BondClaimCollaterial.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";
import FormattedAsset from "../../Utility/FormattedAsset";

interface BondClaimCollaterialProps {
    op: any;
    linkToAccount: (nameOrId: any) => React.ReactNode;
    current?: any;
}

export const BondClaimCollaterial = ({
    op,
    linkToAccount,
    current
}: BondClaimCollaterialProps) => {
    if (current === op[1].lender) {
        return (
            <span>
                <Translate
                    component="span"
                    content="proposal.bond_pay_collateral"
                />
                &nbsp;
                <FormattedAsset
                    style={{fontWeight: "bold"}}
                    amount={op[1].collateral_claimed.amount}
                    asset={op[1].collateral_claimed.asset_id}
                />
                <Translate component="span" content="proposal.to" />
                &nbsp;
                {linkToAccount(op[1].claimer)}
            </span>
        );
    } else if (current === op[1].claimer) {
        return (
            <span>
                <Translate
                    component="span"
                    content="proposal.bond_claim_collateral"
                />
                &nbsp;
                <FormattedAsset
                    style={{fontWeight: "bold"}}
                    amount={op[1].collateral_claimed.amount}
                    asset={op[1].collateral_claimed.asset_id}
                />
                <Translate component="span" content="proposal.from" />
                &nbsp;
                {linkToAccount(op[1].lender)}
            </span>
        );
    } else {
        return null;
    }
};
