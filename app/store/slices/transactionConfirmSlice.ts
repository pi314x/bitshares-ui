// Redux Toolkit replacement for the Alt.js `TransactionConfirmStore`/
// `TransactionConfirmActions` pair (docs/UI_MIGRATION_PLAN.md, Phase 9 -
// see `../reduxStore.ts`'s header for the overall migration approach).
// Holds the exact same state shape the original Alt store did
// (`TransactionConfirmStore.getInitialState()`), so
// `stores/TransactionConfirmStore.ts`'s facade can reproduce the
// original's `getState()` output verbatim.
//
// The original store used Alt's convention-based `this.bindActions(...)`,
// which auto-binds every `onXxx` store method to the identically-named
// action `xxx`. Each reducer case below corresponds 1:1 to one of those
// `onXxx` handlers, and `actions/TransactionConfirmActions.ts` dispatches
// the matching case at the point where Alt's dispatcher used to invoke
// the handler directly.
import {createSlice, PayloadAction} from "@reduxjs/toolkit";

// Like the original Alt store, this state is a loose bag that a couple of
// call sites (`onBroadcast`'s dispatched payloads) extend with keys not
// present in the initial shape (`error_code`, `error_data`) - the index
// signature mirrors that, same permissive-typing tone as
// `notificationSlice.ts`. `transaction`/`resolve`/`reject` are also
// stored verbatim (including functions, for `resolve`/`reject`) exactly
// like the Alt version did - RTK/Immer only ever replaces these fields
// wholesale here, never deep-mutates them, so storing non-serializable/
// non-plain values is harmless (same rationale as `notificationSlice.ts`).
export interface TransactionConfirmState {
    transaction: any;
    error: any;
    broadcasting: boolean;
    broadcast: boolean;
    included: boolean;
    trx_id: any;
    trx_block_num: any;
    closed: boolean;
    broadcasted_transaction: any;
    propose: boolean;
    fee_paying_account: any;
    resolve?: ((...args: any[]) => void) | null;
    reject?: ((...args: any[]) => void) | null;
    [key: string]: any;
}

function createInitialState(): TransactionConfirmState {
    return {
        transaction: null,
        error: null,
        broadcasting: false,
        broadcast: false,
        included: false,
        trx_id: null,
        trx_block_num: null,
        closed: true,
        broadcasted_transaction: null,
        propose: false,
        fee_paying_account: null // proposal fee_paying_account
    };
}

const transactionConfirmSlice = createSlice({
    name: "transactionConfirm",
    initialState: createInitialState(),
    reducers: {
        // onConfirm({transaction, resolve, reject})
        confirm(
            _state,
            action: PayloadAction<{
                transaction: any;
                resolve?: (...args: any[]) => void;
                reject?: (...args: any[]) => void;
            }>
        ) {
            const {transaction, resolve, reject} = action.payload;
            return {
                ...createInitialState(),
                transaction,
                closed: false,
                broadcasted_transaction: null,
                resolve,
                reject
            };
        },

        // onClose()
        close(state) {
            state.closed = true;
        },

        // onBroadcast(payload) - the `broadcast()` action creator is a
        // thunk that `dispatch()`s several different partial payloads
        // over time (immediate, on-send, success, failure); every one of
        // them goes through this same handler in the original store.
        broadcastPatch(state, action: PayloadAction<Record<string, any>>) {
            Object.assign(state, action.payload);
            if (action.payload.broadcasted_transaction) {
                state.broadcasted_transaction = state.transaction;
            }
        },

        // onWasBroadcast(res) - `res` is ignored, same as the original.
        wasBroadcast(state) {
            state.broadcasting = false;
            state.broadcast = true;
        },

        // onWasIncluded(res)
        wasIncluded(state, action: PayloadAction<any>) {
            const res = action.payload;
            state.error = null;
            state.broadcasting = false;
            state.broadcast = true;
            state.included = true;
            state.trx_id = res[0].id;
            state.trx_block_num = res[0].block_num;
            state.broadcasted_transaction = state.transaction;
        },

        // onError({error})
        setError(state, action: PayloadAction<{error: any}>) {
            state.broadcast = false;
            state.broadcasting = false;
            state.error = action.payload.error;
        },

        // onTogglePropose()
        togglePropose(state) {
            state.propose = !state.propose;
        },

        // onProposeFeePayingAccount(fee_paying_account)
        proposeFeePayingAccount(state, action: PayloadAction<any>) {
            state.fee_paying_account = action.payload;
        },

        // Plain `reset()` method (not an on<Action> handler - exported
        // directly off the store via Alt's `exportPublicMethods`).
        resetState() {
            return createInitialState();
        }
    }
});

export const {
    confirm,
    close,
    broadcastPatch,
    wasBroadcast,
    wasIncluded,
    setError,
    togglePropose,
    proposeFeePayingAccount,
    resetState
} = transactionConfirmSlice.actions;

export const selectTransactionConfirm = (state: {
    transactionConfirm: TransactionConfirmState;
}) => state.transactionConfirm;

export default transactionConfirmSlice.reducer;
