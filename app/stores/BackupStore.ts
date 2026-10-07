// Redux-backed replacement for the Alt.js BackupStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../store/reduxStore.ts`'s
// header for the overall migration approach). Tier 2 (AGENTS.md): holds
// a decrypted wallet backup object in memory during the
// login/decrypt-backup flow.
//
// Preserves the exact interface every call site relies on -
// `getState()`, `listen(callback)`, `unlisten(callback)`, and the
// directly-callable `setWalletObjct(wallet_object)` method (the
// original's `_export("setWalletObjct")` - not Alt-dispatched, called
// straight on the store singleton by `Wallet/Backup.tsx`) - so every
// `useAltStore(BackupStore)` caller (`Login/WalletLogin.tsx`,
// `Login/DecryptBackup.tsx`, `Wallet/Backup.tsx`,
// `Wallet/WalletUnlockModal.tsx`) and `BackupStore.setWalletObjct(...)`
// keep working completely unchanged.
import {reduxStore} from "../store/reduxStore";
import {setWalletObjct, selectBackupState} from "../store/slices/backupSlice";

class BackupStoreFacade {
    private unsubscribers = new Map<() => void, () => void>();

    getState() {
        return selectBackupState(reduxStore.getState());
    }

    listen(callback: () => void) {
        let previous = selectBackupState(reduxStore.getState());
        const unsubscribe = reduxStore.subscribe(() => {
            const next = selectBackupState(reduxStore.getState());
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

    setWalletObjct(wallet_object: any) {
        reduxStore.dispatch(setWalletObjct(wallet_object));
    }
}

export default new BackupStoreFacade();
