// Redux Toolkit replacement for the Alt.js BackupStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../reduxStore.ts`'s header
// for the overall migration approach). Tier 2 (AGENTS.md) - this store
// holds a decrypted wallet backup object (`wallet_object`) in memory
// during the login/decrypt-backup flow. Holds the exact same state shape
// the original Alt store's `_getInitialState()` did, so
// `stores/BackupStore.ts`'s facade can reproduce the original's
// `getState()` output verbatim.
//
// Note: the actual AES encrypt/decrypt crypto
// (`createWalletBackup`/`decryptWalletBackup` in `../../actions/
// BackupActions.ts`) is NOT part of this store/slice at all - those are
// plain exported functions, never wrapped by Alt's `createActions`/
// bound to this store's `bindListeners`, so they are completely out of
// scope for this migration (nothing here changes their behavior, call
// signature, or module location).
import {createSlice, PayloadAction} from "@reduxjs/toolkit";

export interface BackupState {
    name: string | null;
    contents: any;
    sha1: string | null;
    size: number | null;
    last_modified: string | null;
    public_key: any;
    wallet_object: any;
}

const initialState: BackupState = {
    name: null,
    contents: null,
    sha1: null,
    size: null,
    last_modified: null,
    public_key: null,
    wallet_object: null
};

const backupSlice = createSlice({
    name: "backup",
    initialState,
    reducers: {
        setWalletObjct(state, action: PayloadAction<any>) {
            state.wallet_object = action.payload;
        },
        resetBackup() {
            return initialState;
        },
        setIncomingFile(
            state,
            action: PayloadAction<{
                name: string;
                contents: any;
                sha1: string;
                size: number;
                last_modified: string;
                public_key: any;
            }>
        ) {
            const {name, contents, sha1, size, last_modified, public_key} =
                action.payload;
            state.name = name;
            state.contents = contents;
            state.sha1 = sha1;
            state.size = size;
            state.last_modified = last_modified;
            state.public_key = public_key;
        },
        setIncomingBuffer(
            state,
            action: PayloadAction<{
                name: string;
                contents: any;
                sha1: string;
                size: number;
                public_key: any;
            }>
        ) {
            const {name, contents, sha1, size, public_key} = action.payload;
            state.name = name;
            state.contents = contents;
            state.sha1 = sha1;
            state.size = size;
            state.public_key = public_key;
        }
    }
});

export const {
    setWalletObjct,
    resetBackup,
    setIncomingFile,
    setIncomingBuffer
} = backupSlice.actions;

export const selectBackupState = (state: {backup: BackupState}) => state.backup;

export default backupSlice.reducer;
