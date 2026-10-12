// Makes the account the wallet extension is connected as behave like one of the
// user's own accounts in the UI (Phase 6, docs/UI_MIGRATION_PLAN.md §7.11): it
// is shown as the current account and the screens that act for "my" account
// (Send, trading, ...) are enabled. Nothing is persisted - the link comes back
// from the extension on the next start - and nothing here can sign anything:
// the extension checks the real authority when it signs.
//
// `AccountStore.getMyAuthorityForAccount` is the other half: it reports "full"
// for that account while the extension is the active signer.
import {reduxStore} from "../store/reduxStore";
import {
    selectExternalSigner,
    selectExternalSigningActive
} from "../store/slices/externalSignerSlice";
import {patchState} from "../store/slices/accountSlice";
import AccountStore from "stores/AccountStore";

let started = false;
let added: string | null = null; // the name this module put into myActiveAccounts

function apply() {
    const root = reduxStore.getState();
    const active = selectExternalSigningActive(root);
    const name = active
        ? selectExternalSigner(root).account!.accountName
        : null;
    const account = (AccountStore as any).getState();

    if (name) {
        if (!account.myActiveAccounts.has(name)) {
            added = name;
            reduxStore.dispatch(
                patchState({
                    myActiveAccounts: account.myActiveAccounts.add(name)
                } as any)
            );
        }
        if (account.currentAccount !== name) {
            (AccountStore as any).setCurrentAccount(name);
        }
        return;
    }

    if (added) {
        const gone = added;
        added = null;
        if (account.myActiveAccounts.has(gone)) {
            reduxStore.dispatch(
                patchState({
                    myActiveAccounts: account.myActiveAccounts.delete(gone)
                } as any)
            );
        }
        (AccountStore as any).tryToSetCurrentAccount();
    }
}

/** Idempotent; call once at startup. */
export function startExternalAccountSync() {
    if (started) return;
    started = true;
    reduxStore.subscribe(apply);
    apply();
}
