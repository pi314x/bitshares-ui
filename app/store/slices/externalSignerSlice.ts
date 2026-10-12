// State of the optional extension-based signing method (Phase 6,
// docs/UI_MIGRATION_PLAN.md §7.11). Holds no secrets: whether the user prefers
// the extension, whether it was found, and which account it is connected as.
// The preference alone is persisted (`actions/ExternalSignerActions.ts`); the
// connection is re-established silently from the extension itself.
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {ExternalSignerAccount} from "../../wallet-extension/types";

export type SigningPreference = "local" | "extension";
export type ExternalSignerStatus =
    | "unknown" // not looked yet
    | "unavailable" // no extension in this browser
    | "disconnected"
    | "connecting"
    | "connected";

export interface ExternalSignerState {
    preference: SigningPreference;
    status: ExternalSignerStatus;
    account: ExternalSignerAccount | null;
    /** Last known lock state of the extension (from its events); null = unknown. */
    locked: boolean | null;
    /** Last problem worth showing next to the connect button. */
    error: string | null;
}

export const initialExternalSignerState: ExternalSignerState = {
    preference: "local",
    status: "unknown",
    account: null,
    locked: null,
    error: null
};

const externalSignerSlice = createSlice({
    name: "externalSigner",
    initialState: initialExternalSignerState,
    reducers: {
        patchExternalSigner(
            state,
            action: PayloadAction<Partial<ExternalSignerState>>
        ) {
            Object.assign(state, action.payload);
        }
    }
});

export const {patchExternalSigner} = externalSignerSlice.actions;

export const selectExternalSigner = (state: {
    externalSigner: ExternalSignerState;
}) => state.externalSigner;

/** True when transactions are to be signed by the extension. */
export const selectExternalSigningActive = (state: {
    externalSigner: ExternalSignerState;
}) =>
    state.externalSigner.preference === "extension" &&
    state.externalSigner.status === "connected" &&
    !!state.externalSigner.account;

export default externalSignerSlice.reducer;
