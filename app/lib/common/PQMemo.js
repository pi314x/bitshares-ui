import {Aes, PQPublicKey} from "bitsharesjs/es/ecc";
import {pq_format} from "bitsharesjs/es/serializer";

/**
 * Hybrid post-quantum memos.
 *
 * Of everything post-quantum in this wallet, memos are the part that cannot be repaired
 * later. A signature only has to hold until its transaction confirms, and an account can
 * migrate its keys the day before a break. A memo is encrypted once and stored on chain
 * forever: whatever is written under classical ECDH today becomes readable the moment
 * secp256k1 falls, and no migration afterwards undoes that.
 *
 * The construction is hybrid, not post-quantum alone -- the AES key comes from the ECDH
 * secret and the ML-KEM secret together, so an attacker has to defeat both. That keeps it no
 * weaker than today's memo if this KEM turns out to be flawed.
 *
 * Two rules run through everything here, and both are about not making things worse:
 *
 *  1. Never write a hybrid memo unless the chain has PQ serialization active. The ciphertext
 *     field is stripped on the wire before activation, and the KEM secret is half the AES
 *     key -- so such a memo would confirm on chain and be permanently unreadable, by the
 *     recipient, the sender, and everyone else.
 *
 *  2. Never publish a memo key this wallet cannot decapsulate with. Senders would start
 *     encrypting to it immediately, turning readable memos into unreadable ones.
 */

/**
 * Whether the chain accepts post-quantum fields right now.
 *
 * This deliberately reads the serializer's own format flag rather than asking the node
 * again. The two questions have to give the same answer: pq_gated drops the ciphertext
 * field entirely in legacy format, so a memo encrypted as hybrid while the serializer is
 * in legacy would go on chain with its ciphertext missing -- confirmed, and unreadable by
 * everyone including the sender. Asking one source removes the possibility of the two
 * disagreeing. routerTransition sets it from the chain on every connect.
 *
 * Async only so callers need not care where the answer comes from.
 */
export async function isPQActive() {
    return pq_format.isCurrent();
}

/**
 * Build the memo object for a transfer, hybrid when possible and classical otherwise.
 *
 * @param toMemoKey the recipient's published pq_memo_key (base58), or null
 * @returns the memo object, with `pq_ciphertext` present only when the memo is hybrid
 */
export function buildMemo({
    fromPrivate,
    fromPublic,
    toPublic,
    nonce,
    message,
    toMemoKey,
    pqActive
}) {
    if (toMemoKey && pqActive) {
        let kemPub;
        try {
            kemPub = PQPublicKey.fromPublicKeyString(toMemoKey);
        } catch (e) {
            // A malformed key on chain is not a reason to refuse to send. Fall through to the
            // classical memo, which is what would have happened before the field existed.
            kemPub = null;
        }
        if (kemPub && typeof kemPub.encapsulate === "function") {
            const {
                message: cipher,
                pq_ciphertext
            } = Aes.encrypt_with_checksum_pq(
                fromPrivate,
                toPublic,
                nonce,
                message,
                kemPub
            );
            return {
                from: fromPublic,
                to: toPublic,
                nonce,
                message: cipher,
                pq_ciphertext
            };
        }
    }

    return {
        from: fromPublic,
        to: toPublic,
        nonce,
        message: Aes.encrypt_with_checksum(
            fromPrivate,
            toPublic,
            nonce,
            message
        )
    };
}

/**
 * Decrypt a memo, hybrid or classical.
 *
 * @param kemPrivate this wallet's memo KEM key, or null
 * @throws if the memo is hybrid and no usable KEM key was supplied -- deliberately, so the
 *         caller shows "you do not hold the key" rather than a corrupted string
 */
export function readMemo({
    privateKey,
    publicKey,
    nonce,
    message,
    pqCiphertext,
    kemPrivate
}) {
    if (!pqCiphertext) {
        return Aes.decrypt_with_checksum(
            privateKey,
            publicKey,
            nonce,
            message
        ).toString("utf-8");
    }
    return Aes.decrypt_with_checksum_pq(
        privateKey,
        publicKey,
        nonce,
        message,
        pqCiphertext,
        kemPrivate
    ).toString("utf-8");
}

export default {isPQActive, buildMemo, readMemo};
