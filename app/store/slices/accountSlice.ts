// Redux Toolkit replacement for the Alt.js AccountStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 batch 9 - see `../reduxStore.ts`'s
// header for the overall migration approach, and
// `../../stores/AccountStore.ts`'s header for the full cross-binding
// cluster explanation). Holds the exact same state shape the original
// Alt store's constructor/`_getInitialState()` did. No key material -
// account names, Immutable collections of account names/ids - but reads
// `PrivateKeyStore.hasKey(...)`/`AddressIndex.getState().addresses` to
// compute authority thresholds.
import {createSlice, PayloadAction} from "@reduxjs/toolkit";

export interface AccountState {
    neverShowBrowsingModeNotice: boolean;
    update: boolean;
    subbed: boolean;
    accountsLoaded: boolean;
    refsLoaded: boolean;
    currentAccount: string | null;
    referralAccount: string;
    passwordAccount: string | null;
    myActiveAccounts: any;
    myHiddenAccounts: any;
    searchAccounts: any;
    searchTerm: string;
    wallet_name: string;
    starredAccounts: any;
    accountContacts: any;
    linkedAccounts: any;
    passwordLogin: boolean;
}

const accountSlice = createSlice({
    name: "account",
    // Real initial state is set once, synchronously, by
    // `AccountStore.ts`'s facade constructor via `seedAccountState`
    // below (mirrors the original Alt store's own constructor reading
    // localStorage before anything could call `getState()`).
    initialState: {} as AccountState,
    reducers: {
        patchState(state, action: PayloadAction<Partial<AccountState>>) {
            Object.assign(state, action.payload);
        },
        seedAccountState(state, action: PayloadAction<AccountState>) {
            return action.payload;
        }
    }
});

export const {patchState, seedAccountState} = accountSlice.actions;

export const selectAccountState = (state: {account: AccountState}) => state.account;

export default accountSlice.reducer;
