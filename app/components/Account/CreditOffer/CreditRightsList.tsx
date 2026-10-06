// TypeScript/functional-component port of the legacy CreditRightsList.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical class-to-hooks
// translation, no logic changes.
//
// Not security-sensitive per AGENTS.md: grepped this file for
// `WalletDb`, wallet-unlock, key-import/export and transaction-signing
// call sites - none appear. It only fetches and renders a read-only list
// of credit deals via `CreditOfferActions.getCreditDealsByOfferOwner`.
//
// Structural change (not a behavior change): the original's
// `connect(CreditRightsList, {listenTo: [AccountStore, CreditOfferStore],
// getProps})` is replaced by a small container component calling
// `useAltStore` once per store, matching this migration's established
// `connect` replacement pattern. `getProps()`'s `currentAccount`/
// `passwordAccount` (from `AccountStore`) are grep-confirmed never read
// anywhere in this file (only `props.account` - passed directly by the
// caller, not store-derived - and `props.dealsByOfferOwner`, from
// `CreditOfferStore`, are read) - `useAltStore(AccountStore)` is still
// called (return value discarded) purely to preserve the
// `listenTo`-driven re-render-on-`AccountStore`-change behavior, same
// precedent as `Account/CreditOffer/CreateModal.tsx`'s container.
//
// `componentDidMount`'s one-shot
// `CreditOfferActions.getCreditDealsByOfferOwner({name_or_id:
// props.account.get("id"), flag: "first"})` call becomes a mount-only
// `useEffect(() => {...}, [])`, matching this migration's established
// `componentDidMount`-to-`useEffect` translation (no other lifecycle
// method existed on the original class, so no further translation was
// needed).
//
// No refs, no imperative APIs: grepped every usage of `CreditRightsList`
// app-wide - only `Account/CreditOffer/CreditOfferAccountPage.jsx`
// (out of scope for this port, left untouched) renders
// `<CreditRightsList account={this.props.account} />`, with no `ref`.
import * as React from "react";
import counterpart from "counterpart";
import AccountStore from "../../../stores/AccountStore";
import CreditOfferStore from "../../../stores/CreditOfferStore";
import {Table} from "../../../design-system/Table";
import CreditOfferActions, {
    FEE_RATE_DENOM
} from "../../../actions/CreditOfferActions";
import LinkToAccountById from "../../Utility/LinkToAccountById";
import FormattedAsset from "../../Utility/FormattedAsset";
import moment from "moment";
import {useAltStore} from "../../../next/hooks/useAltStore";

interface CreditRightsListCoreProps {
    account: any;
    dealsByOfferOwner?: any[];
}

function CreditRightsListCore({
    account,
    dealsByOfferOwner
}: CreditRightsListCoreProps) {
    React.useEffect(() => {
        CreditOfferActions.getCreditDealsByOfferOwner({
            name_or_id: account.get("id"),
            flag: "first"
        });
    }, []);

    const _getColumns = () => {
        return [
            {
                key: "id",
                title: "ID",
                dataIndex: "id"
            },
            {
                key: "borrower",
                title: counterpart.translate(
                    "credit_offer.credit_debt_account"
                ),
                dataIndex: "borrower",
                render: (account: any) => (
                    <LinkToAccountById account={account} />
                )
            },
            {
                key: "debt_asset",
                title: counterpart.translate("credit_offer.debt"),
                dataIndex: "debt_asset",
                align: "right",
                render: (text: any, row: any) => (
                    <FormattedAsset
                        asset={text}
                        amount={row.debt_amount}
                        trimZero
                    />
                )
            },
            {
                key: "fee_rate",
                title: counterpart.translate("credit_offer.fee_rate"),
                align: "right",
                render: (_: any, row: any) => (
                    <FormattedAsset
                        asset={row.debt_asset}
                        amount={
                            (parseFloat(row.fee_rate) / FEE_RATE_DENOM) *
                            row.debt_amount
                        }
                        trimZero
                    />
                )
            },
            {
                key: "mortgage_assets",
                title: counterpart.translate("credit_offer.mortgage_assets"),
                align: "right",
                render: (_: any, row: any) => (
                    <FormattedAsset
                        asset={row.collateral_asset}
                        amount={row.collateral_amount}
                        trimZero
                    />
                )
            },
            {
                key: "latest_repay_time",
                title: counterpart.translate("credit_offer.repay_period"),
                dataIndex: "latest_repay_time",
                render: (time: any) =>
                    moment
                        .utc(time)
                        .local()
                        .format("YYYY-MM-DD HH:mm:ss")
            }
        ];
    };

    return (
        <div className="grid-content no-overflow no-padding">
            <div className="generic-bordered-box">
                <div className="grid-wrapper">
                    <Table
                        rowKey="id"
                        columns={_getColumns() as any}
                        dataSource={dealsByOfferOwner || []}
                        pagination={{
                            hideOnSinglePage: true,
                            pageSize: 10
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

interface CreditRightsListProps {
    account: any;
}

function CreditRightsList(props: CreditRightsListProps) {
    // Preserves `listenTo: [AccountStore, CreditOfferStore]`'s re-render
    // cadence - `currentAccount`/`passwordAccount` (AccountStore) are
    // grep-confirmed unused downstream, see header comment.
    useAltStore(AccountStore);
    const creditOfferState = useAltStore<any>(CreditOfferStore);

    return (
        <CreditRightsListCore
            {...props}
            dealsByOfferOwner={creditOfferState.dealsByOfferOwner}
        />
    );
}

export default CreditRightsList;
