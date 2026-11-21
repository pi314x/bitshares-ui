// What this device holds for the wallet, as a list of facts for a settings screen:
// the same things the start-up screen reports while it reads them (see
// startupProgress.ts), read live. Counts and names only - never a key, a password or
// a phrase.

export interface LocalDataInput {
    walletNames: string[];
    currentWallet: string | null;
    /** the sign-in is by account name and password */
    passwordLogin: boolean;
    locked: boolean;
    keyCount: number;
    /** the accounts the user holds the keys of (linked) / hides in the lists */
    linkedAccounts: number;
    hiddenAccounts: number;
    currentAccount: string | null;
    /** the wallet browser extension is connected and its account is in use */
    extensionConnected: boolean;
    language: string | null;
    theme: string | null;
    node: string | null;
}

export type FactTone = "ok" | "neutral" | "warn";

export interface LocalFact {
    /** the locale key under `settings.local_data.` for the row's label */
    id:
        | "wallet"
        | "lock"
        | "keys"
        | "accounts"
        | "current"
        | "extension"
        | "preferences";
    /** the locale key under `settings.local_data.` for the value, and its parameters */
    value: string;
    params: {[name: string]: string | number};
    tone: FactTone;
}

export function localFacts(input: LocalDataInput): LocalFact[] {
    const facts: LocalFact[] = [];

    // the wallet
    if (input.walletNames.length === 0) {
        facts.push({
            id: "wallet",
            value: input.passwordLogin ? "wallet_password" : "wallet_none",
            params: {},
            tone: "neutral"
        });
    } else {
        facts.push({
            id: "wallet",
            value:
                input.walletNames.length > 1 ? "wallet_several" : "wallet_one",
            params: {
                count: input.walletNames.length,
                name: input.currentWallet || input.walletNames[0]
            },
            tone: "ok"
        });
    }

    // locked or open (a wallet without keys has nothing to lock)
    if (input.walletNames.length > 0 || input.keyCount > 0) {
        facts.push({
            id: "lock",
            value: input.locked ? "locked" : "unlocked",
            params: {},
            tone: input.locked ? "neutral" : "warn"
        });
    }

    facts.push({
        id: "keys",
        value: input.keyCount ? "keys_some" : "keys_none",
        params: {count: input.keyCount},
        tone: input.keyCount ? "ok" : "neutral"
    });

    facts.push({
        id: "accounts",
        value: input.linkedAccounts
            ? input.hiddenAccounts
                ? "accounts_hidden"
                : "accounts_some"
            : "accounts_none",
        params: {count: input.linkedAccounts, hidden: input.hiddenAccounts},
        tone: input.linkedAccounts ? "ok" : "neutral"
    });

    if (input.currentAccount) {
        facts.push({
            id: "current",
            value: "current_account",
            params: {name: input.currentAccount},
            tone: "neutral"
        });
    }

    facts.push({
        id: "extension",
        value: input.extensionConnected ? "extension_on" : "extension_off",
        params: {},
        tone: input.extensionConnected ? "ok" : "neutral"
    });

    facts.push({
        id: "preferences",
        value: "preferences",
        params: {
            language: input.language || "-",
            theme: input.theme || "-",
            node: input.node || "-"
        },
        tone: "neutral"
    });

    return facts;
}
