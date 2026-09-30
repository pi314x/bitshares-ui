// TypeScript/functional-component port of the legacy CreditOfferList.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
// Ported directly by the orchestrating session (not delegated), since
// this file imports both `CreateModal.jsx`/`EditModal.jsx` - each
// already ported to `.tsx` in earlier `Account/CreditOffer/` batches -
// and is itself a dependency of the still-`.jsx` `CreditOfferAccountPage
// .jsx`, ported in the same commit as this file.
//
// Security-sensitive per AGENTS.md: dispatches `CreditOfferActions
// .disabled(...)`/`.delete(...)` (real on-chain transactions, from the
// "operate" column's icon buttons) and the read-only `CreditOfferActions
// .getCreditOffersByOwner(...)` (on mount). No password/private-key/
// brainkey material is involved (grepped - doesn't touch `WalletDb`/
// wallet-unlock/key-import flows); the actual credit-offer create/update
// transaction building lives in the already-ported `CreateModal.tsx`/
// `EditModal.tsx`, not here - this file only opens those modals and
// forwards `account`.
//
// `connect(CreditOfferList, {listenTo: [AccountStore, CreditOfferStore,
// IntlStore], getProps() {...}})` is replaced by `useAltStore(...)` calls
// for all three stores in an outer `CreditOfferList` wrapper, passed down
// to a `CreditOfferListCore` function - this migration's established
// Container+Core split. `getProps()` doesn't derive `account` itself (it
// only derives `currentAccount`/`passwordAccount`/`listByOwner`/`locale`)
// - `account` is passed straight through from the caller
// (`CreditOfferAccountPage.jsx`) unchanged, so there is no store-vs-
// passed-in-prop precedence conflict to replicate for it.
//
// `this.create_modal`/`this.edit_modal` (legacy plain-instance-property
// refs, set via `refCallback={e => { if (e) this.create_modal = e; }}`)
// become `React.useRef<CreateModalHandle | null>(null)`/
// `useRef<EditModalHandle | null>(null)`, with the exact same
// `refCallback` prop shape passed through unchanged to `<CreateModal>`/
// `<EditModal>` - both of those files' own ports already accept and
// forward a `refCallback` prop themselves (see their own header
// comments), so no caller-side restructuring (unlike the earlier
// `Forms/AccountNameInput.tsx` two-hop `.refs.x` case) was needed here.
//
// `componentDidMount`'s one-shot `this._loadList(true)` becomes a plain
// mount-only `useEffect(() => {...}, [])` - not a mount-skip pattern,
// since `componentDidMount` (unlike `componentDidUpdate`) only ever fires
// once, on mount.
//
// Preserved verbatim, not "fixed": `_getColumns`' `fee_rate` column does
// `parseFloat(item) / parseFloat(FEE_RATE_DENOM)`; `FEE_RATE_DENOM` (a
// plain JS numeric constant from `actions/CreditOfferActions.js`, no
// `.d.ts`) is `String(...)`-wrapped only because TypeScript infers it as
// `number` and `parseFloat` requires a `string` argument - same TS-forced
// adjustment already applied in `CreditOfferPage.tsx` (this directory's
// earlier batch), not a behavior change (`parseFloat` on a number just
// stringifies it first either way).
import * as React from "react";
import counterpart from "counterpart";
import utils from "../../../lib/common/utils";
import AccountStore from "stores/AccountStore";
import {
    Tooltip,
    Button,
    Table,
    Icon as AntIcon
} from "bitshares-ui-style-guide";
import Translate from "react-translate-component";
import CreateModal, {CreateModalHandle} from "./CreateModal";
import EditModal, {EditModalHandle} from "./EditModal";
import CreditOfferActions, {
    FEE_RATE_DENOM,
    parsingTime
} from "../../../actions/CreditOfferActions";
import CreditOfferStore from "../../../stores/CreditOfferStore";
import LinkToAssetById from "../../Utility/LinkToAssetById";
import FormattedAsset from "../../Utility/FormattedAsset";
import moment from "moment";
import IntlStore from "stores/IntlStore";
import {useAltStore} from "../../../next/hooks/useAltStore";

interface CreditOfferListCoreProps {
    account: any;
    currentAccount: any;
    passwordAccount: any;
    listByOwner: any;
    locale: any;
}

function CreditOfferListCore({
    account,
    currentAccount,
    passwordAccount,
    listByOwner,
    locale
}: CreditOfferListCoreProps) {
    const createModalRef = React.useRef<CreateModalHandle | null>(null);
    const editModalRef = React.useRef<EditModalHandle | null>(null);

    const _loadList = (isFirst = false) => {
        (CreditOfferActions as any).getCreditOffersByOwner({
            name_or_id: account.get("id"),
            flag: isFirst ? "first" : false
        });
    };

    React.useEffect(() => {
        _loadList(true);
        // eslint-disable-next-line
    }, []);

    const showCreateModal = () => {
        if (createModalRef.current) createModalRef.current.showModal();
    };

    const showEditModal = (data: any) => {
        if (editModalRef.current) {
            editModalRef.current.initModal(data);
        }
    };

    const _showCreateButton = () => {
        const account_name = account.get("name");
        if (
            account_name === currentAccount ||
            account_name === passwordAccount
        ) {
            return (
                <div className="generic-bordered-box">
                    <div className="header-selector">
                        <div className="filter inline-block">
                            <Button
                                style={{marginRight: "30px"}}
                                onClick={showCreateModal}
                            >
                                <Translate content="credit_offer.create" />
                            </Button>
                        </div>
                    </div>
                </div>
            );
        } else {
            return null;
        }
    };

    const _getColumns = () => {
        const header: any[] = [
            {
                title: "ID",
                dataIndex: "id"
                // render: (text) => `#${text.split(".")[2]}`,
            },
            {
                title: counterpart.translate("credit_offer.asset"),
                dataIndex: "asset_type",
                render: (text: any) => <LinkToAssetById asset={text} />
            },
            {
                title: counterpart.translate("credit_offer.total_amount"),
                dataIndex: "total_balance",
                align: "right",
                render: (item: any, row: any) => (
                    <FormattedAsset
                        amount={item}
                        asset={row.asset_type}
                        hide_asset
                        trimZero
                    />
                )
            },
            {
                title: counterpart.translate("credit_offer.available_amount"),
                dataIndex: "current_balance",
                align: "right",
                render: (item: any, row: any) => (
                    <FormattedAsset
                        amount={item}
                        asset={row.asset_type}
                        hide_asset
                        trimZero
                    />
                )
            },
            {
                title: counterpart.translate("credit_offer.min_borrow"),
                dataIndex: "min_deal_amount",
                align: "right",
                render: (item: any, row: any) => (
                    <FormattedAsset
                        amount={item}
                        asset={row.asset_type}
                        hide_asset
                        trimZero
                    />
                )
            },
            {
                title: counterpart.translate("credit_offer.fee_rate"),
                dataIndex: "fee_rate",
                align: "right",
                render: (item: any) =>
                    `${(utils as any).format_number(
                        (parseFloat(item) /
                            parseFloat(String(FEE_RATE_DENOM))) *
                            100,
                        2,
                        false
                    )}%`
            },
            {
                title: counterpart.translate("credit_offer.repay_period"),
                dataIndex: "max_duration_seconds",
                render: (item: any) => {
                    return (parsingTime as any)(item, locale);
                }
            },
            {
                title: counterpart.translate("credit_offer.validity_period"),
                dataIndex: "auto_disable_time",
                render: (text: any) =>
                    moment
                        .utc(text)
                        .local()
                        .format("YYYY-MM-DD HH:mm:ss")
            },
            {
                title: counterpart.translate("credit_offer.mortgage_assets"),
                dataIndex: "acceptable_collateral",
                render: (item: any) => {
                    return item.map((v: any) => (
                        <div key={v[0]}>
                            <LinkToAssetById asset={v[0]} />
                        </div>
                    ));
                }
            },
            {
                title: counterpart.translate("credit_offer.status"),
                dataIndex: "enabled",
                render: (item: any) => {
                    const cls = "label " + (item ? "success" : "info");
                    return (
                        <span className={cls}>
                            {item
                                ? counterpart.translate("credit_offer.active")
                                : counterpart.translate("credit_offer.closed")}
                        </span>
                    );
                }
            }
        ];
        if (account.get("name") == currentAccount) {
            header.push({
                title: counterpart.translate("credit_offer.operate"),
                key: "action",
                render: (_: any, row: any) => {
                    return (
                        <span style={{fontSize: 20}}>
                            <Tooltip
                                title={counterpart.translate(
                                    "credit_offer.operate_edit"
                                )}
                            >
                                <AntIcon
                                    type="edit"
                                    style={{
                                        cursor: "pointer",
                                        marginRight: "20px"
                                    }}
                                    onClick={() => {
                                        showEditModal(row);
                                    }}
                                />
                            </Tooltip>
                            <Tooltip
                                title={
                                    row.enabled
                                        ? counterpart.translate(
                                              "credit_offer.closed"
                                          )
                                        : counterpart.translate(
                                              "credit_offer.active"
                                          )
                                }
                            >
                                <AntIcon
                                    type={row.enabled ? "poweroff" : "reload"}
                                    style={{
                                        cursor: "pointer",
                                        marginRight: "20px"
                                    }}
                                    onClick={() => {
                                        (CreditOfferActions as any).disabled({
                                            owner_account: row.owner_account,
                                            offer_id: row.id,
                                            enabled: !row.enabled
                                        });
                                    }}
                                />
                            </Tooltip>
                            <Tooltip
                                title={counterpart.translate(
                                    "credit_offer.operate_delete"
                                )}
                            >
                                <AntIcon
                                    type="delete"
                                    style={{cursor: "pointer"}}
                                    onClick={() =>
                                        (CreditOfferActions as any).delete({
                                            owner_account: row.owner_account,
                                            offer_id: row.id
                                        })
                                    }
                                />
                            </Tooltip>
                        </span>
                    );
                }
            });
        }
        return header;
    };

    return (
        <div className="grid-content no-overflow no-padding">
            <CreateModal
                id="credit_offer_create_modal"
                refCallback={(e: CreateModalHandle | null) => {
                    if (e) createModalRef.current = e;
                }}
                account={account}
            />
            <EditModal
                id="credit_offer_edit_modal"
                account={account}
                refCallback={(e: EditModalHandle | null) => {
                    if (e) editModalRef.current = e;
                }}
            />
            {_showCreateButton()}
            <div className="generic-bordered-box">
                <div className="grid-wrapper">
                    <Table
                        rowKey="id"
                        columns={_getColumns()}
                        dataSource={listByOwner}
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

interface CreditOfferListProps {
    account: any;
}

function CreditOfferList({account}: CreditOfferListProps) {
    const accountState = useAltStore<any>(AccountStore);
    const creditOfferState = useAltStore<any>(CreditOfferStore);
    const intlState = useAltStore<any>(IntlStore);

    return (
        <CreditOfferListCore
            account={account}
            currentAccount={accountState.currentAccount}
            passwordAccount={accountState.passwordAccount}
            listByOwner={creditOfferState.listByOwner}
            locale={intlState.currentLocale}
        />
    );
}

export default CreditOfferList;
