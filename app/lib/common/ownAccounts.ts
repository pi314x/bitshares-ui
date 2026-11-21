// The accounts that are the user's own, for the places that offer them beside the people the user pays (the address
// book, the recipient of the Send dialog): the accounts of the local wallet, and the account the wallet extension is
// connected as. That one is not among the wallet's accounts (its keys are in the extension, not in the wallet), but it
// is as much the user's, and it comes first, as it does in the account menu.
export type OwnAccountSource = "wallet" | "extension";

export interface OwnAccount {
    name: string;
    source: OwnAccountSource;
}

export function ownAccounts(
    walletAccounts: string[],
    extensionAccount: string | null
): OwnAccount[] {
    const own: OwnAccount[] = [];
    const seen = new Set<string>();
    if (extensionAccount) {
        own.push({name: extensionAccount, source: "extension"});
        seen.add(extensionAccount);
    }
    walletAccounts.forEach(name => {
        if (seen.has(name)) return;
        seen.add(name);
        own.push({name, source: "wallet"});
    });
    return own;
}
