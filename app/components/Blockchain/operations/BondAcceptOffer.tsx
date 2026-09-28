// TypeScript port of the legacy BondAcceptOffer.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";
import FormattedAsset from "../../Utility/FormattedAsset";

interface BondAcceptOfferProps {
    op: any;
    linkToAccount: (nameOrId: any) => React.ReactNode;
    current?: any;
}

export const BondAcceptOffer = ({
    op,
    linkToAccount,
    current
}: BondAcceptOfferProps) => {
    if (current === op[1].lender) {
        return (
            <span>
                <Translate
                    component="span"
                    content="proposal.bond_accept_offer"
                />
                &nbsp;
                <FormattedAsset
                    style={{fontWeight: "bold"}}
                    amount={op[1].amount_borrowed.amount}
                    asset={op[1].amount_borrowed.asset_id}
                />
                <Translate component="span" content="proposal.to" />
                &nbsp;
                {linkToAccount(op[1].borrower)}
            </span>
        );
    } else if (current === op[1].borrower) {
        return (
            <span>
                <Translate
                    component="span"
                    content="proposal.bond_accept_offer"
                />
                &nbsp;
                <FormattedAsset
                    style={{fontWeight: "bold"}}
                    amount={op[1].amount_borrowed.amount}
                    asset={op[1].amount_borrowed.asset_id}
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
