// Redux Toolkit replacement for the Alt.js `PoolmartStore`/
// `PoolmartActions` pair (docs/UI_MIGRATION_PLAN.md, Phase 9 - see
// `../reduxStore.ts`'s header for the overall migration approach). Holds
// the exact same state shape the original Alt store did
// (`liquidityPools`/`liquidityPoolsLoading`/`assets`/`lastPoolId`), so
// `stores/PoolmartStore.ts`'s facade can reproduce the original's
// `getState()` output verbatim. Each reducer below mirrors one of the
// original store's `onXxx` handlers verbatim, including its quirks (e.g.
// the early `return` that skips the trailing `reset` check once an empty
// pool batch is seen, and the one console.log in
// `onGetLiquidityPoolsAccount`) - preserved exactly, not "fixed".
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import Immutable from "immutable";

// `liquidityPools`/`assets` are typed `any` rather than
// `Immutable.Map<...>`: Immutable.Map structurally matches enough of the
// built-in ES `Map` interface that Immer's `Draft<T>` conditional type
// (see notificationSlice.ts's header for the general rationale behind
// treating Immutable.js values as opaque, Immer-wrapped-but-not-drafted
// leaves) misidentifies it as a native-Map-to-draft, which TS then
// rejects as a structural mismatch. `any` sidesteps that without
// changing runtime behavior - every reducer below still only ever
// replaces these fields wholesale, never deeply mutates them.
export interface PoolmartState {
    liquidityPools: any;
    liquidityPoolsLoading: boolean;
    assets: any;
    lastPoolId: any;
}

const initialState: PoolmartState = {
    liquidityPools: Immutable.Map(),
    liquidityPoolsLoading: false,
    assets: Immutable.Map(),
    lastPoolId: null
};

const poolmartSlice = createSlice({
    name: "poolmart",
    initialState,
    reducers: {
        // Mirrors PoolmartStore.js's onGetLiquidityPools.
        getLiquidityPools(state, action: PayloadAction<any>) {
            const payload = action.payload;
            if (!payload) {
                return;
            }
            state.liquidityPoolsLoading = payload.loading;

            if (payload.liquidityPools) {
                let tmp = Immutable.Map<any, any>();
                payload.liquidityPools.forEach((pool: any) => {
                    tmp = tmp.set(pool.id, pool);
                });
                if (tmp.size === 0) return;
                state.lastPoolId = tmp.last().id;
                state.liquidityPools = state.liquidityPools.merge(tmp);
            }

            if (payload.reset === true) {
                state.lastPoolId = null;
            }
        },

        // Mirrors PoolmartStore.js's onGetLiquidityPoolsByShareAsset.
        getLiquidityPoolsByShareAsset(state, action: PayloadAction<any>) {
            const payload = action.payload;
            if (!payload) {
                return;
            }
            state.liquidityPoolsLoading = payload.loading;

            if (payload.liquidityPools) {
                let tmp = Immutable.Map<any, any>();
                payload.liquidityPools.forEach((pool: any) => {
                    tmp = tmp.set(pool.id, pool);
                });
                if (tmp.size === 0) return;
                state.lastPoolId = tmp.last().id;
                state.liquidityPools = state.liquidityPools.merge(tmp);
            }

            if (payload.reset === true) {
                state.lastPoolId = null;
            }
        },

        // Mirrors PoolmartStore.js's onGetLiquidityPoolsAccount.
        getLiquidityPoolsAccount(state, action: PayloadAction<any>) {
            console.log("onGetLiquidityPoolsAccount");
            const payload = action.payload;
            if (!payload) {
                return;
            }
            state.liquidityPoolsLoading = payload.loading;

            if (payload.liquidityPools) {
                let tmp = Immutable.Map<any, any>();
                payload.liquidityPools.forEach((pool: any) => {
                    tmp = tmp.set(pool.id, pool);
                });
                if (tmp.size === 0) return;
                state.lastPoolId = tmp.last().id;
                // Original replaces wholesale here, unlike the merge()
                // the other two handlers use - preserved as-is.
                state.liquidityPools = tmp;
            }

            if (payload.reset === true) {
                state.lastPoolId = null;
            }
        },

        // Mirrors PoolmartStore.js's onResetLiquidityPools.
        resetLiquidityPools(state) {
            state.liquidityPools = Immutable.Map();
        }
    }
});

export const {
    getLiquidityPools,
    getLiquidityPoolsByShareAsset,
    getLiquidityPoolsAccount,
    resetLiquidityPools
} = poolmartSlice.actions;

export const selectPoolmart = (state: {poolmart: PoolmartState}) =>
    state.poolmart;

export default poolmartSlice.reducer;
