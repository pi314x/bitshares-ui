// Redux Toolkit replacement for the Alt.js PrivateKeyStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 batch 8 - see `../reduxStore.ts`'s
// header for the overall migration approach, and
// `../../stores/PrivateKeyStore.ts` for the full Tier 2 security notes).
// Holds the exact same state shape the original Alt store's
// `_getInitialState()` did. `keys` holds `PrivateKeyTcomb` records
// (`{id, pubkey, label, import_account_names, brainkey_sequence,
// encrypted_key}`) - the `encrypted_key` field is an AES-encrypted
// blob, never a plaintext private key; decrypting it requires
// `WalletDb.decryptTcomb_PrivateKey` and the unlocked wallet password.
// This is the exact same exposure the original Alt store's `getState()`
// already had - not a new one introduced by this migration.
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import Immutable from "immutable";

export interface PrivateKeyState {
    keys: any;
    privateKeyStorage_error: boolean;
    pending_operation_count: number;
    privateKeyStorage_error_add_key: any;
    privateKeyStorage_error_loading: any;
}

const initialState: PrivateKeyState = {
    keys: Immutable.Map(),
    privateKeyStorage_error: false,
    pending_operation_count: 0,
    privateKeyStorage_error_add_key: null,
    privateKeyStorage_error_loading: null
};

const privateKeySlice = createSlice({
    name: "privateKey",
    initialState,
    reducers: {
        setKeys(state, action: PayloadAction<any>) {
            state.keys = action.payload;
        },
        resetPrivateKeyState() {
            return initialState;
        },
        setPendingOperationCount(state, action: PayloadAction<number>) {
            state.pending_operation_count = action.payload;
        },
        setPrivateKeyStorageError(
            state,
            action: PayloadAction<{property: string; error: any}>
        ) {
            state.privateKeyStorage_error = true;
            (state as any)[
                "privateKeyStorage_error_" + action.payload.property
            ] = action.payload.error;
        }
    }
});

export const {
    setKeys,
    resetPrivateKeyState,
    setPendingOperationCount,
    setPrivateKeyStorageError
} = privateKeySlice.actions;

export const selectPrivateKeyState = (state: {privateKey: PrivateKeyState}) =>
    state.privateKey;

export default privateKeySlice.reducer;
