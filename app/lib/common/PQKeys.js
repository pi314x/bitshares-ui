import {PQPrivateKey, PQKemPrivateKey, hash} from "bitsharesjs/es/ecc";
import {ChainStore} from "bitsharesjs";
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
    const seed = hash.sha256(
        Buffer.from(accountName + "pq" + rootSecret, "utf-8")
    );
    const pq = PQPrivateKey.fromSeed(seed);
    _cache.set(cacheKey, pq);
    return pq;
}

/**
 * Derive the account's post-quantum MEMO key.
 *
 * Separate from the signing key above, and deliberately so. A signing key only has to resist
 * forgery until its transaction confirms, and an account can re-key at any time. A memo is
 * encrypted once and stays on the chain forever, so anyone archiving traffic today reads it
 * the day secp256k1 falls -- and nothing done afterwards makes it unreadable again. Of
 * everything post-quantum here, this is the part that cannot be fixed later.
 *
 * sha512, not sha256: ML-KEM keygen takes a 64-byte seed. The role string differs from the
 * signing key's so the two are independent even though both come from the one root secret.
 *
 * @returns PQKemPrivateKey, or null if either argument is missing
 */
export function derivePQMemoKey(accountName, rootSecret) {
    if (!accountName || !rootSecret) return null;
    const cacheKey = "memo|" + accountName + "|" + rootSecret;
    if (_cache.has(cacheKey)) return _cache.get(cacheKey);

    const seed = hash.sha512(
        Buffer.from(accountName + "pqmemo" + rootSecret, "utf-8")
    );
    const kem = PQKemPrivateKey.fromSeed(seed);
    _cache.set(cacheKey, kem);
    return kem;
}

/**
 * The memo key an account has published, as a base58 string, or null.
 *
 * Its absence is what tells a sender to use the classical memo path, so "no key" has to be
 * distinguishable from "could not load the account" -- both return null here, and callers
 * must have the account loaded before asking.
 */
export function accountPQMemoKey(accountName) {
    const acct = ChainStore.getAccount(accountName, false);
    if (!acct) return null;
    return acct.getIn(["options", "pq_memo_key"]) || null;
}

/**
 * Whether this wallet can read memos sent to the account's published memo key.
 *
 * Used before publishing: a memo key that senders can encrypt to but the recipient cannot
 * decapsulate with is worse than none at all, because it silently converts readable memos
 * into unreadable ones.
 */
export function canReadPQMemos(accountName, rootSecret) {
    const published = accountPQMemoKey(accountName);
    if (!published) return false;
    const kem = derivePQMemoKey(accountName, rootSecret);
    if (!kem) return false;
    try {
        return kem.toPublicKey().toPublicKeyString() === published;
    } catch (e) {
        return false;
    }
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
        // The binding constraint is not attaching the key, it is USING it afterwards.
        //
        // Measured against the serializer: attaching a 1952-byte key with a classical
        // signature is about 2.1 kB, so 4 kB would be enough for that one transaction. But
        // every transaction the key then signs carries the key AND a 3309-byte ML-DSA
        // signature -- a bare transfer comes to 5.4 kB, and 6.5 kB with a hybrid memo.
        //
        // Allowing the attach at 4 kB would hand the user a key that cannot sign anything,
        // and if they went on to drop their classical keys the account would be locked out
        // entirely. So the bar is what it takes to use the key, not to publish it.
        if (limit < 8192) return {ok: false, reason: "transaction_size", limit};
        return {ok: true, reason: null, limit};
    } catch (e) {
        return {ok: false, reason: "unreachable", limit: 0};
    }
}

export default {
    derivePQKey,
    derivePQMemoKey,
    accountPQMemoKey,
    canReadPQMemos,
    forgetPQKeys,
    accountPQKeys,
    pqSignerFor,
    canPublish
};
