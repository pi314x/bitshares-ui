// Orchestrates the optional extension-based signing method (Phase 6,
// docs/UI_MIGRATION_PLAN.md §7.11): detecting the extension, connecting,
// restoring an earlier approval, and signing a built transaction with it.
//
// Security properties (AGENTS.md: wallet signing is security-sensitive):
//   - the app never sees a key; the extension signs after the user approves in
//     its own dialog;
//   - the extension is used only while it is connected, and only for the
//     account it is connected as: the account chosen in the account menu signs,
//     so a transaction for any other (local wallet) account takes the local
//     path; there is no separate "signing method" setting to get out of step;
//   - the chain, lock state and connected account are re-checked on every
//     signing call (`wallet-extension/adapter.ts`);
//   - what the extension cannot do faithfully is refused here, not attempted:
//     a memo it cannot encrypt (an older extension would publish it
//     unencrypted), a fee in a non-core asset for an extension that overwrites
//     fees, an operation it does not sign for a site, unbroadcast or extra-key
//     signing (balance claims: the claimed balance's key is in the local
//     wallet, not in the extension, so such a claim is the local wallet's);
//   - a failure resolves `undefined` like the local path does, but is always
//     shown to the user, and an unknown outcome (timeout) says so instead of
//     inviting a blind retry.
import counterpart from "counterpart";
import {Apis} from "bitsharesjs-ws";
import {reduxStore} from "../store/reduxStore";
import {
    ExternalSignerState,
    patchExternalSigner,
    selectExternalSigner,
    selectExternalSigningActive
} from "../store/slices/externalSignerSlice";
import {
    createExtensionSigner,
    toSignerError
} from "../wallet-extension/adapter";
import {
    BitSharesWalletProvider,
    findProvider,
    waitForProvider
} from "../wallet-extension/provider";
import {
    actsForOtherAccount,
    toExtensionTransaction
} from "../wallet-extension/transaction";
import {
    ExternalSigner,
    ExternalSignerAccount,
    ExternalSignerError
} from "../wallet-extension/types";
import NotificationActions from "./NotificationActions";

const t = (key: string, params?: Record<string, string>) =>
    (counterpart as any).translate(key, params);

class ExternalSignerActionsFacade {
    private signer: ExternalSigner = createExtensionSigner();
    private detach: (() => void) | null = null;
    /** the extension's account that was switched to but is not connected to this site yet */
    private awaiting: string | null = null;

    getState(): ExternalSignerState {
        return selectExternalSigner(reduxStore.getState());
    }

    /** True while the extension is connected (it signs for its own account). */
    isActive(): boolean {
        return selectExternalSigningActive(reduxStore.getState());
    }

    private patch(patch: Partial<ExternalSignerState>) {
        reduxStore.dispatch(patchExternalSigner(patch));
    }

    private chainId(): string {
        const chainId = (Apis as any).instance().chain_id;
        if (!chainId) {
            throw new ExternalSignerError(
                "failed",
                t("externalSigner.noChain")
            );
        }
        return chainId;
    }

    /**
     * Whether `accountName` (the account chosen in the account menu) is the one
     * the extension signs for. Nothing else is: its other accounts, and every
     * account of the local wallet, sign locally.
     */
    isSigningFor(accountName: string | null | undefined): boolean {
        if (!accountName || !this.isActive()) return false;
        const account = this.getState().account;
        return !!account && account.accountName === accountName;
    }

    /**
     * Whether *this* transaction is the extension's to sign: the extension is
     * connected, and the transaction does not act for some other account (one of
     * the local wallet's). The latter goes through the local wallet, so the
     * account menu can hold both kinds of account.
     */
    shouldSign(tr: any): boolean {
        if (!this.isActive()) return false;
        const account = this.getState().account;
        if (!account) return true; // let processTransaction report "not connected"
        return !actsForOtherAccount(
            (tr && tr.operations) || [],
            account.accountId
        );
    }

    /**
     * Looks for the extension and re-links an earlier approval (silently: the
     * extension answers for itself, nothing is asked). A user who never
     * connected it finds it "disconnected" and nothing changes.
     */
    async init(): Promise<void> {
        const provider = await waitForProvider();
        this.patch({status: provider ? "disconnected" : "unavailable"});
        if (provider) await this.restore();
    }

    async restore(): Promise<void> {
        try {
            const account = await this.signer.restore(this.chainId());
            if (account) this.onConnected(account, false);
        } catch (e) {
            this.patch({error: toSignerError(e).message});
        }
    }

    async connect(): Promise<void> {
        this.patch({status: "connecting", error: null});
        try {
            const account = await this.signer.connect(this.chainId());
            this.onConnected(account, true);
        } catch (e) {
            const error = toSignerError(e);
            this.patch({
                status: findProvider() ? "disconnected" : "unavailable",
                error: error.message
            });
        }
    }

    async disconnect(): Promise<void> {
        this.unsubscribe();
        try {
            await this.signer.disconnect();
        } catch (e) {
            // the local link is dropped either way
        }
        this.patch({
            status: findProvider() ? "disconnected" : "unavailable",
            account: null,
            error: null,
            makeCurrent: false
        });
    }

    /** `makeCurrent`: the user connected it just now, so its account is theirs to use. */
    private onConnected(account: ExternalSignerAccount, makeCurrent: boolean) {
        this.awaiting = null;
        this.patch({status: "connected", account, error: null, makeCurrent});
        this.subscribe(findProvider());
    }

    private subscribe(provider: BitSharesWalletProvider | null) {
        this.unsubscribe();
        if (!provider) return;
        const onAccount = (data: any) => {
            if (
                data &&
                typeof data.name === "string" &&
                /^1\.2\.\d+$/.test(data.id)
            ) {
                const account = {accountName: data.name, accountId: data.id};
                this.patch({account, makeCurrent: false});
                void this.checkSwitched(account);
            }
        };
        const onLocked = () => this.patch({locked: true});
        const onUnlocked = () => this.patch({locked: false});
        provider.on("accountChanged", onAccount);
        provider.on("locked", onLocked);
        provider.on("unlocked", onUnlocked);
        if (typeof window !== "undefined") {
            window.addEventListener("focus", this.onWindowFocus);
        }
        this.detach = () => {
            provider.off("accountChanged", onAccount);
            provider.off("locked", onLocked);
            provider.off("unlocked", onUnlocked);
            if (typeof window !== "undefined") {
                window.removeEventListener("focus", this.onWindowFocus);
            }
        };
    }

    /**
     * The extension keeps a connection per account AND site, so the account it has just
     * switched to may not be connected to this site, and then it cannot sign here: the
     * signing call would fail with "no longer connected". Ask the extension (silently) and,
     * when it is not connected, say so and offer Connect, instead of showing "Connected as"
     * an account that cannot sign. Looked at again when the user comes back to this window
     * (the extension asks for the connection in its own popup).
     */
    private async checkSwitched(account: ExternalSignerAccount) {
        try {
            const linked = await this.signer.restore(this.chainId());
            if (linked && linked.accountId === account.accountId) {
                this.awaiting = null;
                return;
            }
            this.awaiting = account.accountName;
            this.patch({
                status: "disconnected",
                account: null,
                makeCurrent: false,
                error: t("externalSigner.switched", {
                    account: account.accountName
                })
            });
        } catch (e) {
            // the extension did not answer: every signing call checks again
        }
    }

    private onWindowFocus = () => {
        if (this.awaiting && this.getState().status === "disconnected") {
            void this.restore();
        }
    };

    private unsubscribe() {
        if (this.detach) this.detach();
        this.detach = null;
    }

    /**
     * Drop-in for the signing step of `WalletDb.process_transaction`: resolves
     * the broadcast result, or `undefined` after showing why it did not happen.
     */
    async processTransaction(
        tr: any,
        signer_pubkeys: any,
        broadcast: any,
        extra_keys: any[] = []
    ): Promise<any> {
        try {
            if (!broadcast) {
                throw new ExternalSignerError(
                    "unsupported",
                    t("externalSigner.noUnbroadcast")
                );
            }
            if (
                (signer_pubkeys && signer_pubkeys.length) ||
                extra_keys.length
            ) {
                throw new ExternalSignerError(
                    "unsupported",
                    t("externalSigner.noExtraKeys")
                );
            }
            const account = this.getState().account;
            if (!account) {
                throw new ExternalSignerError(
                    "unavailable",
                    t("externalSigner.notConnected")
                );
            }
            // what this extension can do (memo encryption, a fee asset, which operations)
            const capabilities = await this.signer.capabilities();
            const transaction = toExtensionTransaction(
                tr.operations,
                capabilities
            );
            NotificationActions.info({
                message: t("externalSigner.waiting"),
                autoDismiss: 8
            });
            const {result} = await this.signer.signAndBroadcast(
                account,
                transaction,
                this.chainId()
            );
            NotificationActions.success({
                message: t("externalSigner.sent"),
                autoDismiss: 6
            });
            return result === undefined ? {} : result;
        } catch (e) {
            const error = toSignerError(e);
            NotificationActions.error({
                message:
                    error.code === "unknown"
                        ? error.message
                        : t("externalSigner.failed", {reason: error.message}),
                autoDismiss: error.code === "unknown" ? 0 : 10
            });
            return undefined;
        }
    }
}

export default new ExternalSignerActionsFacade();
