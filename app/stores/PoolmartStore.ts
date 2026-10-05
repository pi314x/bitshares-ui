// Redux-backed replacement for the Alt.js PoolmartStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../store/reduxStore.ts`'s
// header for the overall migration approach). Preserves the exact
// Alt-store interface every call site already relies on - `getState()`,
// `listen(callback)`, `unlisten(callback)` - so every
// `useAltStore(PoolmartStore)` call site keeps working completely
// unchanged. The original extended `BaseStore` but never called
// `_export(...)`, so there are no extra public methods to replicate
// beyond the default Alt store interface.
import {reduxStore} from "../store/reduxStore";
import {selectPoolmart, PoolmartState} from "../store/slices/poolmartSlice";

class PoolmartStoreFacade {
    private unsubscribers = new Map<() => void, () => void>();

    getState(): PoolmartState {
        return selectPoolmart(reduxStore.getState());
    }

    listen(callback: () => void) {
        let previous = selectPoolmart(reduxStore.getState());
        const unsubscribe = reduxStore.subscribe(() => {
            const next = selectPoolmart(reduxStore.getState());
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
}

export default new PoolmartStoreFacade();
