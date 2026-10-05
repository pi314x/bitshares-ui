// Redux-backed replacement for the Alt.js BlockchainStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../store/reduxStore.ts`'s
// header for the overall migration approach). Preserves the exact
// Alt-store interface every call site already relies on -
// `getState()` (returning `{blocks, latestBlocks, latestTransactions,
// rpc_connection_status, no_ws_connection, blockHeaders, maxBlocks}`,
// the original's own instance fields - see `../store/slices/
// blockchainSlice.ts`'s header for why the state shape is exactly that),
// `listen(callback)`, `unlisten(callback)` - so every
// `useAltStore(BlockchainStore)` hook caller (`BlocksContainer.tsx`,
// `SyncError.tsx`, `BlockDate.tsx`, `BlockTime.tsx`, `BlockContainer.tsx`,
// `InitError.tsx`) keeps working completely unchanged.
import {reduxStore} from "../store/reduxStore";
import {selectBlockchain} from "../store/slices/blockchainSlice";

class BlockchainStoreFacade {
    private unsubscribers = new Map<() => void, () => void>();

    getState() {
        return {...selectBlockchain(reduxStore.getState())};
    }

    listen(callback: () => void) {
        let previous = selectBlockchain(reduxStore.getState());
        const unsubscribe = reduxStore.subscribe(() => {
            const next = selectBlockchain(reduxStore.getState());
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

export default new BlockchainStoreFacade();
