// Redux Toolkit replacement for the Alt.js SettingsStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 batch 9 - see `../reduxStore.ts`'s
// header for the overall migration approach, and
// `../../stores/SettingsStore.ts`'s header for the full cross-binding
// cluster explanation). Like `IntlStore`, the original `SettingsStore`
// never called `this.setState(...)`/had an explicit `this.state` - it
// mutated plain instance fields directly, relying on Alt's default
// `getState()` (a snapshot of the instance's own enumerable properties)
// and its auto-emit-after-bound-handler-completion behavior. This slice
// holds every field the original constructor/`init()` ever set as an
// instance property - not just the ones a grep of current call sites
// found read - matching Alt's "getState returns everything" behavior
// exactly rather than risking a silently-missed read site on a store
// this central (60+ call sites).
//
// `patchState` is a generic shallow-merge reducer (matching Alt's own
// "mutate this one field, leave the rest alone" pattern) used by most
// handlers; a few (`addWS`/`removeWS`/`hideWS`/`showWS`) mutate
// `defaults.apiServer` in place via Immer directly, since `defaults` is
// a plain mutable object in the original too (not Immutable.js).
import {createSlice, PayloadAction} from "@reduxjs/toolkit";

export interface SettingsState {
    initDone: boolean;
    settings: any;
    defaultSettings: any;
    defaults: any;
    viewSettings: any;
    marketDirections: any;
    hiddenAssets: any;
    hiddenMarkets: any;
    apiLatencies: any;
    mainnet_faucet: any;
    testnet_faucet: any;
    exchange: any;
    priceAlert: any;
    hiddenNewsHeadline: any;
    chartLayouts: any;
    starredKey: string | null;
    marketsKey: string | null;
    basesKey: string | null;
    preferredBases: any;
    chainMarkets: any;
    defaultMarkets: any;
    starredMarkets: any;
    userMarkets: any;
}

// Populated by `SettingsStore.ts`'s facade constructor, which computes
// these the exact same way the original constructor did (reading
// localStorage, branding.js, apiConfig.js) - see that file.
export function buildInitialSettingsState(seed: Partial<SettingsState>): SettingsState {
    return {
        initDone: false,
        settings: seed.settings,
        defaultSettings: seed.defaultSettings,
        defaults: seed.defaults,
        viewSettings: seed.viewSettings,
        marketDirections: seed.marketDirections,
        hiddenAssets: seed.hiddenAssets,
        hiddenMarkets: seed.hiddenMarkets,
        apiLatencies: seed.apiLatencies,
        mainnet_faucet: seed.mainnet_faucet,
        testnet_faucet: seed.testnet_faucet,
        exchange: seed.exchange,
        priceAlert: seed.priceAlert,
        hiddenNewsHeadline: seed.hiddenNewsHeadline,
        chartLayouts: seed.chartLayouts,
        starredKey: null,
        marketsKey: null,
        basesKey: null,
        preferredBases: null,
        chainMarkets: null,
        defaultMarkets: null,
        starredMarkets: null,
        userMarkets: null
    };
}

const settingsSlice = createSlice({
    name: "settings",
    // Real initial state is set once, synchronously, by
    // `SettingsStore.ts`'s facade constructor via `seedSettingsState`
    // below (mirrors the original Alt store's own constructor running
    // its localStorage/branding reads before anything could call
    // `getState()`).
    initialState: buildInitialSettingsState({}),
    reducers: {
        patchState(state, action: PayloadAction<Partial<SettingsState>>) {
            Object.assign(state, action.payload);
        },
        seedSettingsState(state, action: PayloadAction<SettingsState>) {
            return action.payload;
        },
        addWS(state, action: PayloadAction<any>) {
            state.defaults.apiServer.push(action.payload);
        },
        removeWS(state, action: PayloadAction<number>) {
            state.defaults.apiServer.splice(action.payload, 1);
        },
        hideWS(state, action: PayloadAction<string>) {
            const node = state.defaults.apiServer.find(
                (n: any) => n.url === action.payload
            );
            if (node) node.hidden = true;
        },
        showWS(state, action: PayloadAction<string>) {
            const node = state.defaults.apiServer.find(
                (n: any) => n.url === action.payload
            );
            if (node) node.hidden = false;
        }
    }
});

export const {
    patchState,
    seedSettingsState,
    addWS,
    removeWS,
    hideWS,
    showWS
} = settingsSlice.actions;

export const selectSettingsState = (state: {settings: SettingsState}) =>
    state.settings;

export default settingsSlice.reducer;
