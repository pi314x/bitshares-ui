// Redux-backed replacement for the Alt.js PoolmartActions
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../store/reduxStore.ts`'s
// header for the overall migration approach). Preserves every method
// name and the exact fetch/normalize logic the original action creators
// ran, dispatching straight into the Redux store instead of going
// through Alt's dispatcher. `getLiquidityPools`/
// `getLiquidityPoolsByShareAsset`/`getLiquidityPoolsAccount` are called
// via `.defer(...)` at several call sites (`Explorer/LiquidityPools.tsx`,
// `Poolmart/LiquidityPools.tsx`, `Account/AccountPools.tsx`) - real Alt
// actions always carry a `.defer()` that calls the action again via
// `setTimeout(..., 0)` (see `alt`'s own source), so every method here
// gets the same `.defer` attached in the constructor to keep those call
// sites working unchanged.
import {Apis} from "bitsharesjs-ws";
import Immutable from "immutable";
import {reduxStore} from "../store/reduxStore";
import {
    getLiquidityPools as getLiquidityPoolsAction,
    getLiquidityPoolsByShareAsset as getLiquidityPoolsByShareAssetAction,
    getLiquidityPoolsAccount as getLiquidityPoolsAccountAction,
    resetLiquidityPools as resetLiquidityPoolsAction
} from "../store/slices/poolmartSlice";

const inProgress: {[key: string]: boolean} = {};

function attachDefer(fn: any) {
    fn.defer = (...args: any[]) => {
        setTimeout(() => fn(...args));
    };
    return fn;
}

class PoolmartActionsFacade {
    constructor() {
        (this as any).getLiquidityPools = attachDefer(
            this.getLiquidityPools.bind(this)
        );
        (this as any).getLiquidityPoolsByShareAsset = attachDefer(
            this.getLiquidityPoolsByShareAsset.bind(this)
        );
        (this as any).resetLiquidityPools = attachDefer(
            this.resetLiquidityPools.bind(this)
        );
        (this as any).getLiquidityPoolsAccount = attachDefer(
            this.getLiquidityPoolsAccount.bind(this)
        );
    }

    /**
     * getLiquidityPools
     * @param {string} assetA (asset symbol or id)
     * @param {string} assetB (asset symbol or id)
     * @param {int} limit
     * @param {string} start (pool id)
     */
    getLiquidityPools(assetA?: any, assetB?: any, limit?: any, start?: any) {
        let method = "";
        let params: any[] = [];
        if (assetA && assetB) {
            method = "get_liquidity_pools_by_both_assets";
            params = [assetA, assetB, limit, start];
        } else if (assetA) {
            method = "get_liquidity_pools_by_asset_a";
            params = [assetA, limit, start];
        } else if (assetB) {
            method = "get_liquidity_pools_by_asset_b";
            params = [assetB, limit, start];
        }
        if (method === "") {
            reduxStore.dispatch(
                getLiquidityPoolsAction({
                    loading: false,
                    liquidityPools: Immutable.Map()
                })
            );
            return;
        }
        const id = `${assetA}_${assetB}_${start}_${limit}`;
        if (!inProgress[id]) {
            inProgress[id] = true;
            reduxStore.dispatch(getLiquidityPoolsAction({loading: true}));

            Apis.instance()
                .db_api()
                .exec(method, params)
                .then((liquidityPools: any) => {
                    const tmpAssetIds: any[] = [];
                    liquidityPools.forEach((pool: any) => {
                        if (tmpAssetIds.indexOf(pool.asset_a) === -1) {
                            tmpAssetIds.push(pool.asset_a);
                        }
                        if (tmpAssetIds.indexOf(pool.asset_b) === -1) {
                            tmpAssetIds.push(pool.asset_b);
                        }
                        if (tmpAssetIds.indexOf(pool.share_asset) === -1) {
                            tmpAssetIds.push(pool.share_asset);
                        }
                    });
                    Apis.instance()
                        .db_api()
                        .exec("lookup_asset_symbols", [tmpAssetIds])
                        .then((assetObjects: any) => {
                            let tmpAssets = Immutable.Map();
                            if (assetObjects.length) {
                                assetObjects.forEach((asset: any) => {
                                    tmpAssets = tmpAssets.set(
                                        asset.id,
                                        Immutable.fromJS(asset)
                                    );
                                });
                            }
                            liquidityPools.map((pool: any) => {
                                if (tmpAssets.has(pool.asset_a)) {
                                    pool.asset_a_obj = tmpAssets.get(
                                        pool.asset_a
                                    );
                                } else {
                                    pool.asset_a_obj = undefined;
                                }
                                if (tmpAssets.has(pool.asset_b)) {
                                    pool.asset_b_obj = tmpAssets.get(
                                        pool.asset_b
                                    );
                                } else {
                                    pool.asset_b_obj = undefined;
                                }
                                if (tmpAssets.has(pool.share_asset)) {
                                    pool.share_asset_obj = tmpAssets.get(
                                        pool.share_asset
                                    );
                                } else {
                                    pool.share_asset_obj = undefined;
                                }
                                return pool;
                            });
                            delete inProgress[id];
                            reduxStore.dispatch(
                                getLiquidityPoolsAction({
                                    loading: false,
                                    liquidityPools
                                })
                            );
                        });
                })
                .catch((error: any) => {
                    console.log(
                        "Error in PoolmartActions.getLiquidityPools: ",
                        error
                    );
                    delete inProgress[id];
                    reduxStore.dispatch(
                        getLiquidityPoolsAction({
                            loading: false,
                            liquidityPools: Immutable.Map(),
                            reset: true
                        })
                    );
                });
        }
    }

    /**
     * getLiquidityPools
     * @param {string} shareAsset (asset symbol or id)
     */
    getLiquidityPoolsByShareAsset(shareAsset: any) {
        const id = `${shareAsset}_poolmart`;
        if (!inProgress[id]) {
            inProgress[id] = true;
            reduxStore.dispatch(
                getLiquidityPoolsByShareAssetAction({loading: true})
            );

            Apis.instance()
                .db_api()
                .exec("get_liquidity_pools_by_share_asset", [
                    [shareAsset],
                    false
                ])
                .then((liquidityPools: any) => {
                    const tmpAssetIds: any[] = [];
                    liquidityPools.forEach((pool: any) => {
                        if (pool === null) return;
                        if (tmpAssetIds.indexOf(pool.asset_a) === -1) {
                            tmpAssetIds.push(pool.asset_a);
                        }
                        if (tmpAssetIds.indexOf(pool.asset_b) === -1) {
                            tmpAssetIds.push(pool.asset_b);
                        }
                        if (tmpAssetIds.indexOf(pool.share_asset) === -1) {
                            tmpAssetIds.push(pool.share_asset);
                        }
                    });
                    if (tmpAssetIds.length > 0) {
                        Apis.instance()
                            .db_api()
                            .exec("lookup_asset_symbols", [tmpAssetIds])
                            .then((assetObjects: any) => {
                                let tmpAssets = Immutable.Map();
                                if (assetObjects.length) {
                                    assetObjects.forEach((asset: any) => {
                                        tmpAssets = tmpAssets.set(
                                            asset.id,
                                            Immutable.fromJS(asset)
                                        );
                                    });
                                }
                                liquidityPools.map((pool: any) => {
                                    if (tmpAssets.has(pool.asset_a)) {
                                        pool.asset_a_obj = tmpAssets.get(
                                            pool.asset_a
                                        );
                                    } else {
                                        pool.asset_a_obj = undefined;
                                    }
                                    if (tmpAssets.has(pool.asset_b)) {
                                        pool.asset_b_obj = tmpAssets.get(
                                            pool.asset_b
                                        );
                                    } else {
                                        pool.asset_b_obj = undefined;
                                    }
                                    if (tmpAssets.has(pool.share_asset)) {
                                        pool.share_asset_obj = tmpAssets.get(
                                            pool.share_asset
                                        );
                                    } else {
                                        pool.share_asset_obj = undefined;
                                    }
                                    return pool;
                                });
                                delete inProgress[id];
                                reduxStore.dispatch(
                                    getLiquidityPoolsByShareAssetAction({
                                        loading: false,
                                        liquidityPools
                                    })
                                );
                            });
                    } else {
                        delete inProgress[id];
                        reduxStore.dispatch(
                            getLiquidityPoolsByShareAssetAction({
                                loading: false,
                                liquidityPools: []
                            })
                        );
                    }
                })
                .catch((error: any) => {
                    console.log(
                        "Error in PoolmartActions.getLiquidityPoolsByShareAsset: ",
                        error
                    );
                    delete inProgress[id];
                    reduxStore.dispatch(
                        getLiquidityPoolsByShareAssetAction({
                            loading: false,
                            liquidityPools: Immutable.Map(),
                            reset: true
                        })
                    );
                });
        }
    }

    resetLiquidityPools() {
        reduxStore.dispatch(resetLiquidityPoolsAction());
    }

    /**
     * getLiquidityPoolsAccount
     * @param {string} account_name (asset symbol or id)
     */
    getLiquidityPoolsAccount(account_name: any) {
        const id = `${account_name}_account`;
        if (!inProgress[id]) {
            inProgress[id] = true;
            reduxStore.dispatch(
                getLiquidityPoolsAccountAction({loading: true})
            );

            Apis.instance()
                .db_api()
                .exec("get_liquidity_pools_by_owner", [account_name])
                .then((liquidityPools: any) => {
                    const tmpAssetIds: any[] = [];
                    liquidityPools.forEach((pool: any) => {
                        if (pool === null) return;
                        if (tmpAssetIds.indexOf(pool.asset_a) === -1) {
                            tmpAssetIds.push(pool.asset_a);
                        }
                        if (tmpAssetIds.indexOf(pool.asset_b) === -1) {
                            tmpAssetIds.push(pool.asset_b);
                        }
                        if (tmpAssetIds.indexOf(pool.share_asset) === -1) {
                            tmpAssetIds.push(pool.share_asset);
                        }
                    });
                    Apis.instance()
                        .db_api()
                        .exec("lookup_asset_symbols", [tmpAssetIds])
                        .then((assetObjects: any) => {
                            let tmpAssets = Immutable.Map();
                            if (assetObjects.length) {
                                assetObjects.forEach((asset: any) => {
                                    tmpAssets = tmpAssets.set(
                                        asset.id,
                                        Immutable.fromJS(asset)
                                    );
                                });
                            }
                            liquidityPools.map((pool: any) => {
                                if (tmpAssets.has(pool.asset_a)) {
                                    pool.asset_a_obj = tmpAssets.get(
                                        pool.asset_a
                                    );
                                } else {
                                    pool.asset_a_obj = undefined;
                                }
                                if (tmpAssets.has(pool.asset_b)) {
                                    pool.asset_b_obj = tmpAssets.get(
                                        pool.asset_b
                                    );
                                } else {
                                    pool.asset_b_obj = undefined;
                                }
                                if (tmpAssets.has(pool.share_asset)) {
                                    pool.share_asset_obj = tmpAssets.get(
                                        pool.share_asset
                                    );
                                } else {
                                    pool.share_asset_obj = undefined;
                                }
                                return pool;
                            });
                            delete inProgress[id];
                            reduxStore.dispatch(
                                getLiquidityPoolsAccountAction({
                                    loading: false,
                                    liquidityPools
                                })
                            );
                        });
                })
                .catch((error: any) => {
                    // Original logs the "getLiquidityPoolsByShareAsset"
                    // label here too (a pre-existing copy-paste mistake,
                    // not "getLiquidityPoolsAccount") - preserved
                    // verbatim.
                    console.log(
                        "Error in PoolmartActions.getLiquidityPoolsByShareAsset: ",
                        error
                    );
                    delete inProgress[id];
                    reduxStore.dispatch(
                        getLiquidityPoolsAccountAction({
                            loading: false,
                            liquidityPools: Immutable.Map(),
                            reset: true
                        })
                    );
                });
        }
    }
}

export default new PoolmartActionsFacade();
