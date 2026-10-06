// Redux-backed replacement for the Alt.js WalletUnlockStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 batch 9 - see
// `../store/reduxStore.ts`'s header for the overall migration approach).
//
// Part of a genuinely circular cluster that could not be split into
// smaller batches: `SettingsActions.changeSetting` is bound by this
// store, `SettingsStore`, AND `AccountStore` (Alt's `bindListeners`
// requires the action reference to stay a real Alt action for as long
// as any store still binds to it directly), so `IntlStore`,
// `SettingsStore`, `WalletUnlockStore`, `AccountStore`, and
// `WalletManagerStore` (cross-bound via `WalletActions.setWallet` with
// `AccountStore`) all had to migrate together in one commit. The
// cross-notification is wired explicitly in `../actions/SettingsActions.ts`,
// which calls this store's `onChangeSetting` directly alongside
// `SettingsStore`'s and `AccountStore`'s.
//
// Tier 2 (AGENTS.md): this is the real wallet-lock-state store -
// `locked` gates the whole app's wallet access. `onUnlock`/`onLock`
// preserved byte-for-byte, including the `resolve`/`reject` functions
// stored directly in state (matching the original's own
// `this.setState({resolve, reject, ...})`).
//
// Preserves the exact interface every call site relies on - `getState()`,
// `listen()`, `unlisten()` - plus every `onXxx` handler, now plain
// public methods (rather than bindListeners-private) so
// `../actions/WalletUnlockActions.ts` can call them directly, and so
// `../actions/SettingsActions.ts` can call `onChangeSetting` directly.
import {reduxStore} from "../store/reduxStore";
import WalletDb from "stores/WalletDb";
import ls from "common/localStorage";
import {setLocalStorageType, isPersistantType} from "../lib/common/localStorage";
import {
    patchState,
    seedWalletUnlockState,
    selectWalletUnlockState,
    WalletUnlockState
} from "../store/slices/walletUnlockSlice";

const STORAGE_KEY = "__graphene__";
const ss = (ls as any)(STORAGE_KEY);

class WalletUnlockStoreFacade {
    private walletLockTimeout: number;
    private timeout: any = null;
    private unsubscribers = new Map<() => void, () => void>();

    constructor() {
        // can't use settings store due to possible initialization race conditions
        const storedSettings = ss.get("settings_v4", {});
        if (storedSettings.passwordLogin === undefined) {
            storedSettings.passwordLogin = true;
        }
        const passwordLogin = storedSettings.passwordLogin;
        reduxStore.dispatch(
            seedWalletUnlockState({
                locked: true,
                passwordLogin: passwordLogin,
                rememberMe:
                    storedSettings.rememberMe === undefined
                        ? true
                        : storedSettings.rememberMe
            })
        );

        this.walletLockTimeout = this._getTimeout(); // seconds (10 minutes)
        this.timeout = null;
    }

    getState(): WalletUnlockState {
        return selectWalletUnlockState(reduxStore.getState());
    }

    listen(callback: () => void) {
        let previous = selectWalletUnlockState(reduxStore.getState());
        const unsubscribe = reduxStore.subscribe(() => {
            const next = selectWalletUnlockState(reduxStore.getState());
            if (next !== previous) {
                previous = next;
                callback();
            }
        });
        this.unsubscribers.set(callback, unsubscribe);
    }

    unlisten(callback: () => void) {
        const unsubscribe = this.unsubscribers.get(callback);
        if (unsubscribe) {
            unsubscribe();
            this.unsubscribers.delete(callback);
        }
    }

    onUnlock({resolve, reject}: {resolve: () => void; reject: (reason?: any) => void}) {
        this._setLockTimeout();
        if (!(WalletDb as any).isLocked()) {
            reduxStore.dispatch(patchState({locked: false}));
            resolve();
            return;
        }

        reduxStore.dispatch(
            patchState({resolve, reject, locked: (WalletDb as any).isLocked()})
        );
    }

    onLock({resolve}: {resolve: () => void}) {
        if ((WalletDb as any).isLocked()) {
            resolve();
            return;
        }
        (WalletDb as any).onLock();
        reduxStore.dispatch(
            patchState({
                resolve: null,
                reject: null,
                locked: (WalletDb as any).isLocked()
            })
        );
        if (!this.getState().rememberMe && !isPersistantType()) {
            setLocalStorageType("persistant");
        }
        resolve();
    }

    onCancel() {
        const reject = this.getState().reject;
        if (typeof reject === "function") reject({isCanceled: true});
        reduxStore.dispatch(patchState({resolve: null, reject: null}));
    }

    onChange() {
        reduxStore.dispatch(patchState({locked: (WalletDb as any).isLocked()}));
    }

    onChangeSetting(payload: {setting: string; value: any; rememberMe?: any}) {
        if (payload.setting === "walletLockTimeout") {
            this.walletLockTimeout = payload.value;
            this._clearLockTimeout();
            this._setLockTimeout();
        } else if (payload.setting === "passwordLogin") {
            reduxStore.dispatch(patchState({passwordLogin: payload.value}));
        } else if (payload.setting === "rememberMe") {
            reduxStore.dispatch(patchState({rememberMe: payload.rememberMe}));
        }
    }

    private _setLockTimeout() {
        this._clearLockTimeout();
        /* If the timeout is different from zero, auto unlock the wallet using a timeout */
        if (!!this.walletLockTimeout) {
            this.timeout = setTimeout(() => {
                if (!(WalletDb as any).isLocked()) {
                    console.log(
                        "auto locking after",
                        this.walletLockTimeout,
                        "s"
                    );
                    (WalletDb as any).onLock();
                    reduxStore.dispatch(patchState({locked: true}));
                }
            }, this.walletLockTimeout * 1000);
        }
    }

    private _clearLockTimeout() {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
        }
    }

    private _getTimeout() {
        return parseInt(ss.get("lockTimeout", 600), 10);
    }

    onCheckLock() {
        reduxStore.dispatch(patchState({locked: (WalletDb as any).isLocked()}));
    }
}

export default new WalletUnlockStoreFacade();
