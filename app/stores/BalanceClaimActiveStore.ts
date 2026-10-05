// Redux-backed replacement for the Alt.js BalanceClaimActiveStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../store/reduxStore.ts`'s
// header for the overall migration approach). Preserves the exact
// Alt-store interface every call site already relies on - `getState()`,
// `listen(callback)`, `unlisten(callback)`, plus the original's plain
// (non-`onXxx`) `reset()` method, exported via Alt's `BaseStore._export`
// - so every `useAltStore(BalanceClaimActiveStore)` hook caller and
// every remaining direct caller (`WalletManagerStore.js`'s
// `BalanceClaimActiveStore.reset()`) keeps working completely unchanged.
//
// The original store's handlers (`onSetPubkeys`, `onSetSelectedBalanceClaims`,
// `onClaimAccountChange`, `onTransactionBroadcasted`) do real orchestration
// - async chain/DB lookups, calling other instance methods that
// themselves call `setState` more than once - not a single pure state
// transition, so (per `../store/slices/balanceClaimActiveSlice.ts`'s
// header) that orchestration is reproduced here verbatim as plain
// methods, dispatching the slice's generic `patchState`/`resetState`
// actions wherever the original called `this.setState(...)`. The
// `BalanceClaimActiveActions` facade (`../actions/BalanceClaimActiveActions.ts`)
// calls these methods directly, at the exact point Alt's dispatcher used
// to invoke them via `bindListeners`.
//
// `pubkeys`/`addresses`/`no_balance_address` are plain instance fields
// here, exactly like they were plain instance fields (not part of
// `this.state`) on the original Alt store instance - a single facade
// instance is exported below (singleton, like `alt.createStore` produces).
import Immutable from "immutable";
import {key} from "bitsharesjs";
import {Apis} from "bitsharesjs-ws";
import iDB from "idb-instance";
import {reduxStore} from "../store/reduxStore";
import {
    patchState,
    resetState,
    createInitialViewState,
    selectBalanceClaimActive,
    BalanceClaimActiveState
} from "../store/slices/balanceClaimActiveSlice";

class BalanceClaimActiveStoreFacade {
    private pubkeys: any = null;
    private addresses: Set<string> = new Set();
    private no_balance_address: Set<string> = new Set(); // per chain
    private unsubscribers = new Map<() => void, () => void>();

    getState(): BalanceClaimActiveState {
        return selectBalanceClaimActive(reduxStore.getState());
    }

    listen(callback: () => void) {
        let previous = selectBalanceClaimActive(reduxStore.getState());
        const unsubscribe = reduxStore.subscribe(() => {
            const next = selectBalanceClaimActive(reduxStore.getState());
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

    /** Reset for each wallet load or change */
    reset() {
        // _getInitialState() also resets these two instance fields,
        // besides returning the fresh state object.
        this.pubkeys = null;
        this.addresses = new Set();
        reduxStore.dispatch(resetState());
    }

    // onSetPubkeys(pubkeys) - bound to BalanceClaimActiveActions.setPubkeys.
    // param: Immutable Seq or array
    onSetPubkeys(pubkeys: any) {
        if (Array.isArray(pubkeys)) pubkeys = Immutable.Seq(pubkeys);
        if (this.pubkeys && this.pubkeys.equals(pubkeys)) return;
        this.reset();
        this.pubkeys = pubkeys;
        if (pubkeys.size === 0) {
            reduxStore.dispatch(patchState({loading: false}));
            return true;
        }
        reduxStore.dispatch(patchState({loading: true}));
        this.loadNoBalanceAddresses()
            .then(() => {
                this.indexPubkeys(pubkeys);
                this.refreshBalances();
                return false;
            })
            .catch((error: any) => console.error(error));
        return undefined;
    }

    // onSetSelectedBalanceClaims(checked) - bound to
    // BalanceClaimActiveActions.setSelectedBalanceClaims.
    onSetSelectedBalanceClaims(checked: any) {
        const selected_balances = checked
            .valueSeq()
            .flatten()
            .toSet();
        reduxStore.dispatch(patchState({checked, selected_balances}));
    }

    // onClaimAccountChange(claim_account_name) - bound to
    // BalanceClaimActiveActions.claimAccountChange.
    onClaimAccountChange(claim_account_name: any) {
        reduxStore.dispatch(patchState({claim_account_name}));
    }

    // onTransactionBroadcasted() - cross-bound to
    // TransactionConfirmActions.wasBroadcast (see
    // ../actions/TransactionConfirmActions.ts for how the cross-store
    // notification is now wired explicitly). Balance claims are included
    // in a block... chainStoreUpdate did not include removal of balance
    // claim objects. This is a hack to refresh balance claims after a
    // transaction.
    onTransactionBroadcasted() {
        this.refreshBalances();
    }

    private loadNoBalanceAddresses(): Promise<void> {
        if (this.no_balance_address.size) return Promise.resolve();
        return (iDB as any).root
            .getProperty("no_balance_address", [])
            .then((array: string[]) => {
                this.no_balance_address = new Set(array);
            });
    }

    private indexPubkeys(pubkeys: any) {
        const {address_to_pubkey} = this.getState();

        for (const pubkey of pubkeys) {
            for (const address_string of key.addresses(pubkey)) {
                if (!this.no_balance_address.has(address_string)) {
                    // AddressIndex indexes all addresses .. Here only 1
                    // address is involved
                    address_to_pubkey.set(address_string, pubkey);
                    this.addresses.add(address_string);
                }
            }
        }
        reduxStore.dispatch(patchState({address_to_pubkey}));
    }

    private indexPubkey(pubkey: any) {
        const {address_to_pubkey} = this.getState();
        for (const address_string of key.addresses(pubkey)) {
            if (!this.no_balance_address.has(address_string)) {
                // AddressIndex indexes all addresses .. Here only 1
                // address is involved
                address_to_pubkey.set(address_string, pubkey);
                this.addresses.add(address_string);
            }
        }
        reduxStore.dispatch(patchState({address_to_pubkey}));
    }

    private refreshBalances() {
        this.lookupBalanceObjects().then((balances: any) => {
            const state = createInitialViewState() as Partial<
                BalanceClaimActiveState
            >;
            state.balances = balances;
            state.loading = false;
            reduxStore.dispatch(patchState(state));
        });
    }

    /** @return Promise.resolve(balances) */
    private lookupBalanceObjects(): Promise<any> {
        const db = (Apis as any).instance().db_api();
        const no_balance_address = new Set(this.no_balance_address);
        const no_bal_size = no_balance_address.size;
        for (const addy of this.addresses) no_balance_address.add(addy);
        // for(let addy of this.addresses) ChainStore.getBalanceObjects(addy) // Test with ChainStore
        return db
            .exec("get_balance_objects", [Array.from(this.addresses)])
            .then((result: any[]) => {
                const balance_ids: any[] = [];
                for (const balance of result) balance_ids.push(balance.id);
                return db
                    .exec("get_vested_balances", [balance_ids])
                    .then((vested_balances: any[]) => {
                        const balances = Immutable.List().withMutations(
                            (balance_list: any) => {
                                for (let i = 0; i < result.length; i++) {
                                    const balance = result[i];
                                    no_balance_address.delete(balance.owner);
                                    if (balance.vesting_policy)
                                        balance.vested_balance =
                                            vested_balances[i];
                                    balance_list.push(balance);
                                }
                                if (no_bal_size !== no_balance_address.size)
                                    this.saveNoBalanceAddresses(
                                        no_balance_address
                                    ).catch((error: any) =>
                                        console.error(error)
                                    );
                            }
                        );
                        return balances;
                    });
            });
    }

    private saveNoBalanceAddresses(
        no_balance_address: Set<string>
    ): Promise<void> {
        this.no_balance_address = no_balance_address;
        const array: string[] = [];
        for (const addy of this.no_balance_address) array.push(addy);
        return (iDB as any).root.setProperty("no_balance_address", array);
    }
}

export const BalanceClaimActiveStoreWrapped = new BalanceClaimActiveStoreFacade();
export default BalanceClaimActiveStoreWrapped;
