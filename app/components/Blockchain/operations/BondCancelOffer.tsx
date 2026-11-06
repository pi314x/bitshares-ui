// TypeScript port of the legacy BondCancelOffer.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";

interface BondCancelOfferProps {
    op: any;
}

export const BondCancelOffer = ({op}: BondCancelOfferProps) => {
    return (
        <span>
            <Translate component="span" content="proposal.bond_cancel_offer" />
            &nbsp;
            {op[1].offer_id}
        </span>
    );
};
