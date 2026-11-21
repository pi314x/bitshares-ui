// TypeScript port of the legacy BondCreateOffer.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";
import FormattedAsset from "../../Utility/FormattedAsset";

interface BondCreateOfferProps {
    op: any;
}

export const BondCreateOffer = ({op}: BondCreateOfferProps) => {
    return (
        <span>
            <Translate component="span" content="proposal.bond_create_offer" />
            &nbsp;
            <FormattedAsset
                style={{fontWeight: "bold"}}
                amount={op[1].amount.amount}
                asset={op[1].amount.asset_id}
            />
        </span>
    );
};
