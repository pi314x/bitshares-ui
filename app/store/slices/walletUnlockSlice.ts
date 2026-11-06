// Redux Toolkit replacement for the Alt.js WalletUnlockStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 batch 9 - see `../reduxStore.ts`'s
// header for the overall migration approach, and
// `../../stores/WalletUnlockStore.ts`'s header for the full
// cross-binding cluster explanation). Holds the exact same state shape
// the original Alt store's constructor set up
// (`{locked, passwordLogin, rememberMe}`, plus `resolve`/`reject`
// transiently added during an in-progress unlock flow - real function
// values, same as the original stored on `this.state` directly; this
// store's `serializableCheck`/`immutableCheck` are disabled in
// `../reduxStore.ts` precisely because several migrated stores,
// including this one, carry non-serializable values like this through
// state, matching their originals).
//
// Tier 2 (AGENTS.md): this is the actual wallet-lock-state store -
// `locked` gates the whole app's wallet access. No key material lives
// here directly (that's `WalletDb.ts`), but every transition is
// security-relevant.
import {createSlice, PayloadAction} from "@reduxjs/toolkit";

export interface WalletUnlockState {
    locked: boolean;
    passwordLogin: boolean;
    rememberMe: boolean;
    resolve?: (() => void) | null;
    reject?: ((reason?: any) => void) | null;
}

const initialState: WalletUnlockState = {
    locked: true,
    passwordLogin: true,
    rememberMe: true
};

const walletUnlockSlice = createSlice({
    name: "walletUnlock",
    initialState,
    reducers: {
        patchState(state, action: PayloadAction<Partial<WalletUnlockState>>) {
            Object.assign(state, action.payload);
        },
        seedWalletUnlockState(state, action: PayloadAction<WalletUnlockState>) {
            return action.payload;
        }
    }
});

export const {patchState, seedWalletUnlockState} = walletUnlockSlice.actions;

export const selectWalletUnlockState = (state: {
    walletUnlock: WalletUnlockState;
}) => state.walletUnlock;

export default walletUnlockSlice.reducer;
