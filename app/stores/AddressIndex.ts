// Redux-backed replacement for the Alt.js AddressIndex store
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../store/reduxStore.ts`'s
// header for the overall migration approach). Tier 2 (AGENTS.md) by
// association - a direct dependency of `WalletDb.ts`/`PrivateKeyStore`/
// `AccountStore` - but not itself key material: `addresses` maps a
// derived legacy address string to the PUBLIC key string it came from
// (`key.addresses(pubkey)`, a one-way/public operation), never a private
// key. Migrated with the same care as every Tier 2 store regardless.
//
// Preserves the exact interface every call site relies on -
// `getState().addresses`, `listen(callback)`, `unlisten(callback)`, and
// the 3 directly-callable methods the original `_export()`ed (`add`,
// `addAll`, `loadAddyMap` - not Alt-dispatched via a separate Actions
// file, called straight on the store singleton by `PrivateKeyStore`/
// `WalletDb.ts`/`AccountStore`/`AccountPermissionsList.tsx`) - every one
// confirmed via grep to only ever call `.getState()` once imperatively,
// never `.listen()`, so the facade's `listen()`/`unlisten()` exist for
// interface completeness/future-proofing, matching every other migrated
// store, not because a current call site needs them.
//
// `pubkeys` (a plain `Set`, pure in-memory dedup bookkeeping - never
// part of `this.state`/read via `getState()` in the original either)
// and `loadAddyMapPromise`/`saveAddyMapTimeout` stay as plain instance
// fields on this facade singleton, never entering Redux state - same as
// the original class fields.
import {reduxStore} from "../store/reduxStore";
import {key} from "bitsharesjs";
import {ChainConfig} from "bitsharesjs-ws";
import Immutable from "immutable";
import iDB from "idb-instance";
import {
    setSaving,
    setAddresses,
    selectAddressIndexState
} from "../store/slices/addressIndexSlice";

let AddressIndexWorker: any;
if (__ELECTRON__) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    AddressIndexWorker = require("worker-loader?inline=no-fallback!workers/AddressIndexWorker")
        .default;
}

class AddressIndexFacade {
    private pubkeys = new Set<string>();
    private loadAddyMapPromise: Promise<void> | null = null;
    private saveAddyMapTimeout: any;
    private unsubscribers = new Map<() => void, () => void>();

    getState() {
        return selectAddressIndexState(reduxStore.getState());
    }

    listen(callback: () => void) {
        let previous = selectAddressIndexState(reduxStore.getState());
        const unsubscribe = reduxStore.subscribe(() => {
            const next = selectAddressIndexState(reduxStore.getState());
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

    private saving() {
        if (this.getState().saving) return;
        reduxStore.dispatch(setSaving(true));
    }

    add(pubkey: string) {
        this.loadAddyMap()
            .then(() => {
                let dirty = false;
                if (this.pubkeys.has(pubkey)) return;
                this.pubkeys.add(pubkey);
                this.saving();
                const address_strings = (key as any).addresses(pubkey);
                let addresses = this.getState().addresses;
                for (const address of address_strings) {
                    addresses = addresses.set(address, pubkey);
                    dirty = true;
                }
                if (dirty) {
                    reduxStore.dispatch(setAddresses(addresses));
                    this.saveAddyMap();
                } else {
                    reduxStore.dispatch(setSaving(false));
                }
            })
            .catch((e: any) => {
                throw e;
            });
    }

    addAll(pubkeys: string[]) {
        return new Promise<void>((resolve, reject) => {
            this.saving();
            this.loadAddyMap()
                .then(() => {
                    if (!__ELECTRON__) {
                        // eslint-disable-next-line @typescript-eslint/no-var-requires
                        AddressIndexWorker = require("worker-loader!workers/AddressIndexWorker")
                            .default;
                    }
                    const worker = new AddressIndexWorker();
                    worker.postMessage({
                        pubkeys,
                        address_prefix: ChainConfig.address_prefix
                    });
                    worker.onmessage = (event: any) => {
                        try {
                            const key_addresses = event.data;
                            let dirty = false;
                            const addresses = this.getState().addresses.withMutations(
                                (addresses: any) => {
                                    for (let i = 0; i < pubkeys.length; i++) {
                                        const pubkey = pubkeys[i];
                                        if (this.pubkeys.has(pubkey)) continue;
                                        this.pubkeys.add(pubkey);
                                        const address_strings = key_addresses[i];
                                        for (const address of address_strings) {
                                            addresses.set(address, pubkey);
                                            dirty = true;
                                        }
                                    }
                                }
                            );
                            if (dirty) {
                                reduxStore.dispatch(setAddresses(addresses));
                                this.saveAddyMap();
                            } else {
                                reduxStore.dispatch(setSaving(false));
                            }
                            resolve();
                        } catch (e) {
                            console.error("AddressIndex.addAll", e);
                            reject(e);
                        }
                    };
                })
                .catch((e: any) => {
                    throw e;
                });
        });
    }

    loadAddyMap(): Promise<void> {
        if (this.loadAddyMapPromise) return this.loadAddyMapPromise;
        this.loadAddyMapPromise = (iDB as any).root
            .getProperty("AddressIndex")
            .then((map: any) => {
                const addresses: any = map ? Immutable.Map(map) : Immutable.Map();
                addresses.valueSeq().forEach((pubkey: string) => this.pubkeys.add(pubkey));
                reduxStore.dispatch(setAddresses(addresses));
            });
        return this.loadAddyMapPromise as Promise<void>;
    }

    private saveAddyMap() {
        clearTimeout(this.saveAddyMapTimeout);
        this.saveAddyMapTimeout = setTimeout(() => {
            reduxStore.dispatch(setSaving(false));
            return (iDB as any).root.setProperty(
                "AddressIndex",
                this.getState().addresses.toObject()
            );
        }, 100);
    }
}

export default new AddressIndexFacade();
