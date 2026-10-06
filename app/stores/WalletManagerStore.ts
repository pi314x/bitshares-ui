// Redux-backed replacement for the Alt.js WalletManagerStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 batch 9 - see
// `../store/reduxStore.ts`'s header for the overall migration approach).
//
// Part of a genuinely circular cluster that could not be split into
// smaller batches - see `./IntlStore.ts`'s header for the full
// explanation. This store's own cross-binding is
// `WalletActions.setWallet`, also bound by `AccountStore`.
//
// Preserves the exact interface every call site relies on - `getState()`,
// `listen()`, `unlisten()`, and every method the original `_export()`ed
// (`init`, `setNewWallet`, `onDeleteWallet`, `onDeleteAllWallets`) - plus
// every other `onXxx` handler, now plain public methods (rather than
// bindListeners-private) so `../actions/WalletActions.ts` can call them
// directly.
//
// This store's own calls into `WalletDb`/`AccountStore`/`AccountRefsStore`/
// `BalanceClaimActiveStore`/`CachedPropertyStore`/`PrivateKeyActions` are
// all plain method calls (never `bindListeners`), so they work
// identically regardless of which backend those stores use internally -
// unaffected by this migration either way.
import {reduxStore} from "../store/reduxStore";
import WalletDb from "stores/WalletDb";
import AccountRefsStore from "stores/AccountRefsStore";
import AccountStore from "stores/AccountStore";
import BalanceClaimActiveStore from "stores/BalanceClaimActiveStore";
import CachedPropertyStore from "stores/CachedPropertyStore";
import PrivateKeyActions from "actions/PrivateKeyActions";
import WalletActions from "actions/WalletActions";
import {ChainStore} from "bitsharesjs";
import iDB from "idb-instance";
import Immutable from "immutable";
import {
    patchState,
    selectWalletManagerState,
    WalletManagerState
} from "../store/slices/walletManagerSlice";

/**  High-level container for managing multiple wallets.
 */
class WalletManagerStoreFacade {
    private unsubscribers = new Map<() => void, () => void>();

    getState(): WalletManagerState {
        return selectWalletManagerState(reduxStore.getState());
    }

    listen(callback: () => void) {
        let previous = selectWalletManagerState(reduxStore.getState());
        const unsubscribe = reduxStore.subscribe(() => {
            const next = selectWalletManagerState(reduxStore.getState());
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

    /** This will change the current wallet the newly restored wallet. */
    onRestore({wallet_name, wallet_object}: {wallet_name: string; wallet_object: any}) {
        (iDB as any)
            .restore(wallet_name, wallet_object)
            .then(() => {
                (AccountStore as any).setWallet(wallet_name);
                return this.onSetWallet({wallet_name});
            })
            .catch((error: any) => {
                console.error(error);
                return Promise.reject(error);
            });
    }

    /** This may result in a new wallet name being added, only in this case
        should a <b>create_wallet_password</b> be provided.
    */
    onSetWallet({
        wallet_name = "default",
        create_wallet_password,
        brnkey,
        resolve
    }: {
        wallet_name?: string;
        create_wallet_password?: string;
        brnkey?: string;
        resolve?: (p: Promise<any>) => void;
    }) {
        const p = new Promise(res => {
            if (/[^a-z0-9_-]/.test(wallet_name) || wallet_name === "")
                throw new Error("Invalid wallet name");

            const state = this.getState();
            if (state.current_wallet === wallet_name) {
                res(undefined);
                return;
            }

            let add;
            if (!state.wallet_names.has(wallet_name)) {
                const wallet_names = state.wallet_names.add(wallet_name);
                add = (iDB as any).root.setProperty("wallet_names", wallet_names);
                reduxStore.dispatch(patchState({wallet_names}));
            }

            const current = (iDB as any).root.setProperty(
                "current_wallet",
                wallet_name
            );

            res(
                Promise.all([add, current]).then(() => {
                    // The database must be closed and re-opened first before the current
                    // application code can initialize its new state.
                    (iDB as any).close();
                    (ChainStore as any).clearCache();
                    (BalanceClaimActiveStore as any).reset();
                    // Stores may reset when loadDbData is called
                    return (iDB as any).init_instance().init_promise.then(() => {
                        // Make sure the database is ready when calling CachedPropertyStore.reset()
                        (CachedPropertyStore as any).reset();
                        return Promise.all([
                            (WalletDb as any)
                                .loadDbData()
                                .then(() => (AccountStore as any).loadDbData()),
                            (PrivateKeyActions as any)
                                .loadDbData()
                                .then(() => (AccountRefsStore as any).loadDbData())
                        ]).then(() => {
                            // Update state here again to make sure listeners re-render

                            if (!create_wallet_password) {
                                reduxStore.dispatch(
                                    patchState({current_wallet: wallet_name})
                                );
                                return;
                            }

                            return (WalletDb as any)
                                .onCreateWallet(
                                    create_wallet_password,
                                    brnkey, //brainkey,
                                    true, //unlock
                                    wallet_name
                                )
                                .then(() =>
                                    reduxStore.dispatch(
                                        patchState({current_wallet: wallet_name})
                                    )
                                );
                        });
                    });
                })
            );
        }).catch(error => {
            console.error(error);
            return Promise.reject(error);
        });
        if (resolve) resolve(p);
    }

    /** Used by the components during a pending wallet create. */
    setNewWallet(new_wallet: any) {
        reduxStore.dispatch(patchState({new_wallet}));
    }

    init(): Promise<void> {
        return (iDB as any).root
            .getProperty("current_wallet")
            .then((current_wallet: any) => {
                return (iDB as any).root
                    .getProperty("wallet_names", [])
                    .then((wallet_names: any) => {
                        reduxStore.dispatch(
                            patchState({
                                wallet_names: Immutable.Set(wallet_names),
                                current_wallet
                            })
                        );
                        (AccountStore as any).setWallet(current_wallet);
                    });
            });
    }

    onDeleteAllWallets() {
        const deletes: Promise<any>[] = [];
        this.getState().wallet_names.forEach((wallet_name: any) =>
            deletes.push(this.onDeleteWallet(wallet_name))
        );
        return Promise.all(deletes);
    }

    onDeleteWallet(delete_wallet_name: string): Promise<any> {
        return new Promise(resolve => {
            const state = this.getState();
            let {current_wallet, wallet_names} = state;
            if (!wallet_names.has(delete_wallet_name)) {
                throw new Error("Can't delete wallet, does not exist in index");
            }
            wallet_names = wallet_names.delete(delete_wallet_name);
            (iDB as any).root.setProperty("wallet_names", wallet_names);
            if (current_wallet === delete_wallet_name) {
                current_wallet = wallet_names.size
                    ? wallet_names.first()
                    : undefined;
                (iDB as any).root.setProperty("current_wallet", current_wallet);
                if (current_wallet)
                    (WalletActions as any).setWallet(current_wallet);
            }
            reduxStore.dispatch(patchState({current_wallet, wallet_names}));
            const database_name = (iDB as any).getDatabaseName(delete_wallet_name);
            (iDB as any).impl.deleteDatabase(database_name);
            resolve(database_name);
        });
    }

    onSetBackupDate() {
        (WalletDb as any).setBackupDate();
    }

    onSetBrainkeyBackupDate() {
        (WalletDb as any).setBrainkeyBackupDate();
    }
}

export default new WalletManagerStoreFacade();
