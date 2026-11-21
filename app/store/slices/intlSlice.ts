// Redux Toolkit replacement for the Alt.js IntlStore (docs/UI_MIGRATION_PLAN.md,
// Phase 9 batch 9 - see `../reduxStore.ts`'s header for the overall
// migration approach). The original `IntlStore` never called
// `this.setState(...)`/had an explicit `this.state` - it mutated plain
// instance fields (`this.currentLocale`, `this.locales`,
// `this.localesObject`) directly, relying on Alt's default `getState()`
// (returns a snapshot of the instance's own enumerable properties when
// no explicit `this.state` exists) and its auto-emit-after-bound
// -handler-completion behavior. This slice holds `currentLocale`/
// `locales` (the only 2 fields any real call site reads via
// `getState()` - `AppInit.jsx`'s `IntlStore.getState().currentLocale`,
// grep-confirmed the only read); `localesObject` stays a plain instance
// field on `../../stores/IntlStore.ts`'s facade (never read via
// `getState()` by anything, same as the original).
import {createSlice, PayloadAction} from "@reduxjs/toolkit";

export interface IntlState {
    currentLocale: string;
    locales: string[];
}

const initialState: IntlState = {
    currentLocale: "en",
    locales: ["en"]
};

const intlSlice = createSlice({
    name: "intl",
    initialState,
    reducers: {
        setCurrentLocale(state, action: PayloadAction<string>) {
            state.currentLocale = action.payload;
        },
        addLocale(state, action: PayloadAction<string>) {
            if (state.locales.indexOf(action.payload) === -1) {
                state.locales.push(action.payload);
            }
        }
    }
});

export const {setCurrentLocale, addLocale} = intlSlice.actions;

export const selectIntlState = (state: {intl: IntlState}) => state.intl;

export default intlSlice.reducer;
