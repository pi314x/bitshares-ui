// Redux Toolkit replacement for the Alt.js AccountRefsStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 batch 8 - see `../reduxStore.ts`'s
// header for the overall migration approach). Holds the exact same state
// shape the original Alt store's `_getInitialState()` did
// (`{account_refs: Immutable.Map([chainId, Immutable.Set()])}`) - maps
// of on-chain account ids referencing this wallet's public keys, no key
// material.
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import Immutable from "immutable";

export interface AccountRefsState {
    account_refs: any;
}

const initialState: AccountRefsState = {
    account_refs: Immutable.Map()
};

const accountRefsSlice = createSlice({
    name: "accountRefs",
    initialState,
    reducers: {
        setAccountRefs(state, action: PayloadAction<any>) {
            state.account_refs = action.payload;
        }
    }
});

export const {setAccountRefs} = accountRefsSlice.actions;

export const selectAccountRefsState = (state: {accountRefs: AccountRefsState}) =>
    state.accountRefs;

export default accountRefsSlice.reducer;
