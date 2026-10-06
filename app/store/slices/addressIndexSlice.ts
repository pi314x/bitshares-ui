// Redux Toolkit replacement for the Alt.js AddressIndex store
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../reduxStore.ts`'s header
// for the overall migration approach). Holds the exact same state shape
// the original Alt store did (`{addresses: Immutable.Map(), saving:
// false}`) - `addresses` maps a legacy address string to the public key
// string it was derived from (`bitsharesjs`'s `key.addresses(pubkey)`,
// one-way/public-key-only - no private key material ever flows through
// this store). `pubkeys` (a plain `Set`, dedup bookkeeping only) and the
// `loadAddyMapPromise`/`saveAddyMapTimeout` fields stay as plain instance
// fields on the facade singleton in `../../stores/AddressIndex.ts`,
// never entering Redux state, matching the original (neither was ever
// part of `this.state`/read via `getState()` by any call site).
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import Immutable from "immutable";

export interface AddressIndexState {
    addresses: any;
    saving: boolean;
}

const initialState: AddressIndexState = {
    addresses: Immutable.Map(),
    saving: false
};

const addressIndexSlice = createSlice({
    name: "addressIndex",
    initialState,
    reducers: {
        setSaving(state, action: PayloadAction<boolean>) {
            state.saving = action.payload;
        },
        setAddresses(state, action: PayloadAction<any>) {
            // `addresses` is a real Immutable.js Map, not a plain
            // object/array Immer can draft - always replaced wholesale
            // (matching the original's own `this.setState({addresses})`
            // calls, every one of which passed a whole new/mutated-then
            // -reassigned Immutable Map), never deeply mutated here.
            state.addresses = action.payload;
        }
    }
});

export const {setSaving, setAddresses} = addressIndexSlice.actions;

export const selectAddressIndexState = (state: {addressIndex: AddressIndexState}) =>
    state.addressIndex;

export default addressIndexSlice.reducer;
