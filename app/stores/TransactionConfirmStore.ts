// Redux-backed replacement for the Alt.js TransactionConfirmStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../store/reduxStore.ts`'s
// header for the overall migration approach). Preserves the exact
// Alt-store interface every call site already relies on -
// `getState()`, `listen(callback)`, `unlisten(callback)`, plus the
// original's plain (non-`onXxx`) `reset()` method, exported via Alt's
// `exportPublicMethods({reset: this.reset.bind(this)})` - so every
// `useAltStore(TransactionConfirmStore)` hook caller and every remaining
// direct `.listen()`/`.unlisten()`/`.reset()` caller (e.g. `SendModal.tsx`,
// `XbtsFiat.tsx`, `WalletRegistrationForm.tsx`, `CreateAccount.tsx`,
// `CreateAccountPassword.tsx`, `InvoicePay.tsx`) keeps working completely
// unchanged.
import {reduxStore} from "../store/reduxStore";
import {
    resetState,
    selectTransactionConfirm
} from "../store/slices/transactionConfirmSlice";

class TransactionConfirmStoreFacade {
    private unsubscribers = new Map<() => void, () => void>();

    getState() {
        return selectTransactionConfirm(reduxStore.getState());
    }

    listen(callback: () => void) {
        let previous = selectTransactionConfirm(reduxStore.getState());
        const unsubscribe = reduxStore.subscribe(() => {
            const next = selectTransactionConfirm(reduxStore.getState());
            if (next !== previous) {
                previous = next;
                callback();
            }
        });
        this.unsubscribers.set(callback, unsubscribe);
    }

    unlisten(callback: () => void) {
        const unsubscribe = this.unsubscribers.get(callback);
        if (unsubscribe) {
            unsubscribe();
            this.unsubscribers.delete(callback);
        }
    }

    // Original: `reset() { this.state = this.getInitialState(); }`,
    // exported directly off the store (not via an action/dispatch).
    reset() {
        reduxStore.dispatch(resetState());
    }
}

export default new TransactionConfirmStoreFacade();
