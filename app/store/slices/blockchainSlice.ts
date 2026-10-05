// Redux Toolkit replacement for the Alt.js `BlockchainStore`/
// `BlockchainActions` pair (docs/UI_MIGRATION_PLAN.md, Phase 9 - see
// `../reduxStore.ts`'s header for the overall migration approach).
//
// `BlockchainStore` never called `this.setState(...)` - it mutated
// instance fields directly (`this.blocks = ...`, `this.maxBlocks = 30`,
// etc.), which under Alt's `createStoreFromClass` means the store
// instance itself *is* the state object (see `alt/src/store/index.js`:
// `store.state !== undefined ? store.state : store`). This slice's state
// shape is therefore just those instance fields, verbatim.
//
// One deliberate adjustment from a literal line-for-line port:
// `onGetHeader`'s original body mutated `this.blockHeaders` (a plain
// `Map`, not an Immutable one) in place via `.set(...)`, never
// reassigning `this.blockHeaders` itself. Alt's `emitChange()` fires on
// every successful dispatch regardless of whether anything changed by
// reference, so listeners (e.g. `BlockDate.tsx` via `useAltStore`) always
// re-rendered after a header arrived. Immer (which backs this slice)
// does NOT auto-draft plain `Map`/`Set` instances, so mutating the
// existing Map in place would leave the whole slice's reference
// unchanged and `BlockchainStore.ts`'s `listen()` (which, like
// `NotificationStore.ts`, fires only when the slice reference changes)
// would never notify - a real regression, not a cosmetic one. Reassigning
// to a new `Map` (same contents, new identity) restores the original
// "always notifies on a real update" behavior while keeping `.get()`
// lookups byte-identical.
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import Immutable from "immutable";
import {ChainStore} from "bitsharesjs";

export interface BlockchainState {
    // Typed `any`, not `Immutable.Map<...>`/`Immutable.List<...>`:
    // Immer's `Draft<T>` type structurally matches Immutable.js's
    // `List`/`Map` against the built-in `ReadonlyMap` interface (both
    // expose `get`/`has`/`size`/iteration) and remaps them to a plain
    // `Map`, which silently drops `List`-only methods like `unshift`/
    // `pop` from the type. `any` sidesteps that mismatch - runtime
    // behavior (real Immutable.js values, used as normal) is unaffected.
    blocks: any;
    latestBlocks: any;
    latestTransactions: any;
    rpc_connection_status: string | null;
    no_ws_connection: boolean;
    blockHeaders: Map<any, any>;
    maxBlocks: number;
}

const initialState: BlockchainState = {
    blocks: Immutable.Map(),
    latestBlocks: Immutable.List(),
    latestTransactions: Immutable.List(),
    rpc_connection_status: null,
    no_ws_connection: false,
    blockHeaders: new Map(),
    maxBlocks: 30
};

const blockchainSlice = createSlice({
    name: "blockchain",
    initialState,
    reducers: {
        onGetHeader(state, action: PayloadAction<{header: any; height: any}>) {
            const {header, height} = action.payload;
            if (header && height) {
                if (!/Z$/.test(header.timestamp)) {
                    header.timestamp += "Z";
                }
                header.timestamp = new Date(header.timestamp);
                // See file header: reassigned (not mutated in place) so
                // the slice reference changes and listeners fire.
                state.blockHeaders = new Map(state.blockHeaders).set(
                    height,
                    header
                );
            }
            // else: no-op, matching the original's `return false` (Alt
            // skips emitChange - here, simply not mutating anything means
            // `listen()` won't fire, same observable effect).
        },
        onGetBlock(state, action: PayloadAction<any>) {
            const block = action.payload;
            if (!state.blocks.get(block.id)) {
                if (!/Z$/.test(block.timestamp)) {
                    block.timestamp += "Z";
                }
                block.timestamp = new Date(block.timestamp);
                state.blocks = state.blocks.set(block.id, block);
            }
        },
        onGetLatest(state, action: PayloadAction<{block: any; maxBlock: any}>) {
            const {block, maxBlock} = action.payload;
            if (typeof block.timestamp === "string") {
                if (!/Z$/.test(block.timestamp)) {
                    block.timestamp += "Z";
                }
            }
            block.timestamp = new Date(block.timestamp);
            state.blocks = state.blocks.set(block.id, block);
            if (block.id > maxBlock - state.maxBlocks) {
                state.latestBlocks = state.latestBlocks.unshift(block);
                if (state.latestBlocks.size > state.maxBlocks) {
                    state.latestBlocks = state.latestBlocks.pop();
                }

                if (block.transactions.length > 0) {
                    block.transactions.forEach((trx: any) => {
                        trx.block_num = block.id;
                        state.latestTransactions = state.latestTransactions.unshift(
                            trx
                        );
                    });
                }

                if (state.latestTransactions.size > state.maxBlocks) {
                    state.latestTransactions = state.latestTransactions.pop();
                }
            }
        },
        onUpdateRpcConnectionStatus(state, action: PayloadAction<any>) {
            const status = action.payload;
            const prev_status = state.rpc_connection_status;
            if (status === "reconnect") ChainStore.resetCache(false);
            else state.rpc_connection_status = status;
            if (prev_status === null && status === "error")
                state.no_ws_connection = true;
            if (state.no_ws_connection && status === "open")
                state.no_ws_connection = false;
            if (status === "closed") state.no_ws_connection = true;
        }
    }
});

export const {
    onGetHeader,
    onGetBlock,
    onGetLatest,
    onUpdateRpcConnectionStatus
} = blockchainSlice.actions;

export const selectBlockchain = (state: {blockchain: BlockchainState}) =>
    state.blockchain;

export default blockchainSlice.reducer;
