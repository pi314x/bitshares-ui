// Redux-backed replacement for the Alt.js BalanceClaimActiveActions
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../store/reduxStore.ts`'s
// header for the overall migration approach). Preserves the exact
// method names and return values the original action creators had.
// Unlike `NotificationActions.ts`, these actions don't dispatch a slice
// action directly - the original `BalanceClaimActiveStore` bound each of
// them to real orchestration (async lookups, multiple `setState` calls),
// not a single pure state transition (see
// `../store/slices/balanceClaimActiveSlice.ts`'s header), so each method
// here calls straight into the migrated store facade's equivalent
// `onXxx` method, at the exact point Alt's dispatcher used to invoke it
// via `bindListeners`/`bindActions`.
import balanceClaimActiveStore from "../stores/BalanceClaimActiveStore";

class BalanceClaimActiveActionsFacade {
    setPubkeys(pubkeys: any) {
        balanceClaimActiveStore.onSetPubkeys(pubkeys);
        return pubkeys;
    }

    setSelectedBalanceClaims(selected_balances: any) {
        balanceClaimActiveStore.onSetSelectedBalanceClaims(selected_balances);
        return selected_balances;
    }

    claimAccountChange(claim_account_name: any) {
        balanceClaimActiveStore.onClaimAccountChange(claim_account_name);
        return claim_account_name;
    }
}

export default new BalanceClaimActiveActionsFacade();
