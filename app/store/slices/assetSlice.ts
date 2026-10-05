// Redux Toolkit replacement for the Alt.js `AssetStore`/`AssetActions`
// pair (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../reduxStore.ts`'s
// header for the overall migration approach).
//
// `AssetStore` extended `BaseStore` but never called `_export(...)`, and
// (like `BlockchainStore`) never called `this.setState(...)` - it
// mutated instance fields directly, so the state shape is just those
// fields verbatim: `assets`, `asset_symbol_to_id`, `searchTerms`,
// `lookupResults`, `assetsLoading`. Only 3 of `AssetActions`' many
// methods are bound to this store (`getAssetList`, `lookupAsset`,
// `getAssetsByIssuer` - see `onGetAssetList`/`onLookupAsset`/
// `onGetAssetsByIssuer` below); the rest (`publishFeed`, `createAsset`,
// `updateAsset`, etc.) are transaction-signing action creators with no
// bound store handler at all - see `app/actions/AssetActions.ts`'s own
// header for how those are ported.
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import Immutable from "immutable";

export interface AssetState {
    // `any`, not `Immutable.Map<...>` - see `blockchainSlice.ts`'s
    // header comment on why Immer's `Draft<T>` mapping makes that unsafe.
    assets: any;
    asset_symbol_to_id: {[symbol: string]: any};
    searchTerms: {[searchID: string]: any};
    lookupResults: any[];
    assetsLoading: boolean;
}

const initialState: AssetState = {
    assets: Immutable.Map(),
    asset_symbol_to_id: {},
    searchTerms: {},
    lookupResults: [],
    assetsLoading: false
};

const assetSlice = createSlice({
    name: "asset",
    initialState,
    reducers: {
        onGetAssetList(state, action: PayloadAction<any>) {
            const payload = action.payload;
            if (!payload) {
                return; // matches original's `return false` (no-op)
            }
            state.assetsLoading = payload.loading;

            if (payload.assets) {
                payload.assets.forEach((asset: any) => {
                    for (let i = 0; i < payload.dynamic.length; i++) {
                        if (
                            payload.dynamic[i].id ===
                            asset.dynamic_asset_data_id
                        ) {
                            asset.dynamic = payload.dynamic[i];
                            break;
                        }
                    }

                    if (asset.bitasset_data_id) {
                        asset.market_asset = true;

                        for (let i = 0; i < payload.bitasset_data.length; i++) {
                            if (
                                payload.bitasset_data[i].id ===
                                asset.bitasset_data_id
                            ) {
                                asset.bitasset_data = payload.bitasset_data[i];
                                break;
                            }
                        }
                    } else {
                        asset.market_asset = false;
                    }

                    state.assets = state.assets.set(asset.id, asset);

                    state.asset_symbol_to_id[asset.symbol] = asset.id;
                });
            }
        },
        onGetAssetsByIssuer(state, action: PayloadAction<any>) {
            const payload = action.payload;
            if (!payload) {
                return; // matches original's `return false` (no-op)
            }
            state.assetsLoading = payload.loading;

            if (payload.assets) {
                payload.assets.forEach((asset: any) => {
                    for (let i = 0; i < payload.dynamic.length; i++) {
                        if (
                            payload.dynamic[i].id ===
                            asset.dynamic_asset_data_id
                        ) {
                            asset.dynamic = payload.dynamic[i];
                            break;
                        }
                    }

                    state.assets = state.assets.set(asset.id, asset);

                    state.asset_symbol_to_id[asset.symbol] = asset.id;
                });
            }
        },
        onLookupAsset(
            state,
            action: PayloadAction<{searchID: any; symbol: any; assets: any}>
        ) {
            const payload = action.payload;
            state.searchTerms[payload.searchID] = payload.symbol;
            state.lookupResults = payload.assets;
        }
    }
});

export const {
    onGetAssetList,
    onGetAssetsByIssuer,
    onLookupAsset
} = assetSlice.actions;

export const selectAsset = (state: {asset: AssetState}) => state.asset;

export default assetSlice.reducer;
