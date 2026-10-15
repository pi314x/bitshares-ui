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
// `useReduxState` call; there is nothing for it to subscribe to or inject.
import * as React from "react";
import counterpart from "counterpart";
import {SubMenu} from "../../../design-system/SubMenu";
import CreditOfferList from "./CreditOfferList";
import CreditDebtList from "./CreditDebtList";
import CreditRightsList from "./CreditRightsList";
import styles from "./CreditOfferAccountPage.module.scss";

interface CreditOfferAccountPageProps {
    account?: any;
}

type View = "offers" | "rights" | "debts";

// A second level of views under the portfolio's own tab strip: the quieter
// switch (the one the voting page uses), not a second row of page tabs.
function CreditOfferAccountPage({account}: CreditOfferAccountPageProps) {
    const [view, setView] = React.useState<View>("offers");
    const items = [
        {
            key: "offers",
            label: counterpart.translate("credit_offer.credit_offers")
        },
        {
            key: "rights",
            label: counterpart.translate("credit_offer.credit_rights")
        },
        {
            key: "debts",
            label: counterpart.translate("credit_offer.credit_debts")
        }
    ];
    return (
        <div>
            <div className={styles.views}>
                <SubMenu
                    aria-label={counterpart.translate("account.credit_offer")}
                    items={items}
                    value={view}
                    onChange={key => setView(key as View)}
                />
            </div>
            <div className={styles.list}>
                {view === "offers" ? (
                    <CreditOfferList account={account} />
                ) : view === "rights" ? (
                    <CreditRightsList account={account} />
                ) : (
                    <CreditDebtList account={account} />
                )}
            </div>
        </div>
    );
}

export default CreditOfferAccountPage;
