// Orchestrates the optional extension-based signing method (Phase 6,
// docs/UI_MIGRATION_PLAN.md §7.11): detecting the extension, connecting,
// restoring an earlier approval, and signing a built transaction with it.
//
// Security properties (AGENTS.md: wallet signing is security-sensitive):
//   - the app never sees a key; the extension signs after the user approves in
//     its own dialog;
//   - the default is the local wallet; the extension is used only when the user
//     chose it AND it is connected;
//   - the chain, lock state and connected account are re-checked on every
//     signing call (`wallet-extension/adapter.ts`);
//   - what the extension cannot do faithfully is refused here, not attempted:
//     memos (it would publish them unencrypted), a fee in a non-core asset (it
//     overwrites fees), unbroadcast or extra-key signing (balance claims);
//   - a failure resolves `undefined` like the local path does, but is always
//     shown to the user, and an unknown outcome (timeout) says so instead of
//     inviting a blind retry.
import counterpart from "counterpart";
import {Apis} from "bitsharesjs-ws";
import ls from "common/localStorage";
import {reduxStore} from "../store/reduxStore";
import {
    ExternalSignerState,
    SigningPreference,
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
import {toExtensionTransaction} from "../wallet-extension/transaction";
import {
    ExternalSigner,
    ExternalSignerAccount,
    ExternalSignerError
} from "../wallet-extension/types";
import NotificationActions from "./NotificationActions";

const STORAGE_KEY = "__graphene__";
const PREFERENCE_KEY = "signingMethod";

function readPreference(): SigningPreference {
    try {
        return (ls as any)(STORAGE_KEY).get(PREFERENCE_KEY, "local") ===
            "extension"
            ? "extension"
            : "local";
    } catch (e) {
        return "local";
    }
}

function writePreference(preference: SigningPreference) {
    try {
        (ls as any)(STORAGE_KEY).set(PREFERENCE_KEY, preference);
    } catch (e) {
        // not persisted; the choice still holds for this session
    }
}

const t = (key: string, params?: Record<string, string>) =>
    (counterpart as any).translate(key, params);

class ExternalSignerActionsFacade {
    private signer: ExternalSigner = createExtensionSigner();
    private detach: (() => void) | null = null;

    getState(): ExternalSignerState {
        return selectExternalSigner(reduxStore.getState());
    }

    /** True when the next transaction is to be signed by the extension. */
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

    /** Looks for the extension, loads the saved preference, restores a link. */
    async init(): Promise<void> {
        this.patch({preference: readPreference()});
        const provider = await waitForProvider();
        this.patch({status: provider ? "disconnected" : "unavailable"});
        if (provider && this.getState().preference === "extension") {
            await this.restore();
        }
    }

    async restore(): Promise<void> {
        try {
            const account = await this.signer.restore(this.chainId());
            if (account) this.onConnected(account);
        } catch (e) {
            this.patch({error: toSignerError(e).message});
        }
    }

    async connect(): Promise<void> {
        this.patch({status: "connecting", error: null});
        try {
            const account = await this.signer.connect(this.chainId());
            this.onConnected(account);
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
            error: null
        });
    }

    setPreference(preference: SigningPreference) {
        writePreference(preference);
        this.patch({preference});
    }

    private onConnected(account: ExternalSignerAccount) {
        this.patch({status: "connected", account, error: null});
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
                this.patch({
                    account: {accountName: data.name, accountId: data.id}
                });
            }
        };
        const onLocked = () => this.patch({locked: true});
        const onUnlocked = () => this.patch({locked: false});
        provider.on("accountChanged", onAccount);
        provider.on("locked", onLocked);
        provider.on("unlocked", onUnlocked);
        this.detach = () => {
            provider.off("accountChanged", onAccount);
            provider.off("locked", onLocked);
            provider.off("unlocked", onUnlocked);
        };
    }

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
            const transaction = toExtensionTransaction(tr.operations);
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
