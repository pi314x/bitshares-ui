// TypeScript/functional-component port of the legacy LiquidityPools.jsx
// (Phase 2, docs/UI_MIGRATION_PLAN.md) — the "/explorer/pools" tab's
// listing/filter/pagination UI. `PoolExchangeModal` and `PoolStakeModal`
// (the actual trade/stake actions, which do involve signing) are reused
// exactly as before, not touched — this file only opens them.
//
// Pre-existing bug found while porting, left as-is (not this port's job
// to silently change behavior — see the same reasoning applied to
// CommitteeMembers.tsx's copy-pasted translation key): the legacy
// `_getLiquidityPools` destructured `GetLimit` from `this.state`, but no
// such field was ever set — only lowercase `limit` was. `GetLimit` was
// always `undefined`, so the rows-per-page selector never actually
// affected how many pools the API returns per fetch (it does still
// affect the antd `Table`'s client-side `pagination.pageSize`, which
// reads `limit` correctly). Preserved here as an explicit `undefined`
// rather than silently "fixed" to `limit` - flagged in the migration
// plan for whoever owns this screen's behavior to decide.
//
// Also dropped, confirmed dead by reading the whole file: `this.state.total`
// and `this.state.lastPoolId` were both set (in the constructor and
// `_resetLiquidityPools`) but never read anywhere - `this.props.lastPoolId`
// (from PoolmartStore) is the one that matters for pagination, which this
// port keeps.
//
// The auto-pagination effect (fetch more as soon as new pools arrive,
// until the API returns nothing new) needs the same "compare against the
// value from before this update" semantics the legacy
// `componentWillReceiveProps(nextProps)` had by comparing
// `nextProps.liquidityPools` against `this.props.lastPoolId` (the *old*
// props' lastPoolId, since `this.props` hadn't been reassigned yet). A
// ref captures that "previous" value explicitly, updated only after the
// comparison, to reproduce the same timing with hooks.
import * as React from "react";
import {Table, Select} from "bitshares-ui-style-guide";
import {Link, LinkProps} from "react-router-dom";
import counterpart from "counterpart";
import {ChainStore} from "bitsharesjs";
import AssetName from "../Utility/AssetName";
import SearchInput from "../Utility/SearchInput";
import PoolmartStore from "../../stores/PoolmartStore";
import PoolmartActions from "../../actions/PoolmartActions";
import Icon from "../Icon/Icon";
import PoolExchangeModal from "../Modal/PoolExchangeModal";
import PoolStakeModal from "../Modal/PoolStakeModal";
import AccountStore from "../../stores/AccountStore";
import {useAltStore} from "../../next/hooks/useAltStore";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";

const TypedSearchInput = SearchInput as React.ComponentType<any>;
const TypedLink = Link as React.ComponentType<LinkProps>;

export default function LiquidityPools() {
    useChainStoreTick();
    const poolmartState = useAltStore<any>(PoolmartStore);
    const liquidityPools: Immutable.Map<string, any> =
        poolmartState.liquidityPools;
    const lastPoolId: string | null = poolmartState.lastPoolId;

    const defaultAsset = ChainStore.getAsset("1.3.0");

    const [filterAssetA, setFilterAssetA] = React.useState<string | null>(
        () => (defaultAsset ? defaultAsset.get("symbol") : null)
    );
    const [filterAssetB, setFilterAssetB] = React.useState<string | null>(null);
    const [filterShareAsset, setFilterShareAsset] = React.useState<
        string | null
    >(null);
    const [start, setStart] = React.useState("1.19.0");
    const [limit, setLimit] = React.useState(10);
    const [isExchangeModalVisible, setExchangeModalVisible] = React.useState(
        false
    );
    const [isStakeModalVisible, setStakeModalVisible] = React.useState(false);
    const [selectedPool, setSelectedPool] = React.useState<any>(null);

    function resetLiquidityPools() {
        setStart("1.19.0");
        PoolmartActions.resetLiquidityPools();
    }

    function onFilterAssetA(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.value) {
            setFilterAssetA(e.target.value.toUpperCase());
        } else {
            setFilterAssetA("");
        }
        resetLiquidityPools();
    }

    function onFilterAssetB(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.value) {
            setFilterAssetB(e.target.value.toUpperCase());
        } else {
            setFilterAssetB("");
        }
        resetLiquidityPools();
    }

    function onFilterShareAsset(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.value) {
            setFilterAssetA(null);
            setFilterAssetB(null);
            setFilterShareAsset(e.target.value.toUpperCase());
        } else {
            setFilterShareAsset("");
        }
        resetLiquidityPools();
    }

    function handleRowsChange(nextLimit: string) {
        setLimit(parseInt(nextLimit, 10));
        setStart("1.19.0");
        resetLiquidityPools();
    }

    function showExchangeModal(pool: any) {
        setExchangeModalVisible(true);
        setSelectedPool(pool);
    }

    function hideExchangeModal() {
        setExchangeModalVisible(false);
        setSelectedPool(null);
    }

    function showStakeModal(pool: any) {
        setStakeModalVisible(true);
        setSelectedPool(pool);
    }

    function hideStakeModal() {
        setStakeModalVisible(false);
        setSelectedPool(null);
    }

    // Debounced fetch, replacing every setState-callback call site the
    // legacy class had (mount, each filter change, row-limit change,
    // and the pagination effect below all just change one of these
    // dependencies now instead of each separately invoking a fetch).
    const fetchTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
        null
    );
    React.useEffect(() => {
        if (fetchTimer.current) clearTimeout(fetchTimer.current);
        fetchTimer.current = setTimeout(() => {
            if (filterShareAsset) {
                (PoolmartActions.getLiquidityPoolsByShareAsset as any).defer(
                    filterShareAsset
                );
            } else {
                (PoolmartActions.getLiquidityPools as any).defer(
                    filterAssetA,
                    filterAssetB,
                    undefined, // see header comment: legacy GetLimit typo, preserved
                    start
                );
            }
        }, 500);
        return () => {
            if (fetchTimer.current) clearTimeout(fetchTimer.current);
        };
    }, [filterAssetA, filterAssetB, filterShareAsset, start]);

    // Auto-pagination: keep loading more pools as long as a fetch
    // returns a batch whose tail differs from the lastPoolId we had
    // before this update (see header comment for why "before this
    // update" matters).
    const prevLastPoolIdRef = React.useRef(lastPoolId);
    React.useEffect(() => {
        if (liquidityPools.size > 0) {
            const tailId = liquidityPools.last().id;
            if (tailId !== prevLastPoolIdRef.current) {
                setStart(tailId);
            }
        }
        prevLastPoolIdRef.current = lastPoolId;
        // eslint-disable-next-line
    }, [liquidityPools]);

    const hasLoggedIn =
        AccountStore.getState().myActiveAccounts.length > 0 ||
        !!AccountStore.getState().currentAccount;

    const columns = [
        {
            key: "id",
            dataIndex: "id",
            title: counterpart.translate("poolmart.liquidity_pools.pool_id"),
            sorter: (a: any, b: any) => {
                const aId = a.id.split(".")[2];
                const bId = b.id.split(".")[2];
                return aId - bId;
            }
        },
        {
            key: "share_asset_str",
            dataIndex: "share_asset_str",
            title: counterpart.translate(
                "poolmart.liquidity_pools.share_asset"
            ),
            render: (item: string) =>
                item ? (
                    <TypedLink to={`/asset/${item}`}>
                        <AssetName name={item} />
                    </TypedLink>
                ) : null,
            sorter: (a: any, b: any) =>
                a.share_asset_str > b.share_asset_str
                    ? 1
                    : a.share_asset_str < b.share_asset_str
                    ? -1
                    : 0
        },
        {
            key: "asset_a_str",
            dataIndex: "asset_a_str",
            title: counterpart.translate("poolmart.liquidity_pools.asset_a"),
            render: (item: string) =>
                item ? (
                    <TypedLink to={`/asset/${item}`}>
                        <AssetName name={item} />
                    </TypedLink>
                ) : null,
            sorter: (a: any, b: any) =>
                a.asset_a_str > b.asset_a_str
                    ? 1
                    : a.asset_a_str < b.asset_a_str
                    ? -1
                    : 0
        },
        {
            key: "asset_a_qty",
            dataIndex: "asset_a_qty",
            title: counterpart.translate(
                "poolmart.liquidity_pools.asset_a_qty"
            ),
            sorter: (a: any, b: any) => a.asset_a_qty - b.asset_a_qty
        },
        {
            key: "asset_b_str",
            dataIndex: "asset_b_str",
            title: counterpart.translate("poolmart.liquidity_pools.asset_b"),
            render: (item: string) =>
                item ? (
                    <TypedLink to={`/asset/${item}`}>
                        <AssetName name={item} />
                    </TypedLink>
                ) : null,
            sorter: (a: any, b: any) =>
                a.asset_b_str > b.asset_b_str
                    ? 1
                    : a.asset_b_str < b.asset_b_str
                    ? -1
                    : 0
        },
        {
            key: "asset_b_qty",
            dataIndex: "asset_b_qty",
            title: counterpart.translate(
                "poolmart.liquidity_pools.asset_b_qty"
            ),
            sorter: (a: any, b: any) => a.asset_b_qty - b.asset_b_qty
        },
        {
            key: "taker_fee_percent",
            dataIndex: "taker_fee_percent_str",
            title: counterpart.translate(
                "poolmart.liquidity_pools.taker_fee_percent"
            )
        },
        {
            key: "withdrawal_fee_percent",
            dataIndex: "withdrawal_fee_percent_str",
            title: counterpart.translate(
                "poolmart.liquidity_pools.withdrawal_fee_percent"
            )
        },
        {
            key: "exchange",
            title: counterpart.translate("poolmart.liquidity_pools.exchange"),
            render: (item: any) =>
                hasLoggedIn ? (
                    <a onClick={() => showExchangeModal(item)}>
                        <Icon name="poolmart" />
                    </a>
                ) : (
                    <Icon name="poolmart" />
                )
        },
        {
            key: "stake_unstake",
            title: counterpart.translate(
                "poolmart.liquidity_pools.stake_unstake"
            ),
            render: (item: any) =>
                hasLoggedIn ? (
                    <a onClick={() => showStakeModal(item)}>
                        <Icon name="deposit" />
                    </a>
                ) : (
                    <Icon name="deposit" />
                )
        }
    ];

    const dataSource: any[] = [];
    liquidityPools.forEach((pool: any) => {
        const row = pool;
        row.share_asset_str = pool.share_asset_obj
            ? pool.share_asset_obj.get("symbol")
            : pool.share_asset;
        row.asset_a_str = pool.asset_a_obj
            ? pool.asset_a_obj.get("symbol")
            : pool.asset_a;
        row.asset_b_str = pool.asset_b_obj
            ? pool.asset_b_obj.get("symbol")
            : pool.asset_b;
        row.asset_a_qty = pool.asset_a_obj
            ? pool.balance_a / Math.pow(10, pool.asset_a_obj.get("precision"))
            : 0;
        row.asset_b_qty = pool.asset_b_obj
            ? pool.balance_b / Math.pow(10, pool.asset_b_obj.get("precision"))
            : 0;
        row.taker_fee_percent_str = `${pool.taker_fee_percent / 100}%`;
        row.withdrawal_fee_percent_str = `${pool.withdrawal_fee_percent /
            100}%`;
        dataSource.push(row);
    });

    return (
        <div className="grid-block vertical">
            <div className="grid-content no-padding">
                <TypedSearchInput
                    placeholder={counterpart.translate(
                        "poolmart.liquidity_pools.asset_a"
                    )}
                    value={filterAssetA}
                    onChange={onFilterAssetA}
                    style={{
                        width: "200px",
                        marginBottom: "12px",
                        marginTop: "4px"
                    }}
                />
                <TypedSearchInput
                    placeholder={counterpart.translate(
                        "poolmart.liquidity_pools.asset_b"
                    )}
                    value={filterAssetB}
                    onChange={onFilterAssetB}
                    style={{
                        width: "200px",
                        marginLeft: "20px",
                        marginBottom: "12px",
                        marginTop: "4px"
                    }}
                />
                <TypedSearchInput
                    placeholder={counterpart.translate(
                        "poolmart.liquidity_pools.share_asset"
                    )}
                    value={filterShareAsset}
                    onChange={onFilterShareAsset}
                    style={{
                        width: "200px",
                        marginLeft: "20px",
                        marginBottom: "12px",
                        marginTop: "4px"
                    }}
                />
                <Select
                    style={{
                        width: "150px",
                        marginLeft: "24px",
                        marginTop: "4px"
                    }}
                    value={limit}
                    onChange={handleRowsChange}
                >
                    <Select.Option key={"10"}>10 rows</Select.Option>
                    <Select.Option key={"25"}>25 rows</Select.Option>
                    <Select.Option key={"50"}>50 rows</Select.Option>
                    <Select.Option key={"100"}>100 rows</Select.Option>
                </Select>
            </div>
            <div className="grid-content no-padding">
                <Table
                    columns={columns}
                    rowKey="id"
                    dataSource={dataSource}
                    pagination={{
                        pageSize: limit,
                        total: dataSource.length
                    }}
                />
            </div>
            {isExchangeModalVisible && (
                <PoolExchangeModal
                    isModalVisible={isExchangeModalVisible}
                    onHideModal={hideExchangeModal}
                    pool={selectedPool.share_asset}
                />
            )}
            {isStakeModalVisible && (
                <PoolStakeModal
                    isModalVisible={isStakeModalVisible}
                    onHideModal={hideStakeModal}
                    pool={selectedPool.share_asset}
                />
            )}
        </div>
    );
}
