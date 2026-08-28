import {PQPrivateKey} from "bitsharesjs/es/ecc";
import {ChainStore, key} from "bitsharesjs";
import {Apis} from "bitsharesjs-ws";

/**
 * Post-quantum signing keys for the wallet.
 *
 * The chain has supported ML-DSA authorities since the PQ hardfork work, but nothing in this
 * wallet could produce one: no PQ key in the key store, no PQ signer in the signing path.
 * This module is that missing half.
 *
 * ## Where the key comes from, and why not from the active key
 *
 * The obvious derivation -- hash the account's active private key -- is wrong, and wrong
 * precisely in the case that matters. An account whose active authority is PQ-only has no
 * classic active key at all; that is the whole point of moving to post-quantum. Deriving from
 * it would work for every account except the ones this feature exists for.
 *
 * So the key is derived from the wallet's own root secret, the same one the account's classic
 * keys come from:
 *
 *   password login:  seed = sha256( accountName + "pq" + password )
 *   local wallet:    seed = sha256( accountName + "pq" + brainkey )
 *
 * Same shape as WalletDb.generateKeyFromPassword, with "pq" where the role goes. Nothing new
 * to back up: whatever restores the account also restores its PQ key, and a wallet that has
 * lost the root secret has lost the account regardless.
 */

const _cache = new Map();

/**
 * Derive the PQ key for an account from the wallet's root secret.
 *
 * @param accountName the account the key belongs to
 * @param rootSecret  the password (cloud login) or brainkey (local wallet)
 * @returns PQPrivateKey, or null if either argument is missing
 */
export function derivePQKey(accountName, rootSecret) {
    if (!accountName || !rootSecret) return null;
    const cacheKey = accountName + "|" + rootSecret;
    if (_cache.has(cacheKey)) return _cache.get(cacheKey);

    // sha256 of the same "account + role + secret" shape the classic keys use, so the PQ key
    // is one more derived key rather than a separate secret.
    const seed = key.sha256(
        Buffer.from(accountName + "pq" + rootSecret, "utf-8")
    );
    const pq = PQPrivateKey.fromSeed(seed);
    _cache.set(cacheKey, pq);
    return pq;
}

/// Forget cached keys. Called on lock, so a locked wallet holds no PQ secret in memory.
export function forgetPQKeys() {
    _cache.clear();
}

/**
 * The PQ keys an account's active authority names, as base58 strings.
 * Empty when the account has none, which is the normal case today.
 */
export function accountPQKeys(accountName) {
    const acct = ChainStore.getAccount(accountName, false);
    if (!acct) return [];
    const auths = acct.getIn(["active", "pq_key_auths"]);
    if (!auths || auths.size === 0) return [];
    return auths.toJS().map(entry => entry[0]);
}

/**
 * Whether a key we hold is one the account's authority accepts.
 * @returns the matching PQPrivateKey, or null.
 */
export function pqSignerFor(accountName, rootSecret) {
    const onChain = accountPQKeys(accountName);
    if (!onChain.length) return null;
    const pq = derivePQKey(accountName, rootSecret);
    if (!pq) return null;
    let mine;
    try {
        mine = pq.toPublicKey().toPublicKeyString();
    } catch (e) {
        return null;
    }
    return onChain.indexOf(mine) >= 0 ? pq : null;
}

/**
 * Whether attaching a PQ key can succeed on the chain this wallet is connected to.
 *
 * Three consensus-level conditions, none of them under the user's control, and all three
 * have to hold before the button is worth offering:
 *   - the PQ_0 hardfork has passed and the committee enabled pq_serialization_active
 *   - maximum_transaction_size leaves room for a 1952-byte key
 *
 * Reporting this up front beats letting the attempt fail with a size error nobody can read.
 *
 * @returns {Promise<{ok: boolean, reason: ?string, limit: number}>}
 */
export async function canPublish() {
    try {
        const gp = await Apis.instance()
            .db_api()
            .exec("get_global_properties", []);
        const ext = gp.parameters.extensions || {};
        const limit = gp.parameters.maximum_transaction_size;
        if (!ext.pq_serialization_active) {
            return {ok: false, reason: "not_activated", limit};
        }
        // 1952 bytes of key plus the rest of an account_update. Under about 4 kB there is no
        // useful headroom; the historical default of 2048 cannot fit the key alone.
        if (limit < 4096) return {ok: false, reason: "transaction_size", limit};
        return {ok: true, reason: null, limit};
    } catch (e) {
        return {ok: false, reason: "unreachable", limit: 0};
    }
}

export default {
    derivePQKey,
    forgetPQKeys,
    accountPQKeys,
    pqSignerFor,
    canPublish
};
