import AccountActions from "actions/AccountActions";
import WalletUnlockActions from "actions/WalletUnlockActions";
import {setLocalStorageType, isPersistantType} from "lib/common/localStorage";

/**
 * Log out: lock the wallet and forget the session's account - a cloud
 * wallet's password account, and the current account that was pinned to it -
 * so the top bar says "No account" until one is chosen again. (Locking without
 * "remember me" forgets only the password account and keeps the account on
 * screen, read-only; this is the explicit end of the session.)
 *
 * No key, password or brainkey is read or written here: it only calls the
 * existing lock action and clears two account names.
 */
export function logoutSession(): void {
    WalletUnlockActions.lock();
    if (!isPersistantType()) setLocalStorageType("persistant");
    AccountActions.setPasswordAccount(null);
    AccountActions.setCurrentAccount(null);
}
