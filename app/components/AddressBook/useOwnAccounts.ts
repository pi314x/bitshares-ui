// The user's own accounts, kept up to date: those of the local wallet (the ones in the account menu) and the account the
// wallet extension is connected as. See `lib/common/ownAccounts`.
import * as React from "react";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectAccountState} from "../../store/slices/accountSlice";
import {
    selectExternalSigner,
    selectExternalSigningActive
} from "../../store/slices/externalSignerSlice";
import {OwnAccount, ownAccounts} from "../../lib/common/ownAccounts";

export function useOwnAccounts(): OwnAccount[] {
    const account = useReduxState<{
        myActiveAccounts?: {toArray(): string[]};
    }>(selectAccountState);
    const connected = useReduxState(selectExternalSigningActive);
    const signer = useReduxState(selectExternalSigner);
    const extensionAccount =
        connected && signer.account ? signer.account.accountName : null;
    const wallet = account.myActiveAccounts
        ? account.myActiveAccounts.toArray()
        : [];
    const key = wallet.join(",");
    return React.useMemo(() => ownAccounts(wallet, extensionAccount), [
        key,
        extensionAccount
    ]);
}
