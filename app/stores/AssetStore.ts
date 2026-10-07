// Redux-backed replacement for the Alt.js AssetStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../store/reduxStore.ts`'s
// header for the overall migration approach). Preserves the exact
// Alt-store interface every call site already relies on - `getState()`
// (returning `{assets, asset_symbol_to_id, searchTerms, lookupResults,
// assetsLoading}`, the original's own instance fields - see
// `../store/slices/assetSlice.ts`'s header), `listen(callback)`,
// `unlisten(callback)`.
//
// The original `AssetStore` extended `BaseStore` but never called
// `_export(...)`, so there are no extra public methods to replicate
// beyond the standard three.
import {reduxStore} from "../store/reduxStore";
import {selectAsset} from "../store/slices/assetSlice";

class AssetStoreFacade {
    private unsubscribers = new Map<() => void, () => void>();

    getState() {
        return {...selectAsset(reduxStore.getState())};
    }

    listen(callback: () => void) {
        let previous = selectAsset(reduxStore.getState());
        const unsubscribe = reduxStore.subscribe(() => {
            const next = selectAsset(reduxStore.getState());
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

export default new AssetStoreFacade();
