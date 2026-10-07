// Redux-backed replacement for the Alt.js AccountRefsStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 batch 8 - see
// `../store/reduxStore.ts`'s header for the overall migration approach).
// Tier 2 by association (cross-bound to `PrivateKeyActions.addKey`) but
// handles only public key strings and on-chain account ids, no key
// material.
//
// Preserves the exact interface every call site relies on - `getState()`,
// `listen()`, `unlisten()`, and the two directly-callable methods the
// original `_export()`ed (`loadDbData`, `getAccountRefs`) - plus
// `onAddPrivateKey`, now a plain public method (rather than
// bindListeners-private) so `../actions/PrivateKeyActions.ts` can call
// it directly: the original had BOTH this store and `PrivateKeyStore`
// bind a listener to the same `PrivateKeyActions.addKey` action (Alt's
// dispatcher fires every listener bound to an action regardless of which
// store owns it) - replicated by having the migrated
// `PrivateKeyActions.addKey` facade call both stores' handlers
// explicitly, same cross-notify pattern as the
// `TransactionConfirmStore`/`BalanceClaimActiveStore` batch.
//
// `no_account_refs`/`chainstore_account_ids_by_key`/
// `chainstore_account_ids_by_account` stay as plain instance fields on
// this facade singleton, never entering Redux state - same as the
// original's own class fields (none of them were ever part of
// `this.state`/read via `getState()`).
import {reduxStore} from "../store/reduxStore";
import iDB from "idb-instance";
import Immutable from "immutable";
import {ChainStore} from "bitsharesjs";
import {Apis} from "bitsharesjs-ws";
import PrivateKeyStore from "stores/PrivateKeyStore";
import chainIds from "chain/chainIds";
import {setAccountRefs, selectAccountRefsState} from "../store/slices/accountRefsSlice";

function loadNoAccountRefs() {
    const chain_id = (Apis as any).instance().chain_id;
    const refKey = `no_account_refs${
        !!chain_id ? "_" + chain_id.substr(0, 8) : ""
    }`;
    return (iDB as any).root
        .getProperty(refKey, [])
        .then((array: any) => Immutable.Set(array));
}

function saveNoAccountRefs(no_account_refs: any) {
    const array: any[] = [];
    const chain_id = (Apis as any).instance().chain_id;
    const refKey = `no_account_refs${
        !!chain_id ? "_" + chain_id.substr(0, 8) : ""
    }`;
    for (const pubkey of no_account_refs) array.push(pubkey);
    (iDB as any).root.setProperty(refKey, array);
}

class AccountRefsStoreFacade {
    private no_account_refs: any = Immutable.Set();
    private chainstore_account_ids_by_key: any = null;
    private chainstore_account_ids_by_account: any = null;
    private unsubscribers = new Map<() => void, () => void>();

    constructor() {
        (ChainStore as any).subscribe(this.chainStoreUpdate.bind(this));
    }

    getState() {
        return selectAccountRefsState(reduxStore.getState());
    }

    listen(callback: () => void) {
        let previous = selectAccountRefsState(reduxStore.getState());
        const unsubscribe = reduxStore.subscribe(() => {
            const next = selectAccountRefsState(reduxStore.getState());
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

    private _getChainId() {
        return (Apis as any).instance().chain_id || chainIds.MAIN_NET;
    }

    getAccountRefs(chainId: any = this._getChainId()) {
        return this.getState().account_refs.get(chainId, Immutable.Set());
    }

    onAddPrivateKey({private_key_object}: {private_key_object: any}) {
        if (
            (ChainStore as any).getAccountRefsOfKey(
                private_key_object.pubkey
            ) !== undefined
        )
            this.chainStoreUpdate();
    }

    loadDbData() {
        this.chainstore_account_ids_by_key = null;
        this.chainstore_account_ids_by_account = null;
        this.no_account_refs = Immutable.Set();

        let account_refs: any = new (Immutable as any).Map();
        account_refs = account_refs.set(this._getChainId(), Immutable.Set());
        reduxStore.dispatch(setAccountRefs(account_refs));
        return loadNoAccountRefs()
            .then((no_account_refs: any) => (this.no_account_refs = no_account_refs))
            .then(() => this.chainStoreUpdate());
    }

    private chainStoreUpdate() {
        if (
            this.chainstore_account_ids_by_key ===
                (ChainStore as any).account_ids_by_key &&
            this.chainstore_account_ids_by_account ===
                (ChainStore as any).account_ids_by_account
        )
            return;
        this.chainstore_account_ids_by_key = (ChainStore as any).account_ids_by_key;
        this.chainstore_account_ids_by_account = (
            ChainStore as any
        ).account_ids_by_account;
        this.checkPrivateKeyStore();
    }

    private checkPrivateKeyStore() {
        let no_account_refs = this.no_account_refs;
        let temp_account_refs = Immutable.Set();
        (PrivateKeyStore as any)
            .getState()
            .keys.keySeq()
            .forEach((pubkey: string) => {
                if (no_account_refs.has(pubkey)) return;
                const refs = (ChainStore as any).getAccountRefsOfKey(pubkey);
                if (refs === undefined) return;
                if (!refs.size) {
                    // Performance optimization...
                    // There are no references for this public key, this is going
                    // to block it.  There many be many TITAN keys that do not have
                    // accounts for example.
                    {
                        // Do Not block brainkey generated keys.. Those are new and
                        // account references may be pending.
                        const private_key_object = (PrivateKeyStore as any)
                            .getState()
                            .keys.get(pubkey);
                        if (
                            typeof private_key_object.brainkey_sequence ===
                            "number"
                        ) {
                            return;
                        }
                    }
                    no_account_refs = no_account_refs.add(pubkey);
                    return;
                }
                temp_account_refs = temp_account_refs.add(refs.valueSeq());
            });
        temp_account_refs = (temp_account_refs as any).flatten();

        /* Discover accounts referenced by account name in permissions */
        temp_account_refs.forEach((account: any) => {
            const refs = (ChainStore as any).getAccountRefsOfAccount(account);
            if (refs === undefined) return;
            if (!refs.size) return;
            temp_account_refs = temp_account_refs.add(refs.valueSeq());
        });
        temp_account_refs = (temp_account_refs as any).flatten();
        if (!this.getAccountRefs().equals(temp_account_refs)) {
            const account_refs = this.getState().account_refs.set(
                this._getChainId(),
                temp_account_refs
            );
            reduxStore.dispatch(setAccountRefs(account_refs));
        }
        if (!this.no_account_refs.equals(no_account_refs)) {
            this.no_account_refs = no_account_refs;
            saveNoAccountRefs(no_account_refs);
        }
    }
}

export default new AccountRefsStoreFacade();
