// Redux Toolkit replacement for the Alt.js WalletManagerStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 batch 9 - see `../reduxStore.ts`'s
// header for the overall migration approach). Holds the exact same
// state shape the original Alt store's `_getInitialState()` did.
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import Immutable from "immutable";

export interface WalletManagerState {
    new_wallet: any;
    current_wallet: any;
    wallet_names: any;
}

const initialState: WalletManagerState = {
    new_wallet: undefined,
    current_wallet: undefined,
    wallet_names: Immutable.Set()
};

const walletManagerSlice = createSlice({
    name: "walletManager",
    initialState,
    reducers: {
        patchState(state, action: PayloadAction<Partial<WalletManagerState>>) {
            Object.assign(state, action.payload);
        }
    }
});

export const {patchState} = walletManagerSlice.actions;

export const selectWalletManagerState = (state: {
    walletManager: WalletManagerState;
}) => state.walletManager;

export default walletManagerSlice.reducer;
