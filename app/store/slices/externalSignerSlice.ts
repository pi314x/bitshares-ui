// State of the optional extension-based signing method (Phase 6,
// docs/UI_MIGRATION_PLAN.md §7.11). Holds no secrets: whether the extension was
// found and which account it is connected as. Nothing is persisted; the link is
// re-established silently from the extension itself. There is no "signing
// method" preference: the account chosen in the account menu signs - the
// extension's account through the extension, any other through the local wallet.
import {createSlice, PayloadAction} from "@reduxjs/toolkit";
import {ExternalSignerAccount} from "../../wallet-extension/types";

export type ExternalSignerStatus =
    | "unknown" // not looked yet
    | "unavailable" // no extension in this browser
    | "disconnected"
    | "connecting"
    | "connected";

export interface ExternalSignerState {
    status: ExternalSignerStatus;
    account: ExternalSignerAccount | null;
    /** Last known lock state of the extension (from its events); null = unknown. */
    locked: boolean | null;
    /** Last problem worth showing next to the connect button. */
    error: string | null;
    /**
     * Set when the user themselves connected (the connect button, as opposed to
     * a silent restore on start-up): the extension's account is then made the
     * current one. Cleared when the extension reports another account.
     */
    makeCurrent: boolean;
}

export const initialExternalSignerState: ExternalSignerState = {
    status: "unknown",
    account: null,
    locked: null,
    error: null,
    makeCurrent: false
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

/**
 * True while the extension is connected as an account. Whether a transaction is
 * then signed by it depends on the account the transaction acts for (see
 * `ExternalSignerActions.shouldSign`), not on a setting.
 */
export const selectExternalSigningActive = (state: {
    externalSigner: ExternalSignerState;
}) =>
    state.externalSigner.status === "connected" &&
    !!state.externalSigner.account;

export default externalSignerSlice.reducer;
