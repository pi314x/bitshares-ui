// Redux-backed replacement for the Alt.js BrainkeyStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../store/reduxStore.ts`'s
// header for the overall migration approach). Tier 2, the most
// security-sensitive store migrated so far (AGENTS.md): `derived_keys`
// holds real private key objects (derived from the raw brainkey phrase
// via `key.get_brainPrivateKey`) in memory. Preserved exactly as the
// original did - a plain instance field on each per-name facade object
// below, NEVER entering Redux state, NEVER logged, NEVER persisted.
// `state.brnkey` (the raw brainkey phrase) and `state.account_ids` DO
// flow through Redux state, same as the original exposed them via
// `getState()`/`listen()` through Alt - not a new exposure introduced by
// this migration, the same risk profile the original already had (the
// UI genuinely needs to read the brainkey phrase back to display it
// during the "write this down" flow).
//
// The original was a *factory* (`BrainkeyStoreFactory.getInstance(name)`
// creates/returns a real Alt store per `name`, `closeInstance(name)`
// tears it down) - every real call site (`Wallet/Brainkey.tsx`) only
// ever uses the name `"wmc"`, but the general multi-instance shape is
// preserved here rather than narrowed to a singleton, since
// `BrainkeyActions.setBrainkey(brnkey)` (called with no name argument)
// broadcasts to every currently-registered instance under real Alt
// (every instance's constructor binds the SAME shared
// `BrainkeyActions.setBrainkey`) - replicated via `notifySetBrainkey`
// below, called by `../actions/BrainkeyActions.ts`.
import {reduxStore} from "../store/reduxStore";
import {ChainStore, key} from "bitsharesjs";
import Immutable from "immutable";
import {
    clearInstanceCache,
    setBrnkey,
    setAccountIds,
    selectBrainkeyInstanceState
} from "../store/slices/brainkeySlice";

/** Each instance supports a single brainkey. */
const DERIVIED_BRAINKEY_POOL_SIZE = 10;

function derivedKeyStruct(private_key: any) {
    const public_string = private_key.toPublicKey().toPublicKeyString();
    return {private_key, public_string};
}

const isPendingFromChain = (derived_key: any) =>
    (ChainStore as any).getAccountRefsOfKey(derived_key.public_string) ===
    undefined;

class BrainkeyInstanceFacade {
    private name: string;
    private derived_keys: any[] = [];
    private account_ids_by_key: any = null;
    private unsubscribers = new Map<() => void, () => void>();

    constructor(name: string) {
        this.name = name;
    }

    getState() {
        return selectBrainkeyInstanceState(reduxStore.getState(), this.name);
    }

    listen(callback: () => void) {
        let previous = selectBrainkeyInstanceState(
            reduxStore.getState(),
            this.name
        );
        const unsubscribe = reduxStore.subscribe(() => {
            const next = selectBrainkeyInstanceState(
                reduxStore.getState(),
                this.name
            );
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

    clearCache() {
        reduxStore.dispatch(clearInstanceCache({name: this.name}));
        this.derived_keys = [];
        // Compared with ChainStore.account_ids_by_key
        this.account_ids_by_key = null;
    }

    /** Saves the brainkey and begins the lookup for derived account referneces */
    onSetBrainkey(brnkey: string) {
        this.clearCache();
        reduxStore.dispatch(setBrnkey({name: this.name, brnkey}));
        this.deriveKeys(brnkey);
        this.chainStoreUpdate();
    }

    /** @return <b>true</b> when all derivied account references are either
        found or known not to exist.

        Preserved verbatim from the original: the `forEach` callback's
        `return false` is discarded by `Array.prototype.forEach` (it
        can't short-circuit the loop or this method's own return value),
        so this always returns `true` regardless of
        `isPendingFromChain`'s results - a pre-existing bug, not
        introduced here. Not fixed (not called by any real call site
        today, grep-confirmed) - same "preserve odd/buggy logic exactly"
        convention as every other migrated store/actions pair.
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

    private deriveKeys(brnkey: string = this.getState().brnkey) {
        const sequence = this.derived_keys.length; // next sequence (starting with 0)
        const private_key = (key as any).get_brainPrivateKey(brnkey, sequence);
        const derived_key = derivedKeyStruct(private_key);
        this.derived_keys.push(derived_key);
        if (this.derived_keys.length < DERIVIED_BRAINKEY_POOL_SIZE)
            this.deriveKeys(brnkey);
    }

    private updateAccountIds() {
        const new_account_ids = Immutable.Set().withMutations((new_ids: any) => {
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
        if (!new_account_ids.equals(this.getState().account_ids)) {
            reduxStore.dispatch(
                setAccountIds({name: this.name, account_ids: new_account_ids})
            );
        }
    }
}

export default class BrainkeyStoreFactory {
    static instances = new Map<string, any>();
    /** This may be called multiple times for the same <b>name</b>.  When done,
        (componentWillUnmount) make sure to call this.closeInstance()
    */
    static getInstance(name: string) {
        let instance = BrainkeyStoreFactory.instances.get(name);
        if (!instance) {
            instance = new BrainkeyInstanceFacade(name);
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

    /** Broadcasts a new brainkey to every currently-registered instance,
        matching the original's behavior of every instance's constructor
        binding the same shared `BrainkeyActions.setBrainkey` action.
        Called by `../actions/BrainkeyActions.ts`, not by any UI code
        directly. */
    static notifySetBrainkey(brnkey: string) {
        BrainkeyStoreFactory.instances.forEach((instance, key) => {
            if (key.endsWith(" subscribed_instance")) return;
            instance.onSetBrainkey(brnkey);
        });
    }
}
