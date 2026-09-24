// TypeScript port of the legacy BrainkeyStore.js (Phase 5,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes. Security-
// sensitive per AGENTS.md: `derived_keys` holds real private key objects
// (derived from the brainkey via `key.get_brainPrivateKey`) in memory,
// matching the original's existing behavior exactly - never logged,
// never persisted, never added to beyond what was already stored here.
//
// Already-commented-out `chainStoreUnsubscribe()` method kept as-is
// (informationally inert, matching this migration's established
// handling of dead code that's already commented out in the source).
import alt from "alt-instance";
import Immutable from "immutable";
import {ChainStore, key} from "bitsharesjs";
import BaseStore from "stores/BaseStore";
import BrainkeyActions from "actions/BrainkeyActions";

/** Each instance supports a single brainkey. */
export default class BrainkeyStoreFactory {
    static instances = new Map<string, any>();
    /** This may be called multiple times for the same <b>name</b>.  When done,
        (componentWillUnmount) make sure to call this.closeInstance()
    */
    static getInstance(name: string) {
        let instance = BrainkeyStoreFactory.instances.get(name);
        if (!instance) {
            instance = (alt as any).createStore(
                BrainkeyStoreImpl,
                "BrainkeyStore"
            );
            BrainkeyStoreFactory.instances.set(name, instance);
        }
        const subscribed_instance_key = name + " subscribed_instance";
        if (!BrainkeyStoreFactory.instances.get(subscribed_instance_key)) {
            const subscribed_instance = instance.chainStoreUpdate.bind(
                instance
            );
            (ChainStore as any).subscribe(subscribed_instance);
            BrainkeyStoreFactory.instances.set(
                subscribed_instance_key,
                subscribed_instance
            );
        }
        return instance;
    }
    static closeInstance(name: string) {
        const instance = BrainkeyStoreFactory.instances.get(name);
        if (!instance) throw new Error("unknown instance " + name);
        const subscribed_instance_key = name + " subscribed_instance";
        const subscribed_instance = BrainkeyStoreFactory.instances.get(
            subscribed_instance_key
        );
        BrainkeyStoreFactory.instances.delete(subscribed_instance_key);
        (ChainStore as any).unsubscribe(subscribed_instance);
        instance.clearCache();
    }
}

/** Derived keys may be unassigned from accounts therefore we must define a
    fixed block of derivied keys then monitor the entire block.
*/
const DERIVIED_BRAINKEY_POOL_SIZE = 10;

class BrainkeyStoreImpl extends (BaseStore as any) {
    state: any;
    derived_keys: any[] = [];
    account_ids_by_key: any = null;

    constructor() {
        super();
        this.clearCache();
        this.bindListeners({
            onSetBrainkey: (BrainkeyActions as any).setBrainkey
        });
        this._export("inSync", "chainStoreUpdate", "clearCache");
    }

    clearCache() {
        this.state = {
            brnkey: "",
            account_ids: Immutable.Set()
        };
        this.derived_keys = [];
        // Compared with ChainStore.account_ids_by_key
        this.account_ids_by_key = null;
    }

    /** Saves the brainkey and begins the lookup for derived account referneces */
    onSetBrainkey(brnkey: string) {
        this.clearCache();
        this.setState({brnkey});
        this.deriveKeys(brnkey);
        this.chainStoreUpdate();
    }

    /** @return <b>true</b> when all derivied account references are either
        found or known not to exist.
    */
    inSync() {
        this.derived_keys.forEach((derived_key: any) => {
            if (isPendingFromChain(derived_key)) return false;
        });
        return true;
    }

    chainStoreUpdate() {
        if (!this.derived_keys.length) return;
        if (this.account_ids_by_key === (ChainStore as any).account_ids_by_key)
            return;
        this.account_ids_by_key = (ChainStore as any).account_ids_by_key;
        this.updateAccountIds();
    }

    deriveKeys(brnkey: string = this.state.brnkey) {
        const sequence = this.derived_keys.length; // next sequence (starting with 0)
        const private_key = (key as any).get_brainPrivateKey(brnkey, sequence);
        const derived_key = derivedKeyStruct(private_key);
        this.derived_keys.push(derived_key);
        if (this.derived_keys.length < DERIVIED_BRAINKEY_POOL_SIZE)
            this.deriveKeys(brnkey);
    }

    updateAccountIds() {
        const new_account_ids = Immutable.Set().withMutations(new_ids => {
            const updatePubkey = (public_string: string) => {
                const chain_account_ids = (ChainStore as any).getAccountRefsOfKey(
                    public_string
                );
                if (chain_account_ids)
                    chain_account_ids.forEach((chain_account_id: any) => {
                        new_ids.add(chain_account_id);
                    });
            };
            this.derived_keys.forEach((derived_key: any) =>
                updatePubkey(derived_key.public_string)
            );
        });
        if (!new_account_ids.equals(this.state.account_ids)) {
            this.state.account_ids = new_account_ids;
            this.setState({account_ids: new_account_ids});
        }
    }
}

function derivedKeyStruct(private_key: any) {
    const public_string = private_key.toPublicKey().toPublicKeyString();
    const derived_key = {private_key, public_string};
    return derived_key;
}

const isPendingFromChain = (derived_key: any) =>
    (ChainStore as any).getAccountRefsOfKey(derived_key.public_string) ===
    undefined;
