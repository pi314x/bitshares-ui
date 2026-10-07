// TypeScript/functional-component port of the legacy AccountWhitelist.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Security-sensitive per AGENTS.md: this component builds and submits an
// `account_whitelist` operation via `WalletApi.new_transaction()` /
// `WalletDb.process_transaction()`. The fee/operation/listing
// construction in `_onAdd`/`_onRemove` is transcribed verbatim, with no
// restructuring.
//
// Structural changes (not behavior changes):
// - `AccountRow`'s `BindToChainState(Component)` (required `account`,
//   `defaultProps: {tempComponent: "tr"}`) is replaced by a Container
//   gating on the resolved account - replicating `BindToChainState.jsx`'s
//   `tempComponent` fallback exactly: while unresolved, it renders a bare
//   `<tr />` (not the usual blank `<span/>`), since `React.createElement
//   (this.tempComponent)` is what the original HOC falls back to when a
//   `tempComponent` option is set.
// - `AccountList`'s `connect(Component, {listenTo, getProps})` is
//   replaced by `useAltStore(SettingsStore)`.
//
// Dropped as confirmed dead: the outer `<div ref="appTables">` legacy
// string ref - grepped the whole file, `this.refs.appTables` is never
// read anywhere.
import * as React from "react";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import SettingsStore from "stores/SettingsStore";
import {Tabs, Tab} from "../Utility/Tabs";
import constants from "chain/account_constants.js";
import AccountSelector from "../Account/AccountSelector";
import Immutable from "immutable";
import Translate from "react-translate-component";
import LinkToAccountById from "../Utility/LinkToAccountById";
import WalletApi from "api/WalletApi";
import WalletDb from "stores/WalletDb";
import {useAltStore} from "../../next/hooks/useAltStore";

interface AccountRowCoreProps {
    account: any;
    onRemove?: ((id: any, e: any) => void) | null;
    index: number;
}

function AccountRowCore({account, onRemove, index}: AccountRowCoreProps) {
    return (
        <tr>
            <td>{index}</td>
            <td>{account.get("id")}</td>
            <td>
                <LinkToAccountById account={account.get("id")} />
            </td>
            {onRemove ? (
                <td>
                    <button
                        onClick={onRemove.bind(null, account.get("id"))}
                        className="button outline"
                    >
                        Remove
                    </button>
                </td>
            ) : null}
        </tr>
    );
}

interface AccountRowProps {
    account: any;
    onRemove?: ((id: any, e: any) => void) | null;
    index: number;
}

function AccountRow({account, onRemove, index}: AccountRowProps) {
    useChainStoreTick();
    const resolvedAccount = (ChainStore as any).getAccount(account, false);

    if (!resolvedAccount) {
        return <tr />;
    }

    return (
        <AccountRowCore account={resolvedAccount} onRemove={onRemove} index={index} />
    );
}

interface AccountListCoreProps {
    removeButton?: boolean;
    white?: boolean;
    list: any;
    emptyText: string;
    account: any;
    getCurrentState?: (account: any) => number;
    settings: any;
}

function AccountListCore({
    removeButton,
    white,
    list,
    emptyText,
    account,
    getCurrentState,
    settings
}: AccountListCoreProps) {
    const onRemove = (listing: string, accountId: any) => {
        if (accountId) {
            const currentState = (getCurrentState as any)(accountId);
            const tr = (WalletApi as any).new_transaction();
            tr.add_type_operation("account_whitelist", {
                fee: {
                    amount: 0,
                    asset_id:
                        (ChainStore as any).assets_by_symbol.get(
                            settings.get("fee_asset")
                        ) || "1.3.0"
                },
                authorizing_account: account.get("id"),
                account_to_list: accountId,
                new_listing:
                    currentState - (constants as any).account_listing[listing]
            });
            (WalletDb as any).process_transaction(tr, null, true);
        }
    };

    const rows = list
        .map((accountId: any, index: number) => {
            return (
                <AccountRow
                    key={accountId}
                    onRemove={
                        removeButton
                            ? onRemove.bind(
                                  null,
                                  white ? "white_listed" : "black_listed"
                              )
                            : null
                    }
                    account={accountId}
                    index={index + 1}
                />
            );
        })
        .toArray();

    let showHeaders = true;
    if (!rows.length) {
        showHeaders = false;
        rows.push(
            <tr key="empty">
                <td style={{padding: "1rem 0"}} colSpan={removeButton ? 4 : 3}>
                    <Translate content={emptyText} account={account.get("name")} />
                </td>
            </tr>
        );
    }

    return (
        <table className="table compact dashboard-table">
            {showHeaders ? (
                <thead>
                    <tr>
                        <th>#</th>
                        <th>
                            <Translate content="account.id" />
                        </th>
                        <th>
                            <Translate content="account.name" />
                        </th>
                        {removeButton ? <th /> : null}
                    </tr>
                </thead>
            ) : null}
            <tbody>{rows}</tbody>
        </table>
    );
}

type AccountListProps = Omit<AccountListCoreProps, "settings">;

function AccountList(props: AccountListProps) {
    const settingsState = useAltStore<any>(SettingsStore);
    return <AccountListCore {...props} settings={settingsState.settings} />;
}

interface AccountWhitelistProps {
    account: any;
}

function AccountWhitelist({account}: AccountWhitelistProps) {
    const [accountName, setAccountName] = React.useState("");
    const [accountToList, setAccountToList] = React.useState<any>(null);

    const getCurrentState = (id: any) => {
        const white = account.get("whitelisted_accounts") || Immutable.List();
        const black = account.get("blacklisted_accounts") || Immutable.List();
        let current = (constants as any).account_listing.no_listing;

        if (white.includes(id)) {
            current += (constants as any).account_listing.white_listed;
        }

        if (black.includes(id)) {
            current += (constants as any).account_listing.black_listed;
        }

        return current;
    };

    const onAdd = (listing: string) => {
        const currentState = getCurrentState(accountToList);

        if (accountToList) {
            const tr = (WalletApi as any).new_transaction();
            tr.add_type_operation("account_whitelist", {
                fee: {
                    amount: 0,
                    asset_id: "1.3.0"
                },
                authorizing_account: account.get("id"),
                account_to_list: accountToList,
                new_listing:
                    currentState + (constants as any).account_listing[listing]
            });
            (WalletDb as any).process_transaction(tr, null, true);
        }
    };

    const onAccountFound = (foundAccount: any) => {
        console.log("accountFound:", foundAccount);
        setAccountName(foundAccount ? foundAccount.get("name") : null as any);
        setAccountToList(foundAccount ? foundAccount.get("id") : null);
    };

    const onAccountChanged = (newAccountName: any) => {
        console.log("account changed:", newAccountName);
        setAccountName(newAccountName);
        setAccountToList(null);
    };

    return (
        <div className="grid-content app-tables no-padding">
            <div className="content-block small-12">
                <div className="tabs-container generic-bordered-box">
                    <Tabs
                        className="account-tabs"
                        tabsClass="account-overview no-padding bordered-header content-block"
                        setting="whitelistTab"
                        contentClass="grid-content shrink small-vertical medium-horizontal no-padding"
                        segmented={false}
                    >
                        <Tab title="account.whitelist.title">
                            <div style={{paddingBottom: "1rem"}} className="small-12">
                                <div>
                                    <AccountList
                                        emptyText="account.whitelist.empty"
                                        account={account}
                                        getCurrentState={getCurrentState}
                                        list={
                                            account.get("whitelisted_accounts") ||
                                            Immutable.List()
                                        }
                                        removeButton
                                        white={true}
                                    />
                                </div>
                                {!account.get("whitelisted_accounts") ? (
                                    <p className="has-error">
                                        Please note, whitelisting is not working
                                        yet due to unresolved backend issue.
                                    </p>
                                ) : null}
                                <div style={{padding: "2rem 0"}}>
                                    <AccountSelector
                                        label={"account.whitelist.add"}
                                        accountName={accountName}
                                        onAccountChanged={onAccountFound}
                                        onChange={onAccountChanged}
                                        account={accountName}
                                        tabIndex={2}
                                        onAction={onAdd.bind(null, "white_listed")}
                                        action_label="account.perm.confirm_add"
                                        white={false}
                                        typeahead={true}
                                    />
                                </div>
                            </div>
                        </Tab>

                        <Tab title="account.whitelist.black">
                            <div style={{paddingBottom: "1rem"}} className="small-12">
                                <div>
                                    <AccountList
                                        emptyText="account.whitelist.empty_black"
                                        account={account}
                                        getCurrentState={getCurrentState}
                                        list={account.get("blacklisted_accounts")}
                                        removeButton
                                    />
                                </div>
                                <div style={{padding: "2rem 1rem"}}>
                                    <AccountSelector
                                        label={"account.whitelist.add_black"}
                                        accountName={accountName}
                                        onAccountChanged={onAccountFound}
                                        onChange={onAccountChanged}
                                        account={accountName}
                                        tabIndex={2}
                                        onAction={onAdd.bind(null, "black_listed")}
                                        action_label="account.perm.confirm_add"
                                        typeahead={true}
                                    />
                                </div>
                            </div>
                        </Tab>

                        <Tab title="account.whitelist.white_by">
                            <div style={{paddingBottom: "1rem"}} className="small-12">
                                <div>
                                    <AccountList
                                        emptyText="account.whitelist.empty_white_by"
                                        account={account}
                                        list={account.get("whitelisting_accounts")}
                                    />
                                </div>
                            </div>
                        </Tab>

                        <Tab title="account.whitelist.black_by">
                            <div style={{paddingBottom: "1rem"}} className="small-12">
                                <div>
                                    <AccountList
                                        emptyText="account.whitelist.empty_black_by"
                                        account={account}
                                        list={account.get("blacklisting_accounts")}
                                    />
                                </div>
                            </div>
                        </Tab>
                    </Tabs>
                </div>
            </div>
        </div>
    );
}

export default AccountWhitelist;
