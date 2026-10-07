// TypeScript/functional-component port of the legacy
// CreditOfferAccountPage.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
// Mechanical, no logic changes. The final file of `Account/CreditOffer/`
// (7/7) - ported directly by the orchestrating session (not delegated),
// since it imports `CreditOfferList.tsx` (ported in this same commit),
// `CreditDebtList.tsx`, and `CreditRightsList.tsx` (both from earlier
// batches in this directory).
//
// Not security-sensitive itself per AGENTS.md: this component only lays
// out three already-ported tabs and forwards its `account` prop to each;
// no transaction is built or dispatched here directly (that logic lives
// in the three child components it renders).
//
// `connect(CreditOfferAccountPage, {})` - an empty options object, with
// no `listenTo` and no `getProps` - is a pure no-op wrapper (grep-
// confirmed: `{}` supplies neither a store subscription nor any derived
// props), so it's dropped entirely rather than translated to a
// `useAltStore` call; there is nothing for it to subscribe to or inject.
import * as React from "react";
import counterpart from "counterpart";
import {Tabs, Tab} from "../../Utility/Tabs";
import CreditOfferList from "./CreditOfferList";
import CreditDebtList from "./CreditDebtList";
import CreditRightsList from "./CreditRightsList";

interface CreditOfferAccountPageProps {
    account?: any;
}

function CreditOfferAccountPage({account}: CreditOfferAccountPageProps) {
    return (
        <Tabs
            defaultActiveTab={0}
            className="account-tabs"
            tabsClass="account-overview no-padding bordered-header content-block"
        >
            <Tab title={counterpart.translate("credit_offer.credit_offers")}>
                <CreditOfferList account={account} />
            </Tab>
            <Tab title={counterpart.translate("credit_offer.credit_rights")}>
                <CreditRightsList account={account} />
            </Tab>
            <Tab title={counterpart.translate("credit_offer.credit_debts")}>
                <CreditDebtList account={account} />
            </Tab>
        </Tabs>
    );
}

export default CreditOfferAccountPage;
