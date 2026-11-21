// Makes the account the wallet extension is connected as behave like one of the
// user's own accounts in the UI (Phase 6, docs/UI_MIGRATION_PLAN.md §7.11): it
// is one of the choices of the account menu and the screens that act for "my"
// account (Send, trading, ...) are enabled while it is the chosen one. Nothing
// is persisted - the link comes back from the extension on the next start - and
// nothing here can sign anything: the extension checks the real authority when
// it signs.
//
// The account chosen in the menu is the one that signs, so this module never
// takes the choice away from the user: the extension's account becomes the
// current one only when the user connected the extension just now, when there
// is no current account at all, or when the extension itself switched from the
// account that was current (the extension's account follows the extension).
//
// `AccountStore.getMyAuthorityForAccount` is the other half: it reports "full"
// for that account while the extension is connected.
import {reduxStore} from "../store/reduxStore";
import {
    selectExternalSigner,
    selectExternalSigningActive
} from "../store/slices/externalSignerSlice";
import {patchState} from "../store/slices/accountSlice";
import AccountStore from "stores/AccountStore";

let started = false;
let added: string | null = null; // the name this module put into myActiveAccounts
// The extension account this module last looked at. A switch is considered only
// when the extension account becomes active or changes - not on every store
// update: re-applying it each time turned the account switcher into a no-op (any
// other account chosen was put straight back), so the extension account and the
// local wallet's accounts could not be used side by side.
let applied: string | null = null;

function apply() {
    const root = reduxStore.getState();
    const active = selectExternalSigningActive(root);
    const signer = selectExternalSigner(root);
    const name = active ? signer.account!.accountName : null;
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
        if (applied !== name) {
            const previous = applied;
            applied = name;
            const current = account.currentAccount;
            const follow =
                !current || current === previous || signer.makeCurrent;
            if (follow && current !== name) {
                (AccountStore as any).setCurrentAccount(name);
            }
        }
        return;
    }

    applied = null;
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
        // Only when the extension's account was the chosen one: another
        // account the user chose stays chosen.
        if (account.currentAccount === gone) {
            (AccountStore as any).tryToSetCurrentAccount();
            if ((AccountStore as any).getState().currentAccount === gone) {
                (AccountStore as any).setCurrentAccount(null);
            }
        }
    }
}

/** Idempotent; call once at startup. */
export function startExternalAccountSync() {
    if (started) return;
    started = true;
    reduxStore.subscribe(apply);
    apply();
}
