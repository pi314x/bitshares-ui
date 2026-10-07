// Redux Toolkit replacement for the Alt.js `BalanceClaimActiveStore`/
// `BalanceClaimActiveActions` pair (docs/UI_MIGRATION_PLAN.md, Phase 9 -
// see `../reduxStore.ts`'s header for the overall migration approach).
// Holds the exact same state shape the original store did
// (`BalanceClaimActiveStore._getInitialState()`/`getInitialViewState()`),
// so `stores/BalanceClaimActiveStore.ts`'s facade can reproduce the
// original's `getState()` output verbatim.
//
// The original store's instance fields `pubkeys`/`addresses`/
// `no_balance_address` are NOT part of `this.state` (Alt's `getState()`
// never returned them) and are NOT modeled here either - they stay as
// plain instance fields on the migrated store facade, exactly like they
// were plain instance fields on the Alt store instance.
//
// Most of the original store's `onXxx` handlers do real orchestration
// (async DB/chain lookups, calling other instance methods that
// themselves call `setState` more than once) rather than a single pure
// state transition, so - unlike `notificationSlice.ts`/
// `transactionConfirmSlice.ts`, where one action maps to one reducer
// case - this slice only exposes the two primitives the original store's
// many `this.setState(...)` call sites actually needed (a shallow merge,
// matching Alt's own `setState` semantics exactly, and a full reset); the
// orchestration itself lives in `stores/BalanceClaimActiveStore.ts`'s
// facade, same as it lived in the original store class.
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import Immutable from "immutable";

export interface BalanceClaimActiveState {
    balances: any; // Immutable.List<any> | undefined
    checked: any; // Immutable.Map
    selected_balances: any; // Immutable Set/Seq
    claim_account_name: any;
    loading: boolean;
    address_to_pubkey: Map<string, any>;
}

// getInitialViewState(): reset in-between balance claims (NOT including
// `address_to_pubkey`, exactly like the original).
export function createInitialViewState(): Omit<
    BalanceClaimActiveState,
    "address_to_pubkey"
> {
    return {
        balances: undefined,
        checked: Immutable.Map(),
        selected_balances: Immutable.Seq(),
        claim_account_name: undefined,
        loading: true
    };
}

// _getInitialState(): reset for each wallet.
export function createInitialState(): BalanceClaimActiveState {
    return {
        ...createInitialViewState(),
        address_to_pubkey: new Map()
    };
}

const balanceClaimActiveSlice = createSlice({
    name: "balanceClaimActive",
    initialState: createInitialState(),
    reducers: {
        // Matches every `this.setState(partial)` call site in the
        // original store (shallow merge, same as Alt's own `setState`).
        patchState(
            state,
            action: PayloadAction<Partial<BalanceClaimActiveState>>
        ) {
            Object.assign(state, action.payload);
        },

        // Matches `this.setState(this._getInitialState())` (the
        // original `reset()` method).
        resetState() {
            return createInitialState();
        }
    }
});

export const {patchState, resetState} = balanceClaimActiveSlice.actions;

export const selectBalanceClaimActive = (state: {
    balanceClaimActive: BalanceClaimActiveState;
}) => state.balanceClaimActive;

export default balanceClaimActiveSlice.reducer;
