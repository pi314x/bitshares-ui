// The liquidity pools screen (/pools and the explorer's Pools tab).
//
// What it shows: every pool the node knows (or those of one asset, a pair, a
// share asset), each with its reserves, the price of one asset in the other,
// its value, the 24h volume and fees when the node keeps statistics, and what
// the signed-in account holds of it. Two actions per pool: swap (PoolExchange
// Modal) and add / remove liquidity (PoolStakeModal) - those dialogs build and
// sign the transactions; this file only opens them, and only reads from the
// chain.
//
// Data: `PoolmartActions.getLiquidityPools` fills the store's pool map page by
// page (the node serves at most 100 per request; the effect below keeps asking
// for the next page until a page adds nothing). `getPoolsByShareAssets` finds
// the pools whose share tokens the account holds, for "Your liquidity".
//
// Layout: a table on a wide screen, a card per pool on a phone (every column
// of the table is on the card, so nothing needs a sideways scroll).
import * as React from "react";
import {Link, LinkProps} from "react-router-dom";
import counterpart from "counterpart";
import {ChainStore} from "bitsharesjs";
import {Table} from "../../design-system/Table";
import {Select} from "../../design-system/Select";
import {Toolbar} from "../../design-system/Toolbar";
import {Button} from "../../design-system/Button";
import AssetName from "../Utility/AssetName";
import SearchInput from "../Utility/SearchInput";
import PoolmartActions from "../../actions/PoolmartActions";
import PoolExchangeModal from "../Modal/PoolExchangeModal";
import PoolStakeModal from "../Modal/PoolStakeModal";
import AccountStore from "../../stores/AccountStore";
import LoadingIndicator from "../LoadingIndicator";
import {PoolCard, PoolCardData} from "./PoolCard";
import PoolGraph from "./PoolGraph";
import {useReduxState} from "../../next/hooks/useReduxState";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import {useMediaQuery} from "../../next/hooks/useMediaQuery";
import {selectPoolmart} from "../../store/slices/poolmartSlice";
import {selectAccountState} from "../../store/slices/accountSlice";
import {
    PoolSortKey,
    formatAmountShort,
    formatPercent,
    formatPrice,
    poolMetrics,
    shareOfPool,
    sortPools
} from "../../lib/common/poolMetrics";
import styles from "./LiquidityPools.module.scss";

const TypedSearchInput = SearchInput as React.ComponentType<any>;
const TypedLink = Link as React.ComponentType<LinkProps>;

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`poolmart.liquidity_pools.${key}`, params);

const CARDS_PER_STEP = 12;
const TABLE_PAGE = 25;

interface Holding {
    fraction: number;
    amountA: number;
    amountB: number;
}

/** A pool from the node, with its assets resolved, as the list needs it. */
function toCard(pool: any, yours: Holding | null): PoolCardData | null {
    const assetA = pool.asset_a_obj;
    const assetB = pool.asset_b_obj;
    if (!assetA || !assetB) return null;
    const symbolA: string = assetA.get("symbol");
    const symbolB: string = assetB.get("symbol");
    return {
        id: pool.id,
        shareSymbol: pool.share_asset_obj
            ? pool.share_asset_obj.get("symbol")
            : pool.share_asset,
        symbolA,
        symbolB,
        metrics: poolMetrics(
            pool,
            assetA.get("precision"),
            assetB.get("precision")
        ),
        takerFeePercent: pool.taker_fee_percent,
        withdrawalFeePercent: pool.withdrawal_fee_percent,
        yours,
        valueUnit: symbolA
    };
}

/** What `accountName` holds of the pools it has share tokens of. */
function useMyHoldings(
    accountName: string | null
): {
    pools: any[];
    holdings: {[poolId: string]: Holding};
} {
    useChainStoreTick();
    const account: any = accountName
        ? (ChainStore as any).getAccount(accountName)
        : null;
    const balances: {[assetId: string]: string} =
        account && typeof account.get === "function" && account.get("balances")
            ? account.get("balances").toJS()
            : {};
    const key = Object.keys(balances)
        .sort()
        .join(",");
    const [pools, setPools] = React.useState<any[]>([]);
    React.useEffect(() => {
        if (!key) {
            setPools([]);
            return;
        }
        let cancelled = false;
        (PoolmartActions as any)
            .getPoolsByShareAssets(key.split(","))
            .then((found: any[]) => {
                if (!cancelled) setPools(found);
            });
        return () => {
            cancelled = true;
        };
    }, [key]);

    const holdings: {[poolId: string]: Holding} = {};
    const mine: any[] = [];
    pools.forEach(pool => {
        const balanceId = balances[pool.share_asset];
        const balanceObject = balanceId
            ? (ChainStore as any).getObject(balanceId)
            : null;
        const shareAsset: any = (ChainStore as any).getAsset(pool.share_asset);
        const dynamic: any =
            shareAsset && typeof shareAsset.get === "function"
                ? (ChainStore as any).getObject(
                      shareAsset.get("dynamic_asset_data_id")
                  )
                : null;
        if (!balanceObject || !dynamic || !pool.asset_a_obj) return;
        const unit = Math.pow(10, shareAsset.get("precision"));
        const shares = Number(balanceObject.get("balance")) / unit;
        const supply = Number(dynamic.get("current_supply")) / unit;
        if (!(shares > 0)) return;
        const m = poolMetrics(
            pool,
            pool.asset_a_obj.get("precision"),
            pool.asset_b_obj.get("precision")
        );
        const share = shareOfPool(shares, supply, m.reserveA, m.reserveB);
        holdings[pool.id] = share;
        mine.push(pool);
    });
    return {pools: mine, holdings};
}

interface LiquidityPoolsCoreProps {
    liquidityPools: any;
    lastPoolId: string | null;
    defaultAsset: any;
}

function LiquidityPools({liquidityPools, lastPoolId}: LiquidityPoolsCoreProps) {
    const account = useReduxState<any>(selectAccountState);
    const accountName: string | null =
        account.currentAccount || account.passwordAccount || null;
    const phone = useMediaQuery("(max-width: 860px)");

    const [filterAsset, setFilterAsset] = React.useState("");
    const [filterWith, setFilterWith] = React.useState("");
    const [filterShare, setFilterShare] = React.useState("");
    const [sortKey, setSortKey] = React.useState<PoolSortKey>("value");
    const [view, setView] = React.useState<"list" | "graph">("list");
    const [start, setStart] = React.useState("1.19.0");
    const [shownCards, setShownCards] = React.useState(CARDS_PER_STEP);
    const [swapPool, setSwapPool] = React.useState<any>(null);
    const [stakePool, setStakePool] = React.useState<any>(null);

    const resetList = () => {
        setStart("1.19.0");
        setShownCards(CARDS_PER_STEP);
        PoolmartActions.resetLiquidityPools();
    };
    const upper = (value: string) => value.trim().toUpperCase();

    // Debounced fetch: asked again whenever a filter or the start id changes.
    const fetchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    React.useEffect(() => {
        if (fetchTimer.current) clearTimeout(fetchTimer.current);
        fetchTimer.current = setTimeout(() => {
            if (filterShare) {
                (PoolmartActions.getLiquidityPoolsByShareAsset as any).defer(
                    filterShare
                );
            } else {
                (PoolmartActions.getLiquidityPools as any).defer(
                    filterAsset || null,
                    filterWith || null,
                    undefined, // the node's page size
                    start,
                    {withStatistics: true, anySide: true, all: true}
                );
            }
        }, 400);
        return () => {
            if (fetchTimer.current) clearTimeout(fetchTimer.current);
        };
    }, [filterAsset, filterWith, filterShare, start]);

    // Keep asking for the next page while a page brings pools we did not have:
    // compared with the id from *before* this update (the ref is one behind).
    const prevLastPoolId = React.useRef(lastPoolId);
    React.useEffect(() => {
        if (liquidityPools.size > 0) {
            const tailId = liquidityPools.last().id;
            if (tailId !== prevLastPoolId.current) setStart(tailId);
        }
        prevLastPoolId.current = lastPoolId;
        // eslint-disable-next-line
    }, [liquidityPools]);

    const hasAccount =
        AccountStore.getState().myActiveAccounts.length > 0 ||
        !!AccountStore.getState().currentAccount;

    const mine = useMyHoldings(accountName);

    const cards: {data: PoolCardData; pool: any}[] = [];
    liquidityPools.forEach((pool: any) => {
        const data = toCard(pool, mine.holdings[pool.id] || null);
        if (data) cards.push({data, pool});
    });
    const sorted = sortPools(
        cards.map(c => ({
            key: c.data.id,
            data: c.data,
            pool: c.pool,
            metrics: c.data.metrics
        })),
        sortKey
    );

    const yourCards: {data: PoolCardData; pool: any}[] = [];
    mine.pools.forEach(pool => {
        const data = toCard(pool, mine.holdings[pool.id] || null);
        if (data) yourCards.push({data, pool});
    });

    const openSwap = (pool: any) => setSwapPool(pool);
    const openStake = (pool: any) => setStakePool(pool);

    const renderCard = (entry: {data: PoolCardData; pool: any}) => (
        <PoolCard
            key={entry.data.id}
            pool={entry.data}
            canAct={hasAccount}
            onSwap={() => openSwap(entry.pool)}
            onStake={() => openStake(entry.pool)}
        />
    );

    const columns = [
        {
            key: "pair",
            title: t("pair"),
            render: (_value: any, row: any) => (
                <span className={styles.pair}>
                    <TypedLink to={`/asset/${row.data.symbolA}`}>
                        <AssetName name={row.data.symbolA} noTip />
                    </TypedLink>
                    {" / "}
                    <TypedLink to={`/asset/${row.data.symbolB}`}>
                        <AssetName name={row.data.symbolB} noTip />
                    </TypedLink>
                </span>
            )
        },
        {
            key: "share",
            title: t("share_asset"),
            render: (_value: any, row: any) => (
                <span>
                    <TypedLink to={`/asset/${row.data.shareSymbol}`}>
                        <AssetName name={row.data.shareSymbol} noTip />
                    </TypedLink>
                    <br />
                    <span className={styles.muted}>{row.data.id}</span>
                </span>
            )
        },
        {
            key: "reserves",
            title: t("reserves"),
            render: (_value: any, row: any) => (
                <span>
                    {formatAmountShort(row.data.metrics.reserveA)}{" "}
                    <AssetName name={row.data.symbolA} noTip />
                    <br />
                    {formatAmountShort(row.data.metrics.reserveB)}{" "}
                    <AssetName name={row.data.symbolB} noTip />
                </span>
            )
        },
        {
            key: "price",
            title: t("price"),
            render: (_value: any, row: any) => (
                <span>
                    {formatPrice(row.data.metrics.priceBPerA)}{" "}
                    <AssetName name={row.data.symbolB} noTip />
                    <br />
                    <span className={styles.muted}>
                        {t("per_unit", {asset: row.data.symbolA})}
                    </span>
                </span>
            )
        },
        {
            key: "value",
            title: t("pool_value"),
            render: (_value: any, row: any) =>
                `${formatAmountShort(row.data.metrics.poolValueA)} ${
                    row.data.valueUnit
                }`
        },
        {
            key: "volume",
            title: t("volume_24h"),
            render: (_value: any, row: any) =>
                row.data.metrics.volume24hA === null
                    ? "-"
                    : `${formatAmountShort(row.data.metrics.volume24hA)} ${
                          row.data.valueUnit
                      }`
        },
        {
            key: "fees",
            title: t("fees"),
            render: (_value: any, row: any) => (
                <span>
                    {row.data.takerFeePercent / 100}% /{" "}
                    {row.data.withdrawalFeePercent / 100}%
                    {row.data.metrics.feeYield24h !== null ? (
                        <>
                            <br />
                            <span className={styles.muted}>
                                {t("fees_24h", {
                                    percent: formatPercent(
                                        row.data.metrics.feeYield24h * 365
                                    )
                                })}
                            </span>
                        </>
                    ) : null}
                </span>
            )
        },
        {
            key: "actions",
            title: "",
            render: (_value: any, row: any) => (
                <span className={styles.rowActions}>
                    <Button
                        variant="accent"
                        disabled={!hasAccount || !row.data.metrics.priceBPerA}
                        onClick={() => openSwap(row.pool)}
                    >
                        {t("swap")}
                    </Button>
                    <Button
                        disabled={!hasAccount}
                        onClick={() => openStake(row.pool)}
                    >
                        {t("add_remove")}
                    </Button>
                </span>
            )
        }
    ];

    const loadingFirst = liquidityPools.size === 0;

    return (
        <div className={styles.page}>
            {yourCards.length > 0 ? (
                <section className={styles.section}>
                    <h2 className={styles.heading}>{t("your_liquidity")}</h2>
                    <div className={styles.cards}>
                        {yourCards.map(renderCard)}
                    </div>
                </section>
            ) : null}

            <section className={styles.section}>
                <h2 className={styles.heading}>
                    {t("all_pools", {count: sorted.length})}
                </h2>
                <Toolbar>
                    <Toolbar.Grow>
                        <TypedSearchInput
                            placeholder={t("asset")}
                            value={filterAsset}
                            maxLength={32}
                            onChange={(e: any) => {
                                setFilterAsset(upper(e.target.value));
                                setFilterShare("");
                                resetList();
                            }}
                        />
                    </Toolbar.Grow>
                    <Toolbar.Grow>
                        <TypedSearchInput
                            placeholder={t("paired_with")}
                            value={filterWith}
                            maxLength={32}
                            onChange={(e: any) => {
                                setFilterWith(upper(e.target.value));
                                setFilterShare("");
                                resetList();
                            }}
                        />
                    </Toolbar.Grow>
                    <Toolbar.Grow>
                        <TypedSearchInput
                            placeholder={t("share_asset")}
                            value={filterShare}
                            maxLength={32}
                            onChange={(e: any) => {
                                setFilterShare(upper(e.target.value));
                                if (e.target.value) {
                                    setFilterAsset("");
                                    setFilterWith("");
                                }
                                resetList();
                            }}
                        />
                    </Toolbar.Grow>
                    <Toolbar.End>
                        <span className={styles.views} role="group">
                            {(["list", "graph"] as const).map(choice => (
                                <button
                                    key={choice}
                                    type="button"
                                    aria-pressed={view === choice}
                                    className={`${styles.view} ${
                                        view === choice ? styles.viewOn : ""
                                    }`}
                                    onClick={() => setView(choice)}
                                >
                                    {t(`view_${choice}`)}
                                </button>
                            ))}
                        </span>
                        <Select
                            style={{width: "170px"}}
                            value={sortKey}
                            onChange={value =>
                                setSortKey(String(value) as PoolSortKey)
                            }
                        >
                            <Select.Option value="value">
                                {t("sort_value")}
                            </Select.Option>
                            <Select.Option value="volume">
                                {t("volume_24h")}
                            </Select.Option>
                            <Select.Option value="newest">
                                {t("sort_newest")}
                            </Select.Option>
                        </Select>
                    </Toolbar.End>
                </Toolbar>

                {loadingFirst ? (
                    <div className={styles.loading}>
                        <LoadingIndicator type="three-bounce" />
                    </div>
                ) : view === "graph" ? (
                    <PoolGraph
                        pools={cards.map(c => c.pool)}
                        onShowAsset={symbol => {
                            setFilterAsset(symbol.toUpperCase());
                            setFilterWith("");
                            setFilterShare("");
                            resetList();
                            setView("list");
                        }}
                    />
                ) : phone ? (
                    <>
                        <div className={styles.cards}>
                            {sorted.slice(0, shownCards).map(renderCard)}
                        </div>
                        {shownCards < sorted.length ? (
                            <div className={styles.more}>
                                <Button
                                    onClick={() =>
                                        setShownCards(n => n + CARDS_PER_STEP)
                                    }
                                >
                                    {t("show_more")}
                                </Button>
                            </div>
                        ) : null}
                    </>
                ) : (
                    <Table
                        columns={columns}
                        rowKey="key"
                        dataSource={sorted}
                        pagination={{pageSize: TABLE_PAGE}}
                    />
                )}
                {!loadingFirst && sorted.length === 0 ? (
                    <div className={styles.loading}>{t("no_pools")}</div>
                ) : null}
            </section>

            {swapPool ? (
                <PoolExchangeModal
                    isModalVisible={true}
                    onHideModal={() => setSwapPool(null)}
                    pool={swapPool.share_asset}
                />
            ) : null}
            {stakePool ? (
                <PoolStakeModal
                    isModalVisible={true}
                    onHideModal={() => setStakePool(null)}
                    pool={stakePool.share_asset}
                />
            ) : null}
        </div>
    );
}

interface LiquidityPoolsChainContainerProps {
    liquidityPools: any;
    lastPoolId: string | null;
    defaultAsset?: any;
}

// `defaultAsset` (BTS) is resolved before the list is shown, as before: the
// list needs the core asset's object for fee display in the modals.
function LiquidityPoolsChainContainer({
    liquidityPools,
    lastPoolId,
    defaultAsset = "1.3.0"
}: LiquidityPoolsChainContainerProps) {
    useChainStoreTick();
    const resolvedDefaultAsset = (ChainStore as any).getAsset(defaultAsset);

    if (!resolvedDefaultAsset) {
        return (
            <React.Fragment>
                <LoadingIndicator />
                <span className="text-center">Loading ...</span>
            </React.Fragment>
        );
    }

    return (
        <LiquidityPools
            liquidityPools={liquidityPools}
            lastPoolId={lastPoolId}
            defaultAsset={resolvedDefaultAsset}
        />
    );
}

export interface LiquidityPoolsContainerProps {
    defaultAsset?: any;
}

export default function LiquidityPoolsContainer({
    defaultAsset
}: LiquidityPoolsContainerProps) {
    const poolmartState = useReduxState<any>(selectPoolmart);

    return (
        <LiquidityPoolsChainContainer
            liquidityPools={poolmartState.liquidityPools}
            lastPoolId={poolmartState.lastPoolId}
            defaultAsset={defaultAsset}
        />
    );
}
