// bitsharesjs's ChainStore.getAsset(symbol) sends a `lookup_asset_symbols`
// request on EVERY call until the answer arrives, and each answer notifies all
// subscribers, which re-render and call getAsset again. With a market list of a
// few hundred symbols that is a request storm (the same symbol was asked ~33
// times in 20 s) and React's "Maximum update depth exceeded" on the trade page,
// which then never leaves "Loading ...".
//
// ChainStore already has a marker for "lookup in flight" (`assets_by_symbol`
// value `true` makes getAsset return undefined without asking again) but never
// sets it. This sets it after the first request. The answer replaces it (with
// the id, or `null` for an unknown symbol, or deletes it on a request error),
// and a timeout clears it if no answer ever names the symbol.
const PENDING_MS = 15000;

export function dedupeAssetLookups(chainStore, pendingMs = PENDING_MS) {
    if (!chainStore || chainStore.__assetLookupsDeduped) return chainStore;
    const original = chainStore.getAsset;
    const isObjectId = id => /^\d+\.\d+\.\d+$/.test(String(id));

    chainStore.getAsset = function(idOrSymbol) {
        if (
            !idOrSymbol ||
            isObjectId(idOrSymbol) ||
            this.assets_by_symbol.has(idOrSymbol)
        ) {
            return original.call(this, idOrSymbol);
        }
        // First ask: the original sends the request and returns undefined.
        const result = original.call(this, idOrSymbol);
        if (!this.assets_by_symbol.has(idOrSymbol)) {
            this.assets_by_symbol.set(idOrSymbol, true);
            setTimeout(() => {
                if (this.assets_by_symbol.get(idOrSymbol) === true) {
                    this.assets_by_symbol.delete(idOrSymbol);
                }
            }, pendingMs);
        }
        return result;
    };
    chainStore.__assetLookupsDeduped = true;
    return chainStore;
}

export default dedupeAssetLookups;
