// Redux Toolkit replacement for the Alt.js ImportKeysStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../reduxStore.ts`'s header
// for the overall migration approach). Holds the exact same state shape
// the original Alt store did (`{importing: false}`), so
// `stores/ImportKeysStore.ts`'s facade can reproduce the original's
// `getState()` output verbatim.
import {createSlice, PayloadAction} from "@reduxjs/toolkit";

export interface ImportKeysState {
    importing: boolean;
}

const initialState: ImportKeysState = {
    importing: false
};

const importKeysSlice = createSlice({
    name: "importKeys",
    initialState,
    reducers: {
        setImporting(state, action: PayloadAction<boolean>) {
            state.importing = action.payload;
        }
    }
});

export const {setImporting} = importKeysSlice.actions;

export const selectImportKeysState = (state: {importKeys: ImportKeysState}) =>
    state.importKeys;

export default importKeysSlice.reducer;
