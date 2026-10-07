// Redux-backed replacement for the Alt.js PrivateKeyStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 batch 8 - see
// `../store/reduxStore.ts`'s header for the overall migration approach).
// Tier 2 (AGENTS.md): `keys` holds `PrivateKeyTcomb` records with an
// AES-encrypted `encrypted_key` blob - see `../store/slices/
// privateKeySlice.ts`'s header for why this isn't a new exposure.
// `decodeMemo` calls `WalletDb.decryptTcomb_PrivateKey` and
// `Aes.decrypt_with_checksum` to decrypt a real private key and decode a
// transfer memo - preserved byte-for-byte, nothing logged.
//
// Preserves the exact interface every call site relies on - `getState()`,
// `listen()`, `unlisten()`, and every method the original `_export()`ed
// (`hasKey`, `getPubkeys`, `getTcomb_byPubkey`,
// `getPubkeys_having_PrivateKey`, `addPrivateKeys_noindex`, `decodeMemo`,
// `setPasswordLoginKey`) - plus `onLoadDbData`/`onAddKey`, now plain
// public methods (rather than bindListeners-private) so
// `../actions/PrivateKeyActions.ts` can call them directly, and so
// `../actions/PrivateKeyActions.ts` can also notify `AccountRefsStore`
// explicitly (see that file's header - `PrivateKeyActions.addKey` was
// bound by BOTH this store and `AccountRefsStore` under real Alt).
//
// `this.pending_operation_count` stays a plain instance field, exactly
// like the original (a SEPARATE counter from the reactive
// `state.pending_operation_count` the slice holds - the original's own
// `onLoadDbData` resets the reactive mirror to 0 via `_getInitialState()`
// without touching the real plain-field counter `pendingOperation()`/
// `pendingOperationDone()` actually operate on; preserved exactly, not
// "fixed" into a single source of truth).
//
// `decodeMemo`'s `lockedWallet` local variable is dropped: in the
// original it was assigned (`true`, in the locked-wallet catch branch)
// but never read anywhere - not returned, not logged - genuinely dead
// even in the original (TypeScript's `no-unused-vars` just makes this
// visible where plain JS didn't). No observable behavior change.
import {reduxStore} from "../store/reduxStore";
import Immutable from "immutable";
import idb_helper from "idb-helper";
import WalletDb from "./WalletDb";
import {PrivateKeyTcomb} from "./tcomb_structs";
import AddressIndex from "stores/AddressIndex";
import CachedPropertyActions from "actions/CachedPropertyActions";
import {PublicKey, ChainStore, Aes} from "bitsharesjs";
import {
    setKeys,
    resetPrivateKeyState,
    setPendingOperationCount,
    setPrivateKeyStorageError,
    selectPrivateKeyState
} from "../store/slices/privateKeySlice";

class PrivateKeyStoreFacade {
    private pending_operation_count = 0;
    private unsubscribers = new Map<() => void, () => void>();

    getState() {
        return selectPrivateKeyState(reduxStore.getState());
    }

    listen(callback: () => void) {
        let previous = selectPrivateKeyState(reduxStore.getState());
        const unsubscribe = reduxStore.subscribe(() => {
            const next = selectPrivateKeyState(reduxStore.getState());
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

    setPasswordLoginKey(key: any) {
        const keys = this.getState().keys.set(key.pubkey, key);
        reduxStore.dispatch(setKeys(keys));
    }

    /** This method may be called again should the main database change */
    onLoadDbData(resolve: (p: Promise<any>) => void) {
        this.pendingOperation();
        reduxStore.dispatch(resetPrivateKeyState());
        const keys = (Immutable as any).Map().asMutable();
        const p = idb_helper
            .cursor("private_keys", (cursor: any) => {
                if (!cursor) {
                    reduxStore.dispatch(setKeys(keys.asImmutable()));
                    return;
                }
                const private_key_tcomb = (PrivateKeyTcomb as any)(cursor.value);
                keys.set(private_key_tcomb.pubkey, private_key_tcomb);
                (AddressIndex as any).add(private_key_tcomb.pubkey);
                cursor.continue();
            })
            .then(() => {
                this.pendingOperationDone();
            })
            .catch((error: any) => {
                reduxStore.dispatch(resetPrivateKeyState());
                this.privateKeyStorageError("loading", error);
                throw error;
            });
        resolve(p);
    }

    hasKey(pubkey: string) {
        return this.getState().keys.has(pubkey);
    }

    getPubkeys() {
        return this.getState().keys.keySeq().toArray();
    }

    getPubkeys_having_PrivateKey(pubkeys: any, addys: any = null) {
        const return_pubkeys: any[] = [];
        if (pubkeys) {
            for (const pubkey of pubkeys) {
                if (this.hasKey(pubkey)) {
                    return_pubkeys.push(pubkey);
                }
            }
        }
        if (addys) {
            const addresses = (AddressIndex as any).getState().addresses;
            for (const addy of addys) {
                const pubkey = addresses.get(addy);
                return_pubkeys.push(pubkey);
            }
        }
        return return_pubkeys;
    }

    getTcomb_byPubkey(public_key: any) {
        if (!public_key) return null;
        if (public_key.Q) public_key = public_key.toPublicKeyString();
        return this.getState().keys.get(public_key);
    }

    onAddKey({
        private_key_object,
        transaction,
        resolve
    }: {
        private_key_object: any;
        transaction: any;
        resolve: (p: any) => void;
    }) {
        if (this.getState().keys.has(private_key_object.pubkey)) {
            resolve({result: "duplicate", id: null});
            return;
        }

        this.pendingOperation();

        const keys = this.getState().keys.set(
            private_key_object.pubkey,
            (PrivateKeyTcomb as any)(private_key_object)
        );
        reduxStore.dispatch(setKeys(keys));
        (AddressIndex as any).add(private_key_object.pubkey);
        const p = new Promise((resolveInner) => {
            (PrivateKeyTcomb as any)(private_key_object);
            let duplicate = false;
            const p2 = idb_helper.add(
                transaction.objectStore("private_keys"),
                private_key_object,
                undefined
            );

            (p2 as any)
                .catch((event: any) => {
                    const error = event.target.error;
                    console.log("... error", error, event);
                    if (
                        error.name != "ConstraintError" ||
                        error.message.indexOf("by_encrypted_key") == -1
                    ) {
                        this.privateKeyStorageError("add_key", error);
                        throw event;
                    }
                    duplicate = true;
                    event.preventDefault();
                })
                .then(() => {
                    this.pendingOperationDone();
                    if (duplicate) return {result: "duplicate", id: null};
                    if (private_key_object.brainkey_sequence == null)
                        this.binaryBackupRecommended(); // non-deterministic
                    idb_helper.on_transaction_end(transaction).then(() => {
                        reduxStore.dispatch(setKeys(this.getState().keys));
                    });
                    return {
                        result: "added",
                        id: private_key_object.id
                    };
                });
            resolveInner(p2);
        });
        resolve(p);
    }

    /** WARN: does not update AddressIndex.  This is designed for bulk importing.
        @return duplicate_count
    */
    addPrivateKeys_noindex(private_key_objects: any, transaction: any) {
        const store = transaction.objectStore("private_keys");
        let duplicate_count = 0;
        const keys = this.getState().keys.withMutations((keys: any) => {
            for (const private_key_object of private_key_objects) {
                if (this.getState().keys.has(private_key_object.pubkey)) {
                    duplicate_count++;
                    continue;
                }
                const private_tcomb = (PrivateKeyTcomb as any)(
                    private_key_object
                );
                store.add(private_key_object);
                keys.set(private_key_object.pubkey, private_tcomb);
                (ChainStore as any).getAccountRefsOfKey(
                    private_key_object.pubkey
                );
            }
        });
        reduxStore.dispatch(setKeys(keys));
        this.binaryBackupRecommended();
        return duplicate_count;
    }

    private binaryBackupRecommended() {
        (CachedPropertyActions as any).set("backup_recommended", true);
    }

    private pendingOperation() {
        this.pending_operation_count++;
        reduxStore.dispatch(setPendingOperationCount(this.pending_operation_count));
    }

    private pendingOperationDone() {
        if (this.pending_operation_count == 0)
            throw new Error("Pending operation done called too many times");
        this.pending_operation_count--;
        reduxStore.dispatch(setPendingOperationCount(this.pending_operation_count));
    }

    private privateKeyStorageError(property: string, error: any) {
        this.pendingOperationDone();
        console.error("privateKeyStorage_error_" + property, error);
        reduxStore.dispatch(setPrivateKeyStorageError({property, error}));
    }

    decodeMemo(memo: any) {
        let memo_text,
            isMine = false;
        const from_private_key = this.getState().keys.get(memo.from);
        const to_private_key = this.getState().keys.get(memo.to);
        let private_key: any = from_private_key ? from_private_key : to_private_key;
        let public_key: any = from_private_key ? memo.to : memo.from;
        public_key = (PublicKey as any).fromPublicKeyString(public_key);

        try {
            private_key = (WalletDb as any).decryptTcomb_PrivateKey(private_key);
        } catch (e) {
            // Failed because wallet is locked
            private_key = null;
            isMine = true;
        }

        if (private_key) {
            let tryLegacy = false;
            try {
                memo_text = private_key
                    ? (Aes as any)
                          .decrypt_with_checksum(
                              private_key,
                              public_key,
                              memo.nonce,
                              memo.message
                          )
                          .toString("utf-8")
                    : null;

                if (private_key && !memo_text) {
                    // debugger
                }
            } catch (e) {
                console.log("transfer memo exception ...", e);
                memo_text = "*";
                tryLegacy = true;
            }

            // Apply legacy method if new, correct method fails to decode
            if (private_key && tryLegacy) {
                try {
                    memo_text = (Aes as any)
                        .decrypt_with_checksum(
                            private_key,
                            public_key,
                            memo.nonce,
                            memo.message,
                            true
                        )
                        .toString("utf-8");
                } catch (e) {
                    console.log("transfer memo exception ...", e);
                    memo_text = "**";
                }
            }
        }

        return {
            text: memo_text,
            isMine
        };
    }
}

export default new PrivateKeyStoreFacade();
