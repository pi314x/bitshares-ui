// When the start-up screen may go away.
//
// The app used to show "Starting BitShares" until the node connection was
// open, then put up the shell with a second spinner in the middle of the page
// until the account lists were read: one start-up, two loaders. The start-up
// screen now stays until the app can show something, which is when the
// account state has been read (the same condition the dashboard waited for),
// or after a limit, so that a slow account never keeps the screen up forever.

/** The longest the start-up screen waits for the account state once the
 * connection is open. */
export const READY_MAX_MS = 8000;

export interface StartupAccountState {
    accountsLoaded?: boolean;
    refsLoaded?: boolean;
}

/** The account lists have been read. */
export function accountsReady(
    account: StartupAccountState | null | undefined
): boolean {
    return (
        !!account &&
        account.accountsLoaded === true &&
        account.refsLoaded === true
    );
}

/** Whether the start-up screen is on: until the connection is open and the app
 * is ready; never on top of an error screen. */
export function coverVisible(state: {
    apiConnected: boolean;
    apiError: boolean;
    appReady: boolean;
}): boolean {
    if (state.apiError) return false;
    return !state.apiConnected || !state.appReady;
}
