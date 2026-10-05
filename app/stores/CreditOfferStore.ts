// Redux-backed replacement for the Alt.js CreditOfferStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../store/reduxStore.ts`'s
// header for the overall migration approach). Preserves the exact
// Alt-store interface every call site already relies on -
// `getState()`, `listen(callback)`, `unlisten(callback)` - so every
// `useAltStore(CreditOfferStore)` call site keeps working completely
// unchanged. The state-mutating half of the original store's handlers
// now lives in `../store/slices/creditOfferSlice.ts`; the other half
// (pure side-effect chaining to further `CreditOfferActions` calls) now
// lives in `../actions/CreditOfferActions.ts` - see those files' headers.
import {reduxStore} from "../store/reduxStore";
import {selectCreditOffer, CreditOfferState} from "../store/slices/creditOfferSlice";

class CreditOfferStoreFacade {
    private unsubscribers = new Map<() => void, () => void>();

    getState(): CreditOfferState {
        return selectCreditOffer(reduxStore.getState());
    }

    listen(callback: () => void) {
        let previous = selectCreditOffer(reduxStore.getState());
        const unsubscribe = reduxStore.subscribe(() => {
            const next = selectCreditOffer(reduxStore.getState());
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

export default new CreditOfferStoreFacade();
