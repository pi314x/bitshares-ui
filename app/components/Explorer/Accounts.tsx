// TypeScript/functional-component port of the legacy Accounts.jsx (the
// "/explorer/accounts" tab's account search) and its trivial
// AccountsContainer.jsx wrapper (Phase 2, docs/UI_MIGRATION_PLAN.md).
// Read-only public chain-explorer data, same lower-risk category as
// Blocks.tsx/CommitteeMembers.tsx/Witnesses.tsx.
//
// The legacy class's `_onAddContact`/`_onRemoveContact` called
// `this.forceUpdate()` after dispatching to AccountStore, because its
// `shouldComponentUpdate` only checked `searchAccounts`/`searchTerm`/
// `isLoading` - not `accountContacts` (read fresh from
// `AccountStore.getState()` on every render) or `rowsOnPage`, so without
// forceUpdate those two handlers plus `handleRowsChange` wouldn't have
// triggered a re-render at all. This port doesn't replicate that
// shouldComponentUpdate gate (same tradeoff as the rest of this phase -
// see TotalBalanceValue.tsx), so plain state updates already re-render;
// the one thing that still needs an explicit subscription is
// `accountContacts` itself, which comes from `AccountStore` rather than
// local state - handled below with `useAltStore(AccountStore)` instead
// of a forceUpdate call.
import * as React from "react";
import {Link, LinkProps} from "react-router-dom";
import Immutable from "immutable";
import Translate from "react-translate-component";
import AccountActions from "actions/AccountActions";
import {debounce} from "lodash-es";
import Icon from "../Icon/Icon";
import BalanceComponent from "../Utility/BalanceComponent";
import AccountStore from "stores/AccountStore";
import LoadingIndicator from "../LoadingIndicator";
import {Table, Select} from "bitshares-ui-style-guide";
import SearchInput from "../Utility/SearchInput";
import {ChainStore} from "bitsharesjs";
import {useAltStore} from "../../next/hooks/useAltStore";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

const TypedSearchInput = SearchInput as React.ComponentType<any>;
// Same @types/react-router-dom v5 + modern TS workaround as Blocks.tsx's
// TypedLink.
const TypedLink = Link as React.ComponentType<LinkProps>;

interface AccountRow {
    accountId: string;
    accountContacts: any;
    accountName: string;
    accountBalance: string | null;
}

export default function Accounts() {
    useChainStoreTick();
    const accountState = useAltStore<any>(AccountStore);
    const searchAccounts: Immutable.Map<string, string> =
        accountState.searchAccounts;
    const accountContacts = accountState.accountContacts;

    const [searchTerm, setSearchTerm] = React.useState<string>(
        () => accountState.searchTerm || ""
    );
    const [isLoading, setIsLoading] = React.useState(false);
    const [rowsOnPage, setRowsOnPage] = React.useState("25");

    const balanceObjects = React.useRef<{[id: string]: number}>({});

    const searchAccountsDebounced = React.useMemo(
        () =>
            debounce((term: string) => {
                AccountActions.accountSearch(term);
                setIsLoading(false);
            }, 200),
        []
    );

    function onSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
        setSearchTerm(e.target.value.toLowerCase());
        setIsLoading(true);
        searchAccountsDebounced(e.target.value);
    }

    function onAddContact(account: string, e: React.MouseEvent) {
        e.preventDefault();
        AccountActions.addAccountContact(account);
    }

    function onRemoveContact(account: string, e: React.MouseEvent) {
        e.preventDefault();
        AccountActions.removeAccountContact(account);
    }

    function ensureBalanceObject(objectId: string | null) {
        if (objectId && typeof objectId === "string") {
            if (!balanceObjects.current[objectId]) {
                balanceObjects.current[objectId] = parseFloat(
                    ChainStore.getObject(objectId).get("balance")
                );
            }
        }
        if (!balanceObjects.current[objectId as string]) {
            balanceObjects.current[objectId as string] = 0;
        }
    }

    const columns = [
        {
            title: <Translate component="span" content="explorer.assets.id" />,
            dataIndex: "accountId",
            key: "accountId",
            defaultSortOrder: "ascend" as const,
            sorter: (a: AccountRow, b: AccountRow) =>
                a.accountId > b.accountId ? 1 : a.accountId < b.accountId ? -1 : 0,
            render: (id: string) => <div>{id}</div>
        },
        {
            title: <Icon name="user" title="icons.user.account" />,
            dataIndex: "accountContacts",
            key: "accountContacts",
            render: (contacts: any, record: AccountRow) => {
                return contacts.has(record.accountName) ? (
                    <div onClick={e => onRemoveContact(record.accountName, e)}>
                        <Icon
                            name="minus-circle"
                            title="icons.minus_circle.remove_contact"
                        />
                    </div>
                ) : (
                    <div onClick={e => onAddContact(record.accountName, e)}>
                        <Icon
                            name="plus-circle"
                            title="icons.plus_circle.add_contact"
                        />
                    </div>
                );
            }
        },
        {
            title: <Translate component="span" content="account.name" />,
            dataIndex: "accountName",
            key: "accountName",
            sorter: (a: AccountRow, b: AccountRow) =>
                a.accountName > b.accountName
                    ? 1
                    : a.accountName < b.accountName
                    ? -1
                    : 0,
            render: (name: string) => (
                <div>
                    <TypedLink to={`/account/${name}/overview`}>{name}</TypedLink>
                </div>
            )
        },
        {
            title: <Translate component="span" content="gateway.balance" />,
            dataIndex: "accountBalance",
            key: "accountBalance",
            sorter: (a: AccountRow, b: AccountRow) => {
                ensureBalanceObject(a.accountBalance);
                ensureBalanceObject(b.accountBalance);
                return balanceObjects.current[a.accountBalance as string] >
                    balanceObjects.current[b.accountBalance as string]
                    ? 1
                    : balanceObjects.current[a.accountBalance as string] <
                      balanceObjects.current[b.accountBalance as string]
                    ? -1
                    : 0;
            },
            render: (balance: string | null) => (
                <div>{!balance ? "n/a" : <BalanceComponent balance={balance} />}</div>
            )
        },
        {
            title: <Translate component="span" content="account.percent" />,
            dataIndex: "accountBalance",
            key: "accountBalancePercentage",
            sorter: (a: AccountRow, b: AccountRow) => {
                ensureBalanceObject(a.accountBalance);
                ensureBalanceObject(b.accountBalance);
                return balanceObjects.current[a.accountBalance as string] >
                    balanceObjects.current[b.accountBalance as string]
                    ? 1
                    : balanceObjects.current[a.accountBalance as string] <
                      balanceObjects.current[b.accountBalance as string]
                    ? -1
                    : 0;
            },
            render: (balance: string | null) => (
                <div>
                    {!balance ? (
                        "n/a"
                    ) : (
                        <BalanceComponent balance={balance} asPercentage={true} />
                    )}
                </div>
            )
        }
    ];

    const dataSource: AccountRow[] = [];
    if (searchAccounts.size > 0 && searchTerm && searchTerm.length > 0) {
        searchAccounts
            .filter(a => (a as string).indexOf(searchTerm) !== -1)
            .sort((a, b) => ((a as string) > (b as string) ? 1 : (a as string) < (b as string) ? -1 : 0))
            .forEach((name, id) => {
                const currentAccount = ChainStore.getAccount(
                    (id as string).toLowerCase()
                );
                const balance = currentAccount
                    ? currentAccount.getIn(["balances", "1.3.0"]) || null
                    : null;

                dataSource.push({
                    accountId: id as string,
                    accountContacts: accountContacts,
                    accountName: name as string,
                    accountBalance: balance
                });
            });
    }

    return (
        <div className="grid-block vertical">
            <div className="grid-block vertical">
                <div className="grid-block main-content small-12 medium-10 medium-offset-1 main-content vertical">
                    <div className="generic-bordered-box">
                        <div style={{textAlign: "left", marginBottom: "24px"}}>
                            <TypedSearchInput
                                placeholder={"Search"}
                                value={searchTerm}
                                style={{width: "200px"}}
                                onChange={onSearchChange}
                            />

                            <Select
                                style={{width: "150px", marginLeft: "24px"}}
                                value={rowsOnPage}
                                onChange={setRowsOnPage}
                            >
                                <Select.Option key={"10"}>10 rows</Select.Option>
                                <Select.Option key={"25"}>25 rows</Select.Option>
                                <Select.Option key={"50"}>50 rows</Select.Option>
                                <Select.Option key={"100"}>
                                    100 rows
                                </Select.Option>
                                <Select.Option key={"200"}>
                                    200 rows
                                </Select.Option>
                            </Select>

                            <div
                                style={{
                                    display: "inline-block",
                                    marginLeft: "24px"
                                }}
                            >
                                {searchTerm && searchTerm.length == 0 ? (
                                    <Translate content="account.start_typing_to_search" />
                                ) : null}
                            </div>
                        </div>

                        <Table
                            style={{width: "100%", marginTop: "16px"}}
                            rowKey="accountId"
                            columns={columns}
                            dataSource={dataSource}
                            pagination={{
                                position: "bottom" as any,
                                pageSize: Number(rowsOnPage)
                            }}
                        />
                        {isLoading ? (
                            <div style={{textAlign: "center", padding: 10}}>
                                <LoadingIndicator type="three-bounce" />
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </div>
    );
}
