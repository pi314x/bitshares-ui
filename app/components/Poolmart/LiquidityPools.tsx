// TypeScript/functional-component port of the legacy LiquidityPools.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md) - the "/pools" page's pool
// listing/filter/pagination UI. `PoolExchangeModal`/`PoolStakeModal` (the
// actual trade/stake actions, which do involve on-chain signing) are
// reused exactly as before, not touched - this file only opens/closes
// them, same lower-risk category as the already-ported sibling
// `Explorer/LiquidityPools.tsx` and `Account/AccountPools.tsx`.
//
// SECURITY-SENSITIVE per AGENTS.md (this file dispatches on-chain reads,
// even though it doesn't itself sign anything): every
// `PoolmartActions.*` call site from the original is preserved here,
// byte-for-byte in its argument construction:
//   - `PoolmartActions.getLiquidityPoolsByShareAsset.defer(filterShareAsset)`
//     and `PoolmartActions.getLiquidityPools.defer(filterAssetA,
//     filterAssetB, GetLimit, start)` - both inside the debounced fetch
//     effect below (was `_getLiquidityPools`).
//   - `PoolmartActions.resetLiquidityPools()` - inside `resetLiquidityPools`
//     (was `_resetLiquidityPools`), called from every filter-change and
//     rows-per-page handler, exactly as the original did.
// No other `PoolmartActions.`/transaction-dispatch call sites exist in
// this file (grep-confirmed - the only on-chain *writes* this screen can
// reach are inside `PoolExchangeModal`/`PoolStakeModal`, already ported
// and documented as security-sensitive there; this file merely opens
// them). No raw password/private-key/brainkey material is logged
// anywhere in this file (grepped every `console.*` call - see the single
// `console.log();` note below, which logs nothing at all).
//
// Structural change - the original's four layers:
//   `connect(LiquidityPoolsStoreWrapper, {listenTo: [PoolmartStore],
//   getProps})` (outer alt-react HOC)
//     -> `LiquidityPoolsStoreWrapper` (trivial passthrough class, no
//        logic of its own)
//       -> `BindToChainState(LiquidityPools, {show_loader: true})`
//          (resolves the required `defaultAsset` chain prop)
//         -> `LiquidityPools` (the actual class component)
// collapse into three functions, following the exact precedent set by
// `Account/AccountPools.tsx` (also `connect(...) + BindToChainState(...,
// {show_loader: true})`, same two-store-free shape here since this file
// only ever listened to `PoolmartStore`):
//   - `LiquidityPoolsContainer` (default export): calls
//     `useAltStore(PoolmartStore)` once, replacing the outer `connect`.
//     The `LiquidityPoolsStoreWrapper` passthrough class isn't separately
//     reproduced since it had no logic of its own.
//   - `LiquidityPoolsChainContainer`: calls `useChainStoreTick()` and
//     resolves `defaultAsset` via `ChainStore.getAsset(...)`, replicating
//     `BindToChainState`'s `options.show_loader` fallback *exactly* as
//     read from `app/components/Utility/BindToChainState.jsx` (its
//     `render()`'s required-prop-unresolved branch, when
//     `options.show_loader` is truthy, returns `<LoadingIndicator />` +
//     `<span className="text-center">Loading ...</span>` inside a
//     Fragment - NOT the bare `<span />` fallback used by components
//     ported without that option, e.g. `Modal/WithdrawModalNew.tsx`'s
//     Container). `LoadingIndicator` is imported for this from
//     `../LoadingIndicator`, matching what `BindToChainState.jsx` itself
//     imports and renders for that option.
//   - `LiquidityPools` (core): the actual rendering/state logic, taking
//     the already-resolved `defaultAsset` (a resolved Immutable asset
//     object, never null/undefined by the time this renders, exactly as
//     the original class's `this.props.defaultAsset` was guaranteed to be
//     post-`BindToChainState`) plus `liquidityPools`/`lastPoolId` from
//     `PoolmartStore`.
//
// Dropped as confirmed dead (grep-evidenced, same findings already
// documented in the sibling `Explorer/LiquidityPools.tsx` and
// `Account/AccountPools.tsx` ports for the equivalent fields):
//   - `state.total` - initialized in the constructor and reset inside
//     `_resetLiquidityPools`, never read anywhere; the antd `<Table>`'s
//     `pagination.total` uses `dataSource.length` instead.
//   - A *local* `state.lastPoolId` - set to `null` only inside
//     `_resetLiquidityPools`, never read anywhere. This is distinct from
//     the `lastPoolId` *prop* sourced from `PoolmartStore`, which IS kept
//     (it's what the auto-pagination effect below compares against).
//   - The `tile` object (`{disabled: hasLoggedIn ? false : "Please login
//     ..."}`), computed fresh every `render()` from `hasLoggedIn` but
//     never referenced again anywhere in the file.
//   - The connect-provided `liquidityPoolsLoading` prop - computed by the
//     original `getProps()` but never read anywhere in the class.
//
// Preserved verbatim (not "fixed"), both pre-existing bugs/quirks:
//   - The legacy `GetLimit` typo: `_getLiquidityPools` destructured
//     `GetLimit` from `this.state`, but no such field was ever set -
//     only lowercase `limit` was - so `GetLimit` was always `undefined`,
//     meaning the rows-per-page selector never actually affected how many
//     pools the API returns per fetch (it does still affect the antd
//     `<Table>`'s client-side `pagination.pageSize`, which correctly
//     reads `state.limit`/local `limit`). Preserved here as an explicit
//     `undefined` third argument rather than silently "fixed" to `limit`
//     - identical treatment to the `Explorer/LiquidityPools.tsx` and
//     `Account/AccountPools.tsx` ports of the same bug.
//   - The bare `console.log();` call at the top of the original
//     `render()`, with zero arguments - logs nothing at all (not
//     security-sensitive; AGENTS.md's unconditional drop rule is for logs
//     of actual password/private-key/brainkey material, which this is
//     not), kept as-is per the "preserve every bug/quirk verbatim" rule.
//
// The auto-pagination effect (fetch more as soon as a new batch of pools
// arrives, until the API stops returning anything new) needs the same
// "compare against the value from *before* this update" semantics the
// legacy `componentWillReceiveProps(nextProps)` had, by comparing
// `nextProps.liquidityPools` against `this.props.lastPoolId` (the *old*,
// pre-update props value, since `this.props` hadn't been reassigned yet
// at that point in the lifecycle) - reproduced with a ref that's only
// updated *after* the comparison, one render behind, exactly like the
// `Explorer/LiquidityPools.tsx` port.
//
// TypeScript-forced adjustments: `SearchInput` (still an untyped `.jsx`)
// and `Link` are cast via `React.ComponentType<any>`/`LinkProps`
// respectively, matching the established pattern in
// `Explorer/LiquidityPools.tsx`.
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
import LoadingIndicator from "../LoadingIndicator";

const TypedSearchInput = SearchInput as React.ComponentType<any>;
const TypedLink = Link as React.ComponentType<LinkProps>;

interface LiquidityPoolsCoreProps {
    liquidityPools: any;
    lastPoolId: string | null;
    defaultAsset: any;
}

function LiquidityPools({
    liquidityPools,
    lastPoolId,
    defaultAsset
}: LiquidityPoolsCoreProps) {
    const [filterAssetA, setFilterAssetA] = React.useState<string | null>(
        () => (defaultAsset ? defaultAsset.get("symbol") : null)
    );
    const [filterAssetB, setFilterAssetB] = React.useState<string | null>(
        null
    );
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

    // Debounced fetch, replacing the original's `_getLiquidityPools`
    // (called from `componentDidMount`, every filter handler, and
    // `_handleRowsChange`) - each of those just changed one of these
    // dependencies now instead of separately invoking a fetch.
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

    // Auto-pagination: keep loading more pools as long as a fetch returns
    // a batch whose tail differs from the lastPoolId we had *before* this
    // update (see header comment for why "before this update" matters).
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
    console.log();

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

interface LiquidityPoolsChainContainerProps {
    liquidityPools: any;
    lastPoolId: string | null;
    defaultAsset?: any;
}

function LiquidityPoolsChainContainer({
    liquidityPools,
    lastPoolId,
    defaultAsset = "1.3.0"
}: LiquidityPoolsChainContainerProps) {
    useChainStoreTick();
    const resolvedDefaultAsset = ChainStore.getAsset(defaultAsset);

    if (!resolvedDefaultAsset) {
        // Replicates BindToChainState's `options.show_loader` fallback
        // exactly (see header comment / BindToChainState.jsx's render()).
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
    const poolmartState = useAltStore<any>(PoolmartStore);

    return (
        <LiquidityPoolsChainContainer
            liquidityPools={poolmartState.liquidityPools}
            lastPoolId={poolmartState.lastPoolId}
            defaultAsset={defaultAsset}
        />
    );
}
