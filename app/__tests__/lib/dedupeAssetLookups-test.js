import {dedupeAssetLookups} from "../../lib/chain/dedupeAssetLookups";

// Mirrors the part of bitsharesjs's ChainStore.getAsset that matters: an
// uncached symbol sends a lookup on every call and returns undefined.
function fakeStore() {
    const store = {
        assets_by_symbol: new Map(),
        lookups: [],
        getAsset(idOrSymbol) {
            if (!idOrSymbol) return null;
            if (/^\d+\.\d+\.\d+$/.test(idOrSymbol)) return {id: idOrSymbol};
            const known = this.assets_by_symbol.get(idOrSymbol);
            if (/^\d+\.\d+\.\d+$/.test(known)) return {id: known};
            if (known === null) return null;
            if (known === true) return undefined;
            this.lookups.push(idOrSymbol);
            return undefined;
        }
    };
    return store;
}

describe("dedupeAssetLookups", () => {
    it("sends one lookup per symbol however often it is asked", () => {
        const store = dedupeAssetLookups(fakeStore());
        for (let i = 0; i < 50; i++)
            expect(store.getAsset("USD")).toBeUndefined();
        expect(store.lookups).toEqual(["USD"]);
    });

    it("returns the asset once the answer is recorded", () => {
        const store = dedupeAssetLookups(fakeStore());
        store.getAsset("USD");
        store.assets_by_symbol.set("USD", "1.3.121"); // what _updateObject does
        expect(store.getAsset("USD")).toEqual({id: "1.3.121"});
        expect(store.lookups).toEqual(["USD"]);
    });

    it("keeps the null answer for an unknown symbol", () => {
        const store = dedupeAssetLookups(fakeStore());
        store.getAsset("NOPE");
        store.assets_by_symbol.set("NOPE", null);
        expect(store.getAsset("NOPE")).toBeNull();
    });

    it("asks again after a failed request deleted the marker", () => {
        const store = dedupeAssetLookups(fakeStore());
        store.getAsset("USD");
        store.assets_by_symbol.delete("USD"); // the request's catch handler
        store.getAsset("USD");
        expect(store.lookups).toEqual(["USD", "USD"]);
    });

    it("clears a marker no answer ever replaced", () => {
        jest.useFakeTimers();
        const store = dedupeAssetLookups(fakeStore(), 1000);
        store.getAsset("USD");
        jest.advanceTimersByTime(1001);
        store.getAsset("USD");
        expect(store.lookups).toEqual(["USD", "USD"]);
        jest.useRealTimers();
    });

    it("leaves ids and empty input alone and installs only once", () => {
        const store = fakeStore();
        dedupeAssetLookups(store);
        const patched = store.getAsset;
        dedupeAssetLookups(store);
        expect(store.getAsset).toBe(patched);
        expect(store.getAsset("1.3.0")).toEqual({id: "1.3.0"});
        expect(store.getAsset("")).toBeNull();
        expect(store.assets_by_symbol.size).toBe(0);
    });
});
