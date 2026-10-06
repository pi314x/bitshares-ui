// Redux-backed replacement for the Alt.js WalletUnlockActions
// (docs/UI_MIGRATION_PLAN.md, Phase 9 batch 9 - see
// `../stores/IntlStore.ts`'s header for the cluster explanation and
// `../stores/WalletUnlockStore.ts`'s header for this store's own notes).
// Only ever bound by `WalletUnlockStore` (confirmed via grep, no
// cross-store binding here) - every method calls that store's matching
// `onXxx` handler directly.
//
// Preserved verbatim, not fixed: `unlock()`/`lock()`'s
// `.then(was_unlocked => { if (was_unlocked) change(); })` chain is dead
// in practice - `WalletUnlockStore.onUnlock`/`onLock` always call
// `resolve()` with no argument (confirmed by reading both), so
// `was_unlocked` is always `undefined`/falsy. The real "notify listeners
// after unlock" trigger happens via `Wallet/WalletUnlockModal.tsx`
// calling `WalletUnlockActions.change()` directly, a completely separate
// path - grep-confirmed.
import walletUnlockStore from "../stores/WalletUnlockStore";

class WalletUnlockActionsFacade {
    /** If you get resolved then the wallet is or was just unlocked.  If you get
        rejected then the wallet is still locked.

        @return nothing .. Just test for resolve() or reject()
    */
    unlock(): Promise<void> {
        return new Promise<any>((resolve, reject) => {
            (walletUnlockStore as any).onUnlock({resolve, reject});
        })
            .then(was_unlocked => {
                if (was_unlocked) this.change();
            })
            .catch(params => {
                throw params;
            });
    }

    lock(): Promise<void> {
        return new Promise<any>(resolve => {
            (walletUnlockStore as any).onLock({resolve});
        }).then(was_unlocked => {
            if (was_unlocked) this.change();
        });
    }

    cancel() {
        (walletUnlockStore as any).onCancel();
        return true;
    }

    change() {
        (walletUnlockStore as any).onChange();
        return true;
    }

    checkLock() {
        (walletUnlockStore as any).onCheckLock();
        return true;
    }
}

const walletUnlockActionsFacade = new WalletUnlockActionsFacade();

// Real Alt actions get a `.defer(...args)` method for free
// (`alt/src/actions/index.js`), used by real call sites
// (`Account/CreateAccountPassword.tsx`,
// `Registration/AccountRegistrationConfirm.tsx`'s
// `WalletUnlockActions.checkLock.defer()`). Replicated for the one
// method actually called this way (grep-confirmed) - both call sites
// cast `as any`, so this wasn't caught by `tsc`, only by reading the
// real call sites directly.
(walletUnlockActionsFacade.checkLock as any).defer = () =>
    setTimeout(() => walletUnlockActionsFacade.checkLock());

export default walletUnlockActionsFacade;
