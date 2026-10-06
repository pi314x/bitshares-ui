// Redux-backed replacement for the Alt.js CachedPropertyActions
// (docs/UI_MIGRATION_PLAN.md, Phase 9 batch 8 - see
// `../store/reduxStore.ts`'s header for the overall migration approach).
// Preserves the exact method names and action-creator return values,
// calling `CachedPropertyStore.ts`'s `onSet`/`onGet` directly at the
// point Alt's dispatcher used to trigger them (the store's own `onSet`/
// `onGet` are not pure reducers - they do an async IndexedDB
// read/write - so this mirrors the `CreditOfferStore`/`BalanceClaimActiveStore`
// precedent of inlining that orchestration into the actions facade
// rather than forcing it into a slice reducer).
import cachedPropertyStore from "../stores/CachedPropertyStore";

class CachedPropertyActionsFacade {
    set(name: string, value: any) {
        cachedPropertyStore.onSet({name, value});
        return {name, value};
    }

    get(name: string) {
        cachedPropertyStore.onGet({name});
        return {name};
    }

    reset() {
        return true;
    }
}

export default new CachedPropertyActionsFacade();
