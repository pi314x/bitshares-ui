// Redux-backed replacement for the Alt.js ImportKeysStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../store/reduxStore.ts`'s
// header for the overall migration approach). Tier 2 (AGENTS.md): no key
// material here (a single boolean import-in-progress flag, same as the
// original's own header comment said), but migrated with the same care
// as every Tier 2 store since it's a direct dependency of
// `WalletDb.ts`/`BackupStore.ts`.
//
// Preserves the exact interface every call site relies on -
// `getState().importing`, `listen(callback)`, `unlisten(callback)`,
// AND the directly-callable `importing(value)` method (the original's
// `_export("importing")` - not Alt-dispatched via a separate Actions
// file, called straight on the store singleton) - so
// `Wallet/ImportKeys.tsx`'s `useAltStore(ImportKeysStore)` and its
// `ImportKeysStore.importing(true/false)` calls keep working completely
// unchanged.
import {reduxStore} from "../store/reduxStore";
import {setImporting, selectImportKeysState} from "../store/slices/importKeysSlice";

class ImportKeysStoreFacade {
    private unsubscribers = new Map<() => void, () => void>();

    getState() {
        return selectImportKeysState(reduxStore.getState());
    }

    listen(callback: () => void) {
        let previous = selectImportKeysState(reduxStore.getState());
        const unsubscribe = reduxStore.subscribe(() => {
            const next = selectImportKeysState(reduxStore.getState());
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

    importing(importing: boolean) {
        reduxStore.dispatch(setImporting(importing));
    }
}

export default new ImportKeysStoreFacade();
