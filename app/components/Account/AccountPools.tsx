// TypeScript/functional-component port of the legacy AccountPools.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// Three layers collapsed into two: the original's `connect(
// AccountPoolsStoreWrapper, {listenTo: [PoolmartStore, AssetStore],
// getProps})` (an outer alt-react HOC) wrapping `BindToChainState(
// AccountPools, {show_loader: true})` (resolving the required
// `defaultAsset` prop) is replaced by a single `AccountPoolsContainer`
// that calls `useAltStore` twice (once per store - the established
// multi-store pattern from `AccountBrowsingMode.tsx`/`DashboardList.tsx`)
// and then resolves `defaultAsset` via `ChainStore.getAsset` under
// `useChainStoreTick()`, replicating the `show_loader` fallback
// (`<LoadingIndicator />` + "Loading ..." text) exactly as in
// `AccountPage.tsx`'s Container. The original's trivial
// `AccountPoolsStoreWrapper` passthrough class had no logic of its own
// and isn't separately reproduced.
//
// `componentDidMount` (initial `_getLiquidityPools()` fetch) +
// `componentWillReceiveProps` (re-fetches when a newly-arrived
// `liquidityPools` prop's last pool id doesn't match the *previous*
// render's `lastPoolId` prop) are unified into one `useEffect` keyed on
// `liquidityPools`, with a mount-flag ref distinguishing the two call
// sites - the same mount+update unification pattern used throughout
// this migration. `_getLiquidityPools`'s debounce timer becomes a
// `useRef`. Each `setState(update, callback)` call's callback is invoked
// synchronously right after the corresponding state update instead of
// via a dedicated effect, since neither `_getLiquidityPools` nor
// `_resetLiquidityPools` ever reads the just-updated state field itself
// (both only read `props`/other state), so the ordering guarantee a real
// setState callback provides isn't actually depended upon here.
//
// Dropped as confirmed dead (found while porting, not merely carried
// forward): `state.total` (initialized and reset, never read anywhere -
// the `<Table>`'s `pagination.total` uses `dataSource.length` instead);
// `state.lastPoolId` (set only inside `_resetLiquidityPools`, but every
// actual comparison in the file reads the *prop* `lastPoolId`, from
// `PoolmartStore`, never this state field); the connect-provided
// `liquidityPoolsLoading` prop (computed by the original `getProps` but
// never read anywhere in the class); and, in `render()`, the
// `if (assetsList.length) { assets = assets.clear(); ... }` re-mapping
// block - `assetsList` here is a genuine Immutable.js `List` (built
// directly via `List().push(id)` in `getProps`, unlike the *same-looking*
// code in `AccountAssets.tsx`, where `assetsList` comes from
// `BindToChainState`'s `chain_assets_list` resolution and really is a
// plain JS array). `List` has no `.length` property (only `.size`), so
// `assetsList.length` is always `undefined` and this branch can never
// run - `assets` (from `AssetStore`) is always used as-is.
//
// Preserved verbatim (not "fixed"): `_hideDeleteModal`'s
// `selectedPool: pool` sets `selectedPool` to `undefined`, not `null` -
// `DeletePoolModal`'s `onHideModal` is always invoked with zero
// arguments (verified in `Modal/DeletePoolModal.jsx`), so the `pool`
// parameter here is always `undefined`; this differs from
// `_hideExchangeModal`/`_hideStakeModal`, which explicitly set
// `selectedPool: null`. `_deletePool`'s `pool` parameter is likewise
// always ignored (it reads `state.selectedPool.id` instead), even though
// `DeletePoolModal.onDeletePool` *is* actually called with an argument
// (`this.props.pool`, a share-asset symbol string) - the function just
// never uses it. The filter inputs (`filterAssetA`/`filterAssetB`/
// `filterShareAsset`) are tracked in state and re-trigger a fetch on
// change, but are never actually applied to `dataSource` in `render()` -
// that's the original's own behavior, not a porting omission.
import * as React from "react";
import {Table} from "../../design-system/Table";
import {Select} from "../../design-system/Select";
import {Link} from "react-router-dom";
import counterpart from "counterpart";
import {ChainStore} from "bitsharesjs";
import Translate from "react-translate-component";
import AssetName from "../Utility/AssetName";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import {useAltStore} from "../../next/hooks/useAltStore";
import SearchInput from "../Utility/SearchInput";
import PoolmartStore from "../../stores/PoolmartStore";
import PoolmartActions from "../../actions/PoolmartActions";
import Icon from "../Icon/Icon";
import PoolExchangeModal from "../Modal/PoolExchangeModal";
import PoolStakeModal from "../Modal/PoolStakeModal";
import CreatePoolModal from "../Modal/CreatePoolModal";
import DeletePoolModal from "../Modal/DeletePoolModal";
import {Tabs, Tab} from "../Utility/Tabs";
import {List} from "immutable";
import AssetStore from "stores/AssetStore";
import ApplicationApi from "api/ApplicationApi";
import LoadingIndicator from "../LoadingIndicator";

const LinkComponent = Link as React.ComponentType<any>;

interface AccountPoolsState {
    filterAssetA: any;
    filterAssetB: any;
    filterShareAsset: any;
    start: string;
    limit: number;
    isExchangeModalVisible: boolean;
    isStakeModalVisible: boolean;
    selectedPool: any;
    isCreatePoolModalVisible: boolean;
    isDeletePoolModalVisible: boolean;
}

interface AccountPoolsCoreProps {
    account: any;
    account_name: any;
    assets: any;
    assetsList: any;
    liquidityPools: any;
    lastPoolId: any;
    defaultAsset: any;
}

function AccountPools({
    account,
    account_name,
    assets,
    assetsList,
    liquidityPools,
    lastPoolId,
    defaultAsset
}: AccountPoolsCoreProps) {
    const [state, setState] = React.useState<AccountPoolsState>({
        filterAssetA: defaultAsset ? defaultAsset.get("symbol") : null,
        filterAssetB: null,
        filterShareAsset: null,
        start: "1.19.0",
        limit: 10,
        isExchangeModalVisible: false,
        isStakeModalVisible: false,
        selectedPool: null,
        isCreatePoolModalVisible: false,
        isDeletePoolModalVisible: false
    });

    const mergeState = (partial: Partial<AccountPoolsState>) => {
        setState(prev => ({...prev, ...partial}));
    };

    const timerRef = React.useRef<any>(null);

    const getLiquidityPools = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }
        timerRef.current = setTimeout(() => {
            (PoolmartActions as any).getLiquidityPoolsAccount.defer(
                account_name
            );
        }, 500);
    };

    const resetLiquidityPools = () => {
        mergeState({
            start: "1.19.0"
        });
        (PoolmartActions as any).resetLiquidityPools();
    };

    const isMountRef = React.useRef(true);
    const prevLiquidityPoolsRef = React.useRef(liquidityPools);
    const prevLastPoolIdRef = React.useRef(lastPoolId);

    React.useEffect(() => {
        if (isMountRef.current) {
            isMountRef.current = false;
            getLiquidityPools();
            prevLiquidityPoolsRef.current = liquidityPools;
            prevLastPoolIdRef.current = lastPoolId;
            return;
        }
        if (liquidityPools !== prevLiquidityPoolsRef.current) {
            if (
                liquidityPools.size > 0 &&
                liquidityPools.last().id !== prevLastPoolIdRef.current
            ) {
                mergeState({start: liquidityPools.last().id});
                getLiquidityPools();
            }
        }
        prevLiquidityPoolsRef.current = liquidityPools;
        prevLastPoolIdRef.current = lastPoolId;
    }, [liquidityPools]);

    const onFilterAssetA = (e: any) => {
        if (e.target.value) {
            mergeState({filterAssetA: e.target.value.toUpperCase()});
            getLiquidityPools();
            resetLiquidityPools();
        } else {
            mergeState({filterAssetA: ""});
            resetLiquidityPools();
        }
    };

    const onFilterAssetB = (e: any) => {
        if (e.target.value) {
            mergeState({filterAssetB: e.target.value.toUpperCase()});
            getLiquidityPools();
            resetLiquidityPools();
        } else {
            mergeState({filterAssetB: ""});
            resetLiquidityPools();
        }
    };

    const onFilterShareAsset = (e: any) => {
        if (e.target.value) {
            mergeState({
                filterAssetA: null,
                filterAssetB: null,
                filterShareAsset: e.target.value.toUpperCase()
            });
            getLiquidityPools();
            resetLiquidityPools();
        } else {
            mergeState({filterShareAsset: ""});
            resetLiquidityPools();
        }
    };

    const handleRowsChange = (limit: any) => {
        mergeState({
            limit: parseInt(limit, 10),
            start: "1.19.0"
        });
        resetLiquidityPools();
        getLiquidityPools();
    };

    const showExchangeModal = (pool: any) => {
        mergeState({isExchangeModalVisible: true, selectedPool: pool});
    };

    const hideExchangeModal = () => {
        mergeState({isExchangeModalVisible: false, selectedPool: null});
    };

    const showStakeModal = (pool: any) => {
        mergeState({isStakeModalVisible: true, selectedPool: pool});
    };

    const hideStakeModal = () => {
        mergeState({isStakeModalVisible: false, selectedPool: null});
    };

    const showCreatePoolModal = () => {
        mergeState({isCreatePoolModalVisible: true});
    };

    const hideCreatePoolModal = () => {
        mergeState({isCreatePoolModalVisible: false});
    };

    const showDeleteModal = (pool: any) => {
        mergeState({isDeletePoolModalVisible: true, selectedPool: pool});
    };

    const hideDeleteModal = (pool?: any) => {
        mergeState({isDeletePoolModalVisible: false, selectedPool: pool});
    };

    const deletePool = () => {
        console.log("_deletePool invoked.");

        const selectedPool = state.selectedPool;

        mergeState({isDeletePoolModalVisible: false});

        (ApplicationApi as any)
            .liquidityPoolDelete(account, selectedPool["id"])
            .then(() => {
                if (timerRef.current) {
                    clearTimeout(timerRef.current);
                }
                timerRef.current = setTimeout(() => {
                    (PoolmartActions as any).getLiquidityPoolsAccount.defer(
                        account_name
                    );
                }, 500);
            });
    };

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
            render: (item: any) => {
                return item ? (
                    <LinkComponent to={`/asset/${item}`}>
                        <AssetName name={item} />
                    </LinkComponent>
                ) : null;
            },
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
            render: (item: any) => {
                return item ? (
                    <LinkComponent to={`/asset/${item}`}>
                        <AssetName name={item} />
                    </LinkComponent>
                ) : null;
            },
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
            render: (item: any) => {
                return item ? (
                    <LinkComponent to={`/asset/${item}`}>
                        <AssetName name={item} />
                    </LinkComponent>
                ) : null;
            },
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
            render: (item: any) => (
                <a onClick={() => showExchangeModal(item)}>
                    <Icon name="poolmart" />
                </a>
            )
        },
        {
            key: "stake_unstake",
            title: counterpart.translate(
                "poolmart.liquidity_pools.stake_unstake"
            ),
            render: (item: any) => (
                <a onClick={() => showStakeModal(item)}>
                    <Icon name="deposit" />
                </a>
            )
        },
        {
            key: "delete_pool",
            title: counterpart.translate(
                "poolmart.liquidity_pools.delete_pool"
            ),
            render: (item: any) => (
                <a onClick={() => showDeleteModal(item)}>
                    <Icon name="delete" />
                </a>
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
        <div className="tabs-container generic-bordered-box">
            <Tabs
                segmented={false}
                setting="issuedAssetsTab"
                className="account-tabs"
                tabsClass="account-overview bordered-header content-block"
                contentClass="padding"
            >
                <Tab title="account.liquidity_pools.liquidity_pools">
                    <div className="grid-block vertical">
                        <div className="grid-content no-padding">
                            <SearchInput
                                placeholder={counterpart.translate(
                                    "poolmart.liquidity_pools.asset_a"
                                )}
                                value={state.filterAssetA}
                                onChange={onFilterAssetA}
                                style={{
                                    width: "200px",
                                    marginBottom: "12px",
                                    marginTop: "4px"
                                }}
                            />
                            <SearchInput
                                placeholder={counterpart.translate(
                                    "poolmart.liquidity_pools.asset_b"
                                )}
                                value={state.filterAssetB}
                                onChange={onFilterAssetB}
                                style={{
                                    width: "200px",
                                    marginLeft: "20px",
                                    marginBottom: "12px",
                                    marginTop: "4px"
                                }}
                            />
                            <SearchInput
                                placeholder={counterpart.translate(
                                    "poolmart.liquidity_pools.share_asset"
                                )}
                                value={state.filterShareAsset}
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
                                value={state.limit}
                                onChange={handleRowsChange}
                            >
                                <Select.Option key={"10"} value={"10"}>
                                    10 rows
                                </Select.Option>
                                <Select.Option key={"25"} value={"25"}>
                                    25 rows
                                </Select.Option>
                                <Select.Option key={"50"} value={"50"}>
                                    50 rows
                                </Select.Option>
                                <Select.Option key={"100"} value={"100"}>
                                    100 rows
                                </Select.Option>
                            </Select>
                        </div>
                        <div className="grid-content no-padding">
                            <Table
                                columns={columns}
                                rowKey="id"
                                dataSource={dataSource}
                                pagination={{
                                    pageSize: state.limit,
                                    total: dataSource.length
                                }}
                            />
                        </div>
                        <div className="content-block">
                            <button
                                className="button"
                                onClick={() => showCreatePoolModal()}
                            >
                                <Translate content="account.liquidity_pools.create_pool" />
                            </button>
                        </div>
                        {state.isExchangeModalVisible && (
                            <PoolExchangeModal
                                isModalVisible={state.isExchangeModalVisible}
                                onHideModal={hideExchangeModal}
                                pool={state.selectedPool.share_asset}
                            />
                        )}
                        {state.isStakeModalVisible && (
                            <PoolStakeModal
                                isModalVisible={state.isStakeModalVisible}
                                onHideModal={hideStakeModal}
                                pool={state.selectedPool.share_asset}
                            />
                        )}
                        {state.isDeletePoolModalVisible && (
                            <DeletePoolModal
                                isModalVisible={state.isDeletePoolModalVisible}
                                onHideModal={hideDeleteModal}
                                onDeletePool={deletePool}
                                pool={state.selectedPool.share_asset}
                            />
                        )}
                        <CreatePoolModal
                            showModal={showCreatePoolModal}
                            hideModal={hideCreatePoolModal}
                            visible={state.isCreatePoolModalVisible}
                            account={account}
                            assetsList={assetsList}
                            searchList={assets}
                            name={account_name}
                        />
                    </div>
                </Tab>
            </Tabs>
        </div>
    );
}

interface AccountPoolsContainerProps {
    account: any;
    account_name: any;
    defaultAsset?: any;
    [key: string]: any;
}

interface AccountPoolsChainContainerProps
    extends Omit<AccountPoolsCoreProps, "defaultAsset"> {
    defaultAsset?: any;
}

function AccountPoolsChainContainer({
    account,
    account_name,
    assets,
    assetsList,
    liquidityPools,
    lastPoolId,
    defaultAsset = "1.3.0"
}: AccountPoolsChainContainerProps) {
    useChainStoreTick();
    const resolvedDefaultAsset = ChainStore.getAsset(defaultAsset);

    if (!resolvedDefaultAsset) {
        return (
            <React.Fragment>
                <LoadingIndicator />
                <span className="text-center">Loading ...</span>
            </React.Fragment>
        );
    }

    return (
        <AccountPools
            account={account}
            account_name={account_name}
            assets={assets}
            assetsList={assetsList}
            liquidityPools={liquidityPools}
            lastPoolId={lastPoolId}
            defaultAsset={resolvedDefaultAsset}
        />
    );
}

function AccountPoolsContainer(props: AccountPoolsContainerProps) {
    const poolmartState = useAltStore<any>(PoolmartStore);
    const assetState = useAltStore<any>(AssetStore);

    let assetsList = List();
    if (props.account.get("assets", []).size) {
        props.account.get("assets", []).forEach((id: any) => {
            assetsList = assetsList.push(id);
        });
    }
    const assets = assetState.assets;

    return (
        <AccountPoolsChainContainer
            {...props}
            liquidityPools={poolmartState.liquidityPools}
            lastPoolId={poolmartState.lastPoolId}
            assets={assets}
            assetsList={assetsList}
        />
    );
}

export default AccountPoolsContainer;
