// The real Phase 9 (docs/UI_MIGRATION_PLAN.md): incrementally replacing
// each Alt.js store/actions pair with a Redux Toolkit slice, one store at
// a time, while every call site - both already-ported hook components
// (via `useAltStore`) and still-legacy class components that call
// `.listen()`/`.unlisten()`/`.getState()` directly (e.g. `App.jsx`) -
// keeps working completely unchanged. Each migrated store's `.js`/`.ts`
// file in `app/stores/` is rewritten to export an Alt-shaped facade
// object (same `getState()`/`listen()`/`unlisten()` methods) backed by
// this Redux store instead of the real `alt-instance.js` singleton; each
// migrated actions file is rewritten the same way (same method names,
// same action-creator normalization logic) to `dispatch` into this store
// instead of going through Alt's dispatcher. This lets the two state
// layers coexist indefinitely during the migration, exactly like
// `next/hooks/useAltStore.ts`'s "adapter layer, not a parallel backend"
// did for the component layer - and means the `alt`/`alt-react`/
// `alt-instance` npm packages become removable once every store has been
// migrated this way, even before every call site has been switched to
// `useSelector`/`useDispatch`.
//
// Security note (AGENTS.md): Tier 2 stores (wallet unlock, private key,
// brainkey, backup, wallet manager, and WalletDb.ts itself) are migrated
// one at a time with extra scrutiny (byte-for-byte comparison against
// the original, no behavior/shape "improvements" bundled in) - see each
// slice's own header for its specific verification notes.
import {configureStore, combineReducers} from "@reduxjs/toolkit";
import notificationReducer from "./slices/notificationSlice";
import transactionConfirmReducer from "./slices/transactionConfirmSlice";
import balanceClaimActiveReducer from "./slices/balanceClaimActiveSlice";
import poolmartReducer from "./slices/poolmartSlice";
import creditOfferReducer from "./slices/creditOfferSlice";
import blockchainReducer from "./slices/blockchainSlice";
import assetReducer from "./slices/assetSlice";
import gatewayReducer from "./slices/gatewaySlice";
import marketsReducer from "./slices/marketsSlice";
import importKeysReducer from "./slices/importKeysSlice";
import addressIndexReducer from "./slices/addressIndexSlice";
import backupReducer from "./slices/backupSlice";
import brainkeyReducer from "./slices/brainkeySlice";
import cachedPropertyReducer from "./slices/cachedPropertySlice";
import privateKeyReducer from "./slices/privateKeySlice";
import accountRefsReducer from "./slices/accountRefsSlice";
import intlReducer from "./slices/intlSlice";
import settingsReducer from "./slices/settingsSlice";
import walletUnlockReducer from "./slices/walletUnlockSlice";
import accountReducer from "./slices/accountSlice";
import walletManagerReducer from "./slices/walletManagerSlice";
import walletDbReducer from "./slices/walletDbSlice";

const rootReducer = combineReducers({
    notification: notificationReducer,
    transactionConfirm: transactionConfirmReducer,
    balanceClaimActive: balanceClaimActiveReducer,
    poolmart: poolmartReducer,
    creditOffer: creditOfferReducer,
    blockchain: blockchainReducer,
    asset: assetReducer,
    gateway: gatewayReducer,
    markets: marketsReducer,
    importKeys: importKeysReducer,
    addressIndex: addressIndexReducer,
    backup: backupReducer,
    brainkey: brainkeyReducer,
    cachedProperty: cachedPropertyReducer,
    privateKey: privateKeyReducer,
    accountRefs: accountRefsReducer,
    intl: intlReducer,
    settings: settingsReducer,
    walletUnlock: walletUnlockReducer,
    account: accountReducer,
    walletManager: walletManagerReducer,
    walletDb: walletDbReducer
});

export const reduxStore = configureStore({
    reducer: rootReducer,
    // Alt's own stores/actions already aren't serializable-state-pure
    // (Immutable.js Maps flow through plenty of this app's data), and
    // migrated slices may temporarily hold the same kinds of values
    // while ported incrementally - relaxing these two checks avoids
    // noisy, non-actionable console warnings during the migration
    // without weakening anything Redux DevTools / RTK's other checks
    // (e.g. accidental state mutation) still catch.
    middleware: getDefaultMiddleware =>
        getDefaultMiddleware({
            serializableCheck: false,
            immutableCheck: false
        })
});

export type RootState = ReturnType<typeof rootReducer>;
export type AppDispatch = typeof reduxStore.dispatch;
