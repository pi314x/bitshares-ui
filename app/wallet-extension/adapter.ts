// `ExternalSigner` on top of the extension's injected provider
// (`window.bitsharesWallet`, see `provider.ts`). Every call re-checks what the
// extension might have changed behind the app's back (locked, other chain,
// other account) instead of trusting what was true at connect time.
//
// The extension's answers are untrusted input: shapes are validated, and error
// text is cut to its first line (the extension appends the whole operation JSON
// to broadcast errors).
import {
    BitSharesWalletProvider,
    findProvider,
    ProviderAccount
} from "./provider";
import {
    ExternalSigner,
    ExternalSignerAccount,
    ExternalSignerError,
    ExtensionTransaction
} from "./types";
import {assertOperationsBelongTo} from "./transaction";

const ACCOUNT_ID = /^1\.2\.\d+$/;
const MAX_MESSAGE = 300;

export function toSignerError(error: unknown): ExternalSignerError {
    if (error instanceof ExternalSignerError) return error;
    const raw = String((error && (error as any).message) || error || "");
    const message = raw.split("\n")[0].slice(0, MAX_MESSAGE) || "Unknown error";
    // The extension's content script gives up after 60 s with a bare
    // "Request timeout" (or loses its background port) even if the user approved
    // at 59 s and the transaction was signed and broadcast. Whether it was sent
    // is then unknown, which is not the same as "failed, try again".
    if (/^request timeout$|extension disconnected/i.test(message))
        return new ExternalSignerError(
            "unknown",
            "The extension did not answer in time. If you approved the transaction " +
                "there it may still have been sent - check your account history " +
                "before trying again."
        );
    if (/locked/i.test(message))
        return new ExternalSignerError("locked", message);
    if (/chain id mismatch/i.test(message))
        return new ExternalSignerError("chain_mismatch", message);
    if (/reject/i.test(message))
        return new ExternalSignerError("rejected", message);
    if (/timeout|timed out/i.test(message))
        return new ExternalSignerError("timeout", message);
    return new ExternalSignerError("failed", message);
}

function toAccount(
    value: ProviderAccount | null | undefined
): ExternalSignerAccount {
    if (
        !value ||
        typeof value.name !== "string" ||
        !value.name ||
        typeof value.id !== "string" ||
        !ACCOUNT_ID.test(value.id)
    ) {
        throw new ExternalSignerError(
            "failed",
            "The extension did not report a valid account."
        );
    }
    return {accountName: value.name, accountId: value.id};
}

function sameChain(a: unknown, b: string): boolean {
    return typeof a === "string" && a.toLowerCase() === b.toLowerCase();
}

export function createExtensionSigner(
    getProvider: () => BitSharesWalletProvider | null = () => findProvider()
): ExternalSigner {
    const need = (): BitSharesWalletProvider => {
        const provider = getProvider();
        if (!provider) {
            throw new ExternalSignerError(
                "unavailable",
                "The BitShares wallet extension was not found in this browser."
            );
        }
        return provider;
    };

    const assertChain = async (
        provider: BitSharesWalletProvider,
        chainId: string
    ) => {
        const actual = await provider.getChainId();
        if (!sameChain(actual, chainId)) {
            throw new ExternalSignerError(
                "chain_mismatch",
                "The extension is on a different network than this app."
            );
        }
    };

    // Anything but an explicit `locked: false` counts as locked.
    const isLocked = async (): Promise<boolean> => {
        try {
            const answer = await need().request("isLocked", {});
            return !answer || answer.locked !== false;
        } catch (e) {
            throw toSignerError(e);
        }
    };

    return {
        async isAvailable() {
            return !!getProvider();
        },

        isLocked,

        async connect(chainId) {
            try {
                const provider = need();
                const response = await provider.connect({chain_id: chainId});
                const account = toAccount(response && response.account);
                await assertChain(provider, chainId);
                return account;
            } catch (e) {
                throw toSignerError(e);
            }
        },

        async restore(chainId) {
            try {
                const provider = need();
                const status = await provider.checkConnection();
                if (!status || status.connected !== true || !status.account)
                    return null;
                const account = toAccount(status.account);
                await assertChain(provider, chainId);
                return account;
            } catch (e) {
                const error = toSignerError(e);
                // A missing or mismatching extension on startup is "not connected",
                // not a failure to report.
                if (
                    error.code === "unavailable" ||
                    error.code === "chain_mismatch" ||
                    error.code === "locked"
                )
                    return null;
                throw error;
            }
        },

        async signAndBroadcast(
            account: ExternalSignerAccount,
            transaction: ExtensionTransaction,
            chainId: string
        ) {
            try {
                assertOperationsBelongTo(transaction, account.accountId);
                const provider = need();
                if (await isLocked()) {
                    throw new ExternalSignerError(
                        "locked",
                        "The extension is locked. Unlock it, then try again."
                    );
                }
                await assertChain(provider, chainId);
                const status = await provider.checkConnection();
                if (
                    !status ||
                    status.connected !== true ||
                    !status.account ||
                    status.account.id !== account.accountId
                ) {
                    throw new ExternalSignerError(
                        "account_mismatch",
                        "The extension is no longer connected as " +
                            account.accountName +
                            "."
                    );
                }
                const response = await provider.signTransaction({
                    operations: transaction.operations,
                    extensions: []
                });
                if (
                    !response ||
                    typeof response !== "object" ||
                    response.success !== true
                ) {
                    throw toSignerError(
                        response && (response as any).error
                            ? (response as any).error
                            : "The extension did not confirm the transaction."
                    );
                }
                return {result: response.result};
            } catch (e) {
                throw toSignerError(e);
            }
        },

        async disconnect() {
            const provider = getProvider();
            if (!provider) return;
            try {
                await provider.disconnect();
            } catch (e) {
                throw toSignerError(e);
            }
        }
    };
}
