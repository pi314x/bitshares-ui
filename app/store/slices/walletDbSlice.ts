// Redux Toolkit replacement for the Alt.js WalletDb store's change
// notification plumbing (docs/UI_MIGRATION_PLAN.md, Phase 9 batch 10 -
// see `../reduxStore.ts`'s header for the overall migration approach).
//
// Unlike every other migrated store, `wallet`/`saving_keys` themselves
// are NOT held here. `stores/WalletDb.ts` keeps a real, directly mutable
// `state` object (exactly like the original Alt store did - see that
// file's header for why) as the single source of truth, since
// `app/__tests__/wallets/walletDbCrypto-test.js` (the characterization-
// test safety net for this security-sensitive file) relies on setting
// `WalletDb.state.wallet = {...}` as a plain property write and expects
// every other method to see that write immediately. This slice exists
// only so `WalletDb.ts`'s `setState()` can emit a change notification
// that `listen()`/`unlisten()` (and therefore `useAltStore`, e.g.
// `WalletUnlockModal.tsx`'s `useAltStore(WalletDb)`) can react to -
// a version counter is bumped on every `setState()` call, mirroring the
// original's own `this.state.wallet = wallet; this.setState({wallet})`
// double-write pattern (direct mutation for immediate same-tick reads,
// `setState` purely to trigger Alt's emit-to-listeners).
import {createSlice} from "@reduxjs/toolkit";

export interface WalletDbVersionState {
    version: number;
}

const initialState: WalletDbVersionState = {
    version: 0
};

const walletDbSlice = createSlice({
    name: "walletDb",
    initialState,
    reducers: {
        bumpWalletDbVersion(state) {
            state.version += 1;
        }
    }
});

export const {bumpWalletDbVersion} = walletDbSlice.actions;

export const selectWalletDbVersion = (state: {
    walletDb: WalletDbVersionState;
}) => state.walletDb.version;

export default walletDbSlice.reducer;
