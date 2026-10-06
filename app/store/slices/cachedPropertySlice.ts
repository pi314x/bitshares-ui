// Redux Toolkit replacement for the Alt.js CachedPropertyStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../reduxStore.ts`'s header
// for the overall migration approach). Holds the exact same state shape
// the original Alt store's `_getInitialState()` did
// (`{props: Immutable.Map()}`) - a generic IndexedDB-backed key/value
// cache (e.g. `backup_recommended`), no key material.
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import Immutable from "immutable";

export interface CachedPropertyState {
    props: any;
}

const initialState: CachedPropertyState = {
    props: Immutable.Map()
};

const cachedPropertySlice = createSlice({
    name: "cachedProperty",
    initialState,
    reducers: {
        setProps(state, action: PayloadAction<any>) {
            state.props = action.payload;
        },
        resetCachedProperty() {
            return initialState;
        }
    }
});

export const {setProps, resetCachedProperty} = cachedPropertySlice.actions;

export const selectCachedPropertyState = (state: {
    cachedProperty: CachedPropertyState;
}) => state.cachedProperty;

export default cachedPropertySlice.reducer;
