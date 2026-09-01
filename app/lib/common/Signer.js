import WalletDb from "stores/WalletDb";
import SettingsStore from "stores/SettingsStore";

/**
 * Where a transaction gets signed.
 *
 * The wallet has always signed locally: keys live in the browser's own wallet database and
 * WalletDb.process_transaction pops the confirm modal, signs and broadcasts. The BitShares
 * browser extension can do the same job while keeping the keys out of this page entirely,
 * which is the whole point of it -- a compromised wallet tab cannot leak what it never had.
 *
 * Both are legitimate choices, so this module presents them as one interface and lets the
 * user pick. It deliberately does not decide for them: an installed extension does not mean
 * they want to route through it, and silently switching where signing happens is the kind of
 * surprise a wallet must never spring on someone.
 */

/// The page-injected provider, if the extension is installed. See its content/inpage.js:
/// it sets window.bitsharesWallet (and window.bitshares as an alias) at document_start
/// and fires `bitsharesWalletReady`.
function provider() {
    return typeof window !== "undefined"
        ? window.bitsharesWallet || window.bitshares
        : null;
}

export const SIGNER_LOCAL = "signer_local";
export const SIGNER_EXTENSION = "signer_extension";

const Signer = {
    /// Whether the extension is present in this page right now.
    extensionAvailable() {
        return !!provider();
    },

    /**
     * Resolve to the extension only once, when the page loads. The provider is injected at
     * document_start, but a listener registered after that would never see the event, so
     * check for it first and fall back to waiting.
     */
    whenExtensionReady(timeoutMs = 3000) {
        if (provider()) return Promise.resolve(provider());
        return new Promise(resolve => {
            let settled = false;
            const done = () => {
                if (settled) return;
                settled = true;
                resolve(provider());
            };
            window.addEventListener("bitsharesWalletReady", done, {once: true});
            setTimeout(done, timeoutMs);
        });
    },

    /// The user's choice. Falls back to local whenever the extension is not actually there,
    /// so a stale setting cannot strand someone with no way to sign.
    preference() {
        const chosen = SettingsStore.getState().settings.get("signer");
        if (chosen === SIGNER_EXTENSION && provider()) return SIGNER_EXTENSION;
        return SIGNER_LOCAL;
    },

    /**
     * Sign and broadcast a TransactionBuilder.
     *
     * Local signing takes the builder as-is. The extension takes plain operations instead:
     * its API is `signTransaction({operations: [[opType, opData], ...]})`, and it rebuilds,
     * signs and broadcasts on its own side -- which is exactly why the keys never come here.
     */
    process(tr, {signer = null, broadcast = true} = {}) {
        const which = signer || Signer.preference();

        if (which === SIGNER_LOCAL) {
            return WalletDb.process_transaction(tr, null, broadcast);
        }

        const wallet = provider();
        if (!wallet) {
            return Promise.reject(
                new Error(
                    "The BitShares wallet extension is not available in this page. " +
                        "Switch signing back to the local wallet in Settings, or install the extension."
                )
            );
        }

        // TransactionBuilder keeps operations as [opTypeId, opObject] pairs, which is the
        // shape the extension already expects, so no translation is needed.
        const operations = (tr.operations || []).map(op => [op[0], op[1]]);
        if (!operations.length) {
            return Promise.reject(
                new Error("Refusing to sign an empty transaction")
            );
        }

        return wallet.signTransaction({operations, extensions: []});
    }
};

export default Signer;
