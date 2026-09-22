// TypeScript/functional-component port of the legacy DashboardList.jsx
// (Phase 2, docs/UI_MIGRATION_PLAN.md). Renders the account/contacts
// balance table on the Dashboard ("/accounts") and Contacts screens.
//
// Like TotalBalanceValue.tsx, this replaces the BindToChainState/Alt
// connect() HOC stack with direct ChainStore reads plus
// useChainStoreTick/useAltStore, and does not replicate the legacy
// shouldComponentUpdate's fine-grained re-render gating - a perf
// tradeoff, not a correctness one (see TotalBalanceValue.tsx's header
// comment). The actual balance/collateral/debt aggregation is imported
// from app/next/dashboard/balanceCalculations.ts, unit-tested against
// real mainnet account data - this file only resolves chain ids and
// renders markup, it does not do arithmetic on balances itself
// (AGENTS.md: treat balance display as security-sensitive).
import * as React from "react";
import {List} from "immutable";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import {useHistory} from "react-router-dom";
import {ChainStore} from "bitsharesjs";
import utils from "common/utils";
import SettingsStore from "stores/SettingsStore";
import WalletUnlockStore from "stores/WalletUnlockStore";
import AccountStore from "stores/AccountStore";
import SettingsActions from "actions/SettingsActions";
import AccountActions from "actions/AccountActions";
import WalletDb from "stores/WalletDb";
import Icon from "../Icon/Icon";
import TotalBalanceValue from "../Utility/TotalBalanceValue";
import {useAltStore} from "../../next/hooks/useAltStore";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import {
    aggregateOpenOrders,
    aggregateCollateralAndDebt,
    resolveAccountBalanceIds,
    starSort
} from "../../next/dashboard/balanceCalculations";
import "./DashboardList.scss";

export interface DashboardListProps {
    accounts: List<string>;
    ignoredAccounts?: List<string>;
    width?: number;
    compact?: boolean;
    style?: React.CSSProperties;
    isContactsList?: boolean;
    showMyAccounts?: boolean;
    showIgnored?: boolean;
    onToggleIgnored?: () => void;
    passwordAccount?: string;
}

function resolveAccounts(ids: List<string> | undefined): any[] {
    if (!ids) return [];
    return ids.map(id => ChainStore.getAccount(id)).toArray();
}

export default function DashboardList(props: DashboardListProps) {
    const {
        accounts,
        ignoredAccounts,
        width = 2000,
        compact = false,
        isContactsList,
        showMyAccounts,
        showIgnored,
        passwordAccount
    } = props;

    useChainStoreTick();
    const history = useHistory();
    const settingsState = useAltStore<any>(SettingsStore);
    // Legacy DashboardList only used WalletUnlockStore's `locked` to force
    // a re-render on lock/unlock (never read it in JSX) - this hook call
    // preserves that re-render trigger without an unused variable.
    useAltStore<any>(WalletUnlockStore);
    const accountState = useAltStore<any>(AccountStore);

    const starredAccounts = accountState.starredAccounts;
    const viewSettings = settingsState.viewSettings;

    const [sortBy, setSortBy] = React.useState<string>(() =>
        viewSettings.get("dashboardSort", "star")
    );
    const [inverseSort, setInverseSort] = React.useState<boolean>(() =>
        viewSettings.get("dashboardSortInverse", true)
    );
    const [dashboardFilter, setDashboardFilter] = React.useState<string>(() =>
        viewSettings.get("dashboardFilter", "")
    );

    function onStar(account: string, isStarred: boolean, e: React.MouseEvent) {
        e.preventDefault();
        if (!isStarred) {
            AccountActions.addStarAccount(account);
        } else {
            AccountActions.removeStarAccount(account);
        }
    }

    function goAccount(name: string, tab: number) {
        history.push(`/account/${name}`);
        SettingsActions.changeViewSetting({overviewTab: tab});
    }

    function createAccount() {
        history.push("/create-account/wallet");
    }

    function onFilter(e: React.ChangeEvent<HTMLInputElement>) {
        const value = e.target.value.toLowerCase();
        setDashboardFilter(value);
        SettingsActions.changeViewSetting({dashboardFilter: value});
    }

    function setSort(field: string) {
        const inverse = field === sortBy ? !inverseSort : inverseSort;
        setSortBy(field);
        setInverseSort(inverse);
        SettingsActions.changeViewSetting({
            dashboardSort: field,
            dashboardSortInverse: inverse
        });
    }

    function onAddContact(account: string) {
        AccountActions.addAccountContact(account);
    }

    function onRemoveContact(account: string) {
        AccountActions.removeAccountContact(account);
    }

    function renderList(accountList: any[], isHiddenAccountsList?: boolean) {
        return accountList
            .filter(account => {
                if (!account) return false;
                const accountName = account.get("name");
                const isMyAccount =
                    AccountStore.isMyAccount(account) ||
                    accountName === passwordAccount;
                return isContactsList ? true : isMyAccount === showMyAccounts;
            })
            .filter(a => {
                if (!a) return false;
                return (
                    a
                        .get("name")
                        .toLowerCase()
                        .indexOf(dashboardFilter) !== -1
                );
            })
            .sort((a, b) => {
                switch (sortBy) {
                    case "star":
                        return starSort(a, b, inverseSort, starredAccounts);
                    case "name":
                        return utils.sortText(
                            a.get("name"),
                            b.get("name"),
                            inverseSort
                        );
                    default:
                        return 0;
                }
            })
            .map(account => {
                if (!account) return null;

                const accountName = account.get("name");
                const isLTM =
                    account.get("lifetime_referrer_name") === accountName;

                const openOrders = aggregateOpenOrders(
                    account.get("orders"),
                    id => ChainStore.getObject(id)
                );
                const {collateral, debt} = aggregateCollateralAndDebt(
                    account.get("call_orders"),
                    id => ChainStore.getObject(id)
                );
                const balanceList = resolveAccountBalanceIds(
                    account.get("balances"),
                    id => ChainStore.getObject(id)
                );

                const isMyAccount =
                    AccountStore.isMyAccount(account) ||
                    accountName === passwordAccount;
                const isStarred = starredAccounts.has(accountName);
                const starClass = isStarred ? "gold-star" : "grey-star";

                return (
                    <tr key={accountName}>
                        <td
                            className="clickable"
                            onClick={e => onStar(accountName, isStarred, e)}
                        >
                            <Icon
                                className={starClass}
                                name="fi-star"
                                title="icons.fi_star.account"
                            />
                        </td>
                        {isContactsList ? (
                            isHiddenAccountsList ? (
                                <td onClick={() => onAddContact(accountName)}>
                                    <Icon
                                        name="plus-circle"
                                        title="icons.plus_circle.add_contact"
                                    />
                                </td>
                            ) : (
                                <td onClick={() => onRemoveContact(accountName)}>
                                    <Icon
                                        name="minus-circle"
                                        title="icons.minus_circle.remove_contact"
                                    />
                                </td>
                            )
                        ) : null}
                        <td style={{textAlign: "left"}}>{account.get("id")}</td>
                        <td
                            style={{textAlign: "left", paddingLeft: 10}}
                            onClick={() => goAccount(accountName, 0)}
                            className={
                                "clickable" + (isMyAccount ? " my-account" : "")
                            }
                        >
                            <span className={isLTM ? "lifetime" : ""}>
                                {accountName}
                            </span>
                        </td>
                        <td
                            className="clickable"
                            onClick={() => goAccount(accountName, 1)}
                            style={{textAlign: "right"}}
                        >
                            <TotalBalanceValue
                                noTip
                                balances={List()}
                                openOrders={openOrders}
                            />
                        </td>
                        {width >= 750 ? (
                            <td
                                className="clickable"
                                onClick={() => goAccount(accountName, 2)}
                                style={{textAlign: "right"}}
                            >
                                <TotalBalanceValue
                                    noTip
                                    balances={List()}
                                    collateral={collateral}
                                />
                            </td>
                        ) : null}
                        {width >= 1200 ? (
                            <td
                                className="clickable"
                                onClick={() => goAccount(accountName, 2)}
                                style={{textAlign: "right"}}
                            >
                                <TotalBalanceValue
                                    noTip
                                    balances={List()}
                                    debt={debt}
                                />
                            </td>
                        ) : null}
                        <td
                            className="clickable"
                            onClick={() => goAccount(accountName, 0)}
                            style={{textAlign: "right"}}
                        >
                            <TotalBalanceValue
                                noTip
                                balances={balanceList}
                                collateral={collateral}
                                debt={debt}
                                openOrders={openOrders}
                            />
                        </td>
                    </tr>
                );
            });
    }

    const resolvedAccounts = resolveAccounts(accounts);
    const resolvedIgnored = resolveAccounts(ignoredAccounts);

    const includedAccounts = renderList(resolvedAccounts);
    const hiddenAccounts = renderList(resolvedIgnored, true);

    let filterText = !isContactsList
        ? counterpart.translate("explorer.accounts.filter")
        : counterpart.translate("explorer.accounts.filter_contacts");
    filterText += "...";

    const hasLocalWallet = !!WalletDb.getWallet();

    return (
        <div style={props.style} className="dash-panel">
            {!compact ? (
                <section
                    style={{paddingTop: "1rem", paddingLeft: "2rem"}}
                    className="dash-toolbar"
                >
                    <input
                        placeholder={filterText}
                        style={{maxWidth: "20rem", display: "inline-block"}}
                        className="dash-filter-input"
                        type="text"
                        value={dashboardFilter}
                        onChange={onFilter}
                    />
                    {hasLocalWallet && !isContactsList ? (
                        <div
                            onClick={createAccount}
                            style={{
                                display: "inline-block",
                                marginLeft: 5,
                                marginBottom: "1rem"
                            }}
                            className="button small dash-btn"
                        >
                            <Translate content="header.create_account" />
                        </div>
                    ) : null}
                    {hiddenAccounts && hiddenAccounts.length ? (
                        <div
                            onClick={props.onToggleIgnored}
                            style={{
                                display: "inline-block",
                                float: "right",
                                marginRight: "20px"
                            }}
                            className="button small dash-btn"
                        >
                            <Translate
                                content={`account.${
                                    showIgnored ? "hide_ignored" : "show_ignored"
                                }`}
                            />
                        </div>
                    ) : null}
                </section>
            ) : null}
            <table
                className="table table-hover dashboard-table dash-table"
                style={{fontSize: "0.85rem"}}
            >
                {!compact ? (
                    <thead>
                        <tr>
                            <th
                                onClick={() => setSort("star")}
                                className="clickable"
                            >
                                <Icon
                                    className="grey-star"
                                    name="fi-star"
                                    title="icons.fi_star.sort_accounts"
                                />
                            </th>
                            {isContactsList ? (
                                <th>
                                    <Icon name="user" title="icons.user.account" />
                                </th>
                            ) : null}
                            <th style={{textAlign: "left"}}>ID</th>
                            <th
                                style={{textAlign: "left", paddingLeft: 10}}
                                onClick={() => setSort("name")}
                                className="clickable"
                            >
                                <Translate content="header.account" />
                            </th>
                            <th style={{textAlign: "right"}}>
                                <Translate content="account.open_orders" />
                            </th>
                            {width >= 750 ? (
                                <th style={{textAlign: "right"}}>
                                    <Translate content="account.as_collateral" />
                                </th>
                            ) : null}
                            {width >= 1200 ? (
                                <th style={{textAlign: "right"}}>
                                    <Translate content="transaction.borrow_amount" />
                                </th>
                            ) : null}
                            <th style={{textAlign: "right", marginRight: 20}}>
                                <Translate content="account.total_value" />
                            </th>
                        </tr>
                    </thead>
                ) : null}
                <tbody>
                    {includedAccounts}
                    {showIgnored && hiddenAccounts.length ? (
                        <tr
                            className="dashboard-table--hiddenAccounts"
                            style={{backgroundColor: "transparent"}}
                            key="hidden"
                        >
                            <td colSpan={8}>
                                {counterpart.translate(
                                    "account.hidden_accounts_row"
                                )}
                                :
                            </td>
                        </tr>
                    ) : null}
                    {showIgnored && hiddenAccounts}
                </tbody>
            </table>
        </div>
    );
}
