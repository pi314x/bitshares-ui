// SameT funds ("flash loan" funds): browse every fund on the chain, and create,
// top up / withdraw from, re-price or delete the ones that belong to the
// current account. Reads come straight from the node (`SametFundActions`);
// writes are signed locally through `WalletDb.process_transaction`.
//
// Borrowing is intentionally not offered here, see `SametFundActions.ts`.
import * as React from "react";
import {Link} from "react-router-dom";
import counterpart from "counterpart";
import AccountStore from "../../../stores/AccountStore";
import {useAltStore} from "../../../next/hooks/useAltStore";
import {Button} from "../../../design-system/Button";
import {Table, TableColumn} from "../../../design-system/Table";
import {Tabs} from "../../../design-system/Tabs";
import {Alert} from "../../../design-system/Alert";
import SametFundActions, {
    AccountInfo,
    AssetInfo,
    FundPage
} from "../../../actions/SametFundActions";
import {
    SametFund,
    formatAmount,
    formatFeeRate
} from "../../../lib/common/sametFunds";
import {
    CreateFundModal,
    DeleteFundModal,
    UpdateFundModal,
    describeError
} from "./SametFundModals";
import styles from "./SametFundsPage.module.scss";

const TypedLink = Link as React.ComponentType<any>;

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`samet.${key}`, params);

interface ListState {
    funds: SametFund[];
    next: string | null;
    loading: boolean;
    loaded: boolean;
    error: string | null;
}

const EMPTY: ListState = {
    funds: [],
    next: null,
    loading: false,
    loaded: false,
    error: null
};

/** A paged list of funds. `load` is null while there is nothing to load yet
 * (no account); changing `listKey` throws the old rows away and starts over. */
function useFundList(
    load: ((start: string | null) => Promise<FundPage>) | null,
    listKey: string
) {
    const [state, setState] = React.useState<ListState>(EMPTY);
    const generation = React.useRef(0);
    const loadRef = React.useRef(load);
    loadRef.current = load;

    const fetchPage = React.useCallback(
        (start: string | null, replace: boolean) => {
            const loader = loadRef.current;
            if (!loader) return;
            const id = ++generation.current;
            setState(s => ({...s, loading: true, error: null}));
            loader(start)
                .then(page => {
                    if (id !== generation.current) return;
                    setState(s => ({
                        funds: replace
                            ? page.funds
                            : [...s.funds, ...page.funds],
                        next: page.next,
                        loading: false,
                        loaded: true,
                        error: null
                    }));
                })
                .catch(err => {
                    if (id !== generation.current) return;
                    setState(s => ({
                        ...s,
                        loading: false,
                        loaded: true,
                        error: describeError(err)
                    }));
                });
        },
        []
    );

    React.useEffect(() => {
        generation.current++;
        setState(EMPTY);
        if (load) fetchPage(null, true);
        // `listKey` is the identity of what `load` loads.
    }, [listKey]);

    return {
        ...state,
        reload: () => fetchPage(null, true),
        more: () => state.next && fetchPage(state.next, false)
    };
}

function idNumber(id: string): number {
    return Number(id.split(".")[2]);
}

export default function SametFundsPage() {
    const accountState = useAltStore<any>(AccountStore as any);
    const accountName: string | null =
        accountState.currentAccount || accountState.passwordAccount || null;

    const [owner, setOwner] = React.useState<AccountInfo | null>(null);
    const [tab, setTab] = React.useState("all");
    const [assets, setAssets] = React.useState<Record<string, AssetInfo>>({});
    const [accounts, setAccounts] = React.useState<Record<string, AccountInfo>>(
        {}
    );
    const [creating, setCreating] = React.useState(false);
    const [editing, setEditing] = React.useState<SametFund | null>(null);
    const [deleting, setDeleting] = React.useState<SametFund | null>(null);

    // Resolve the selected account name to its id.
    React.useEffect(() => {
        let cancelled = false;
        setOwner(null);
        if (!accountName) return;
        SametFundActions.getAccountByName(accountName)
            .then(info => {
                if (!cancelled) setOwner(info);
            })
            .catch(() => {
                if (!cancelled) setOwner(null);
            });
        return () => {
            cancelled = true;
        };
    }, [accountName]);

    const loadAll = React.useCallback(
        (start: string | null) => SametFundActions.listAll(start),
        []
    );
    const loadMine = React.useMemo(
        () =>
            owner
                ? (start: string | null) =>
                      SametFundActions.listByOwner(owner.id, start)
                : null,
        [owner]
    );
    const all = useFundList(loadAll, "all");
    const mine = useFundList(loadMine, owner ? owner.id : "");

    // Names and symbols for every fund shown, fetched once per new id.
    const known = React.useRef({
        assets: new Set<string>(),
        accounts: new Set<string>()
    });
    React.useEffect(() => {
        const rows = [...all.funds, ...mine.funds];
        const newAssets = rows
            .map(f => f.asset_type)
            .filter(id => !known.current.assets.has(id));
        const newAccounts = rows
            .map(f => f.owner_account)
            .filter(id => !known.current.accounts.has(id));
        newAssets.forEach(id => known.current.assets.add(id));
        newAccounts.forEach(id => known.current.accounts.add(id));
        if (newAssets.length) {
            SametFundActions.getAssets(newAssets)
                .then(found => setAssets(prev => ({...prev, ...found})))
                .catch(() =>
                    newAssets.forEach(id => known.current.assets.delete(id))
                );
        }
        if (newAccounts.length) {
            SametFundActions.getAccounts(newAccounts)
                .then(found => setAccounts(prev => ({...prev, ...found})))
                .catch(() =>
                    newAccounts.forEach(id => known.current.accounts.delete(id))
                );
        }
    }, [all.funds, mine.funds]);

    const refreshAll = () => {
        setCreating(false);
        setEditing(null);
        setDeleting(null);
        all.reload();
        mine.reload();
    };

    const columns = (withActions: boolean): TableColumn<SametFund>[] => {
        const cols: TableColumn<SametFund>[] = [
            {
                key: "id",
                title: t("col_id"),
                dataIndex: "id",
                render: (id: string) => (
                    <span className={styles.fundId}>{id}</span>
                ),
                sorter: (a, b) => idNumber(a.id) - idNumber(b.id)
            },
            {
                key: "owner",
                title: t("col_owner"),
                render: (_v, fund) => {
                    const info = accounts[fund.owner_account];
                    return (
                        <span>
                            {info ? (
                                <TypedLink
                                    to={`/account/${info.name}/overview`}
                                >
                                    {info.name}
                                </TypedLink>
                            ) : (
                                fund.owner_account
                            )}
                            {owner && owner.id === fund.owner_account ? (
                                <span className={styles.you}>you</span>
                            ) : null}
                        </span>
                    );
                }
            },
            {
                key: "asset",
                title: t("col_asset"),
                render: (_v, fund) => {
                    const info = assets[fund.asset_type];
                    return info ? (
                        <TypedLink to={`/asset/${info.symbol}`}>
                            {info.symbol}
                        </TypedLink>
                    ) : (
                        fund.asset_type
                    );
                }
            },
            {
                key: "balance",
                title: t("col_balance"),
                align: "right",
                render: (_v, fund) => {
                    const info = assets[fund.asset_type];
                    return (
                        <span className={styles.num}>
                            {info
                                ? formatAmount(fund.balance, info.precision)
                                : fund.balance}
                        </span>
                    );
                },
                sorter: (a, b) => {
                    const x = BigInt(a.balance);
                    const y = BigInt(b.balance);
                    return x < y ? -1 : x > y ? 1 : 0;
                }
            },
            {
                key: "fee_rate",
                title: t("col_fee_rate"),
                align: "right",
                render: (_v, fund) => (
                    <span className={styles.num}>
                        {formatFeeRate(fund.fee_rate)}
                    </span>
                ),
                sorter: (a, b) => a.fee_rate - b.fee_rate
            },
            {
                key: "unpaid",
                title: t("col_unpaid"),
                align: "right",
                render: (_v, fund) => {
                    const info = assets[fund.asset_type];
                    return (
                        <span className={styles.num}>
                            {info
                                ? formatAmount(
                                      fund.unpaid_amount,
                                      info.precision
                                  )
                                : fund.unpaid_amount}
                        </span>
                    );
                }
            }
        ];
        if (withActions) {
            cols.push({
                key: "actions",
                title: t("col_actions"),
                align: "right",
                render: (_v, fund) => (
                    <span className={styles.rowActions}>
                        <Button size="small" onClick={() => setEditing(fund)}>
                            {t("update")}
                        </Button>
                        <Button size="small" onClick={() => setDeleting(fund)}>
                            {t("delete")}
                        </Button>
                    </span>
                )
            });
        }
        return cols;
    };

    const renderList = (
        list: ReturnType<typeof useFundList>,
        emptyText: string,
        withActions: boolean
    ) => {
        const rows = list.funds.map(f => ({...f, key: f.id}));
        const symbols = new Set(rows.map(r => r.asset_type));
        return (
            <div className={styles.card}>
                {list.error ? (
                    <div className={styles.error}>
                        <Alert
                            type="error"
                            showIcon
                            message={t("error_load", {error: list.error})}
                        />
                    </div>
                ) : null}
                <p className={styles.summary}>
                    {list.loading && !list.loaded
                        ? t("loading")
                        : t("summary", {
                              count: rows.length,
                              assets: symbols.size
                          })}
                </p>
                <Table
                    columns={columns(withActions)}
                    dataSource={rows}
                    pagination={{pageSize: 25, hideOnSinglePage: true}}
                    loading={list.loading && !list.loaded}
                    locale={{
                        emptyText: list.loaded ? (
                            <div className={styles.empty}>{emptyText}</div>
                        ) : (
                            ""
                        )
                    }}
                />
                {list.next ? (
                    <div className={styles.more}>
                        <Button onClick={list.more} disabled={list.loading}>
                            {t("load_more")}
                        </Button>
                    </div>
                ) : null}
            </div>
        );
    };

    const editingAsset = editing ? assets[editing.asset_type] : undefined;
    const deletingAsset = deleting ? assets[deleting.asset_type] : undefined;

    return (
        <div className={styles.page}>
            <div className={styles.head}>
                <h2 className={styles.title}>{t("title")}</h2>
                {owner ? (
                    <Button variant="accent" onClick={() => setCreating(true)}>
                        {t("create")}
                    </Button>
                ) : null}
            </div>
            <p className={styles.intro}>{t("intro")}</p>
            <p className={styles.note}>{t("no_borrow")}</p>

            <Tabs activeKey={tab} onChange={setTab}>
                <Tabs.TabPane tab={t("tab_all")} key="all">
                    {renderList(all, t("empty_all"), false)}
                </Tabs.TabPane>
                <Tabs.TabPane tab={t("tab_mine")} key="mine">
                    {owner ? (
                        renderList(mine, t("empty_mine"), true)
                    ) : (
                        <div className={styles.card}>
                            <div className={styles.empty}>
                                {t("select_account")}
                            </div>
                        </div>
                    )}
                </Tabs.TabPane>
            </Tabs>

            {owner ? (
                <>
                    <CreateFundModal
                        visible={creating}
                        owner={owner}
                        onCancel={() => setCreating(false)}
                        onDone={refreshAll}
                    />
                    <UpdateFundModal
                        visible={!!editing}
                        fund={editing}
                        asset={editingAsset}
                        owner={owner}
                        onCancel={() => setEditing(null)}
                        onDone={refreshAll}
                    />
                    <DeleteFundModal
                        visible={!!deleting}
                        fund={deleting}
                        asset={deletingAsset}
                        owner={owner}
                        onCancel={() => setDeleting(null)}
                        onDone={refreshAll}
                    />
                </>
            ) : null}
        </div>
    );
}
