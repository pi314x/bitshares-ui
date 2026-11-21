// Whether the address book may show its memos: only while the wallet is unlocked. A memo is often what makes a payment
// reach its owner (an exchange's deposit tag), and the book keeps it in plain text in the browser, so a screen that is
// left locked shows who is paid and not the tag. Where the wallet extension signs for the chosen account the top bar
// does not call the wallet locked (the extension keeps its own lock, which this page cannot see), and neither does this.
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectAccountState} from "../../store/slices/accountSlice";
import {
    selectExternalSigner,
    selectExternalSigningActive
} from "../../store/slices/externalSignerSlice";
import {selectWalletUnlockState} from "../../store/slices/walletUnlockSlice";

export function useMemosVisible(): boolean {
    const locked = useReduxState<{locked: boolean}>(selectWalletUnlockState)
        .locked;
    const account = useReduxState<{
        currentAccount: string | null;
        passwordAccount: string | null;
    }>(selectAccountState);
    const connected = useReduxState(selectExternalSigningActive);
    const signer = useReduxState(selectExternalSigner);
    const name = account.currentAccount || account.passwordAccount;
    const extensionSigning =
        connected && !!signer.account && name === signer.account.accountName;
    return extensionSigning || !locked;
}
