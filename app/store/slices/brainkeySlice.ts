// Redux Toolkit replacement for the Alt.js BrainkeyStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../reduxStore.ts`'s header
// for the overall migration approach, and `../../stores/BrainkeyStore.ts`
// for the full Tier 2 security notes). The original was a *factory*
// (`BrainkeyStoreFactory.getInstance(name)`) creating one real Alt store
// per `name` (only `"wmc"` is ever used by any real call site, but the
// general multi-instance shape is preserved rather than silently
// narrowed to a singleton) - this slice mirrors that with a
// dictionary-keyed state: `instances[name] = {brnkey, account_ids}`,
// exactly the original per-instance `this.state` shape.
//
// `derived_keys` (real private key objects, derived from the brainkey
// via `key.get_brainPrivateKey`) and `account_ids_by_key` are NOT part
// of this slice - same as the original, where they were plain instance
// fields on the Alt store class, never part of `this.state`/exposed via
// `getState()`. They stay as plain per-instance fields on
// `BrainkeyStore.ts`'s facade objects, never entering Redux state.
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import Immutable from "immutable";

export interface BrainkeyInstanceState {
    brnkey: string;
    account_ids: any;
}

export interface BrainkeyState {
    instances: {[name: string]: BrainkeyInstanceState};
}

const emptyInstanceState = (): BrainkeyInstanceState => ({
    brnkey: "",
    account_ids: Immutable.Set()
});

const initialState: BrainkeyState = {
    instances: {}
};

const brainkeySlice = createSlice({
    name: "brainkey",
    initialState,
    reducers: {
        clearInstanceCache(state, action: PayloadAction<{name: string}>) {
            state.instances[action.payload.name] = emptyInstanceState() as any;
        },
        setBrnkey(
            state,
            action: PayloadAction<{name: string; brnkey: string}>
        ) {
            const {name, brnkey} = action.payload;
            if (!state.instances[name]) {
                state.instances[name] = emptyInstanceState() as any;
            }
            state.instances[name].brnkey = brnkey;
        },
        setAccountIds(
            state,
            action: PayloadAction<{name: string; account_ids: any}>
        ) {
            const {name, account_ids} = action.payload;
            if (!state.instances[name]) {
                state.instances[name] = emptyInstanceState() as any;
            }
            state.instances[name].account_ids = account_ids;
        }
    }
});

export const {clearInstanceCache, setBrnkey, setAccountIds} = brainkeySlice.actions;

export const selectBrainkeyInstanceState = (
    state: {brainkey: BrainkeyState},
    name: string
): BrainkeyInstanceState => state.brainkey.instances[name] || emptyInstanceState();

export default brainkeySlice.reducer;
