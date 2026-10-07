// Redux Toolkit replacement for the Alt.js `CreditOfferStore`/
// `CreditOfferActions` pair (docs/UI_MIGRATION_PLAN.md, Phase 9 - see
// `../reduxStore.ts`'s header for the overall migration approach). Holds
// the exact same state shape the original Alt store did
// (`allList`/`listByOwner`/`dealsByBorrower`/`dealsByOfferOwner`).
//
// Of `CreditOfferStore.js`'s 10 `onXxx` handlers, only 5 ever mutated
// store state - `onDelete` and the 4 `onGetXxx` list/pagination
// handlers - and those 5 are reproduced below verbatim. The other 5
// (`onCreate`/`onDisabled`/`onUpdate`/`onAccept`/`onRepay`) never
// touched `this.state` at all; their only effect was to trigger a
// follow-up `CreditOfferActions` call (e.g. `onCreate` re-fetching the
// owner's offer list). Since reducers must stay pure, that chaining -
// and the equivalent pagination chaining the 4 `onGetXxx` handlers did
// when `result.end === false` - is reproduced in
// `actions/CreditOfferActions.ts` instead, immediately after the
// matching dispatch, exactly where `CreditOfferStore.js`'s dispatch
// listener used to run it synchronously.
import {createSlice, PayloadAction} from "@reduxjs/toolkit";

export interface CreditOfferState {
    allList: any[];
    listByOwner: any[];
    dealsByBorrower: any[];
    dealsByOfferOwner: any[];
}

const initialState: CreditOfferState = {
    allList: [],
    listByOwner: [],
    dealsByBorrower: [],
    dealsByOfferOwner: []
};

const creditOfferSlice = createSlice({
    name: "creditOffer",
    initialState,
    reducers: {
        // Mirrors CreditOfferStore.js's onDelete (the only one of
        // create/disabled/update/delete/accept/repay that mutated state).
        deleteOffer(state, action: PayloadAction<any>) {
            const {transaction} = action.payload || {};
            if (transaction && transaction.length > 0) {
                const dId = transaction[0].trx.operations[0][1].offer_id;
                if (dId) {
                    const index = state.listByOwner.findIndex(
                        (v: any) => v.id == dId
                    );
                    if (index > -1) state.listByOwner.splice(index, 1);
                }
            }
        },

        // Mirrors CreditOfferStore.js's onGetCreditOffersByOwner (state
        // mutation only - the pagination re-fetch when `result.end ===
        // false` lives in CreditOfferActions.ts).
        getCreditOffersByOwner(state, action: PayloadAction<any>) {
            const result = action.payload;
            if (result.list.length > 0) {
                switch (result.flag) {
                    case "first":
                        state.listByOwner = result.list;
                        break;
                    case "update": {
                        const index = state.listByOwner.findIndex(
                            (v: any) => v.id == result.list[0].id
                        );
                        if (index > -1) {
                            state.listByOwner.splice(
                                index,
                                1,
                                JSON.parse(JSON.stringify(result.list[0]))
                            );
                        }
                        break;
                    }
                    case "create":
                    default:
                        state.listByOwner = state.listByOwner.concat(
                            result.list
                        );
                        break;
                }
            }
        },

        // Mirrors CreditOfferStore.js's onGetCreditDealsByBorrower.
        getCreditDealsByBorrower(state, action: PayloadAction<any>) {
            const result = action.payload;
            if (result.list.length > 0) {
                switch (result.flag) {
                    case "first":
                        state.dealsByBorrower = result.list;
                        break;
                    case "update": {
                        const index = state.dealsByBorrower.findIndex(
                            (v: any) => v.id == result.list[0].id
                        );
                        if (index > -1) {
                            state.dealsByBorrower.splice(
                                index,
                                1,
                                JSON.parse(JSON.stringify(result.list[0]))
                            );
                        }
                        break;
                    }
                    default:
                        state.dealsByBorrower = state.dealsByBorrower.concat(
                            result.list
                        );
                        break;
                }
            } else if (result.flag === "update") {
                const index = state.dealsByBorrower.findIndex(
                    (v: any) => v.id == result.pars.start_id
                );
                if (index > -1) {
                    state.dealsByBorrower.splice(index, 1);
                }
            }
        },

        // Mirrors CreditOfferStore.js's onGetCreditDealsByOfferOwner.
        getCreditDealsByOfferOwner(state, action: PayloadAction<any>) {
            const result = action.payload;
            if (result.list.length > 0) {
                switch (result.flag) {
                    case "first":
                        state.dealsByOfferOwner = result.list;
                        break;
                    case "update": {
                        const index = state.dealsByOfferOwner.findIndex(
                            (v: any) => v.id == result.list[0].id
                        );
                        if (index > -1) {
                            state.dealsByOfferOwner.splice(
                                index,
                                1,
                                JSON.parse(JSON.stringify(result.list[0]))
                            );
                        }
                        break;
                    }
                    default:
                        state.dealsByOfferOwner = state.dealsByOfferOwner.concat(
                            result.list
                        );
                        break;
                }
            }
        },

        // Mirrors CreditOfferStore.js's onGetAll.
        getAll(state, action: PayloadAction<any>) {
            const result = action.payload;
            if (result.list.length > 0) {
                switch (result.flag) {
                    case "first":
                        state.allList = result.list.filter(
                            (v: any) => v.enabled
                        );
                        break;
                    case "update": {
                        const index = state.allList.findIndex(
                            (v: any) => v.id == result.list[0].id
                        );
                        if (index > -1) {
                            if (result.list[0].enabled) {
                                state.allList.splice(
                                    index,
                                    1,
                                    result.list[0]
                                );
                            } else {
                                state.allList.splice(index, 1);
                            }
                        }
                        break;
                    }
                    default:
                        state.allList = state.allList.concat(
                            result.list.filter((v: any) => v.enabled)
                        );
                        break;
                }
            }
        }
    }
});

export const {
    deleteOffer,
    getCreditOffersByOwner,
    getCreditDealsByBorrower,
    getCreditDealsByOfferOwner,
    getAll
} = creditOfferSlice.actions;

export const selectCreditOffer = (state: {creditOffer: CreditOfferState}) =>
    state.creditOffer;

export default creditOfferSlice.reducer;
