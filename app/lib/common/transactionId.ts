// The id of a transaction on the chain, "the hash": the first 20 bytes (40 hex
// characters) of the SHA-256 of the transaction as the chain serialises it, without
// its signatures. It is what the node answers as `id` when a transaction is
// broadcast and what explorers search by.
//
// An account's history does not carry it: it says only in which block an
// operation is, at which place in the block (`trx_in_block`) and which operation of
// that transaction it is (`op_in_trx`). So the id is worked out from the
// transaction itself, which is in the block. Checked against the node on the
// testnet: the id of a transfer broadcast with `broadcast_transaction_synchronous`
// is the one this computes from the block it landed in.
import {hash, ops} from "bitsharesjs";
import {Apis} from "bitsharesjs-ws";

/** The id of a transaction as a block holds it, or `null` if it cannot be serialised. */
export function transactionId(trx: any): string | null {
    try {
        const body = {
            ref_block_num: trx.ref_block_num,
            ref_block_prefix: trx.ref_block_prefix,
            expiration: trx.expiration,
            operations: trx.operations,
            extensions: trx.extensions || []
        };
        const bytes = (ops as any).transaction.toBuffer(
            (ops as any).transaction.fromObject(body)
        );
        return (hash as any)
            .sha256(bytes)
            .toString("hex")
            .substring(0, 40);
    } catch (e) {
        return null;
    }
}

/**
 * - `{id}`: the transaction the operation is in
 * - `{virtual: true}`: the chain made the operation itself (a fill, a settlement):
 *   it has no transaction of its own (the history gives it the place of whatever
 *   caused it, so the operation at that place is not this one)
 * - `null`: the block could not be read
 */
export type TransactionIdResult = {id: string} | {virtual: true} | null;

const found = new Map<string, Promise<TransactionIdResult>>();

/**
 * The transaction id of the operation at `opInTrx` of transaction `trxInBlock` of
 * block `blockNum`, as the history of an account names it. `opType` (the operation's
 * type number) is what tells a real operation from a virtual one at that place.
 */
export function fetchTransactionId(
    blockNum: number,
    trxInBlock: number,
    opInTrx?: number,
    opType?: number
): Promise<TransactionIdResult> {
    const key = [blockNum, trxInBlock, opInTrx, opType].join(":");
    let result = found.get(key);
    if (!result) {
        result = (Apis as any)
            .instance()
            .db_api()
            .exec("get_block", [blockNum])
            .then(
                (block: any): TransactionIdResult => {
                    const trx = block && block.transactions[trxInBlock];
                    if (!trx) return {virtual: true};
                    if (
                        opInTrx !== undefined &&
                        opType !== undefined &&
                        (!trx.operations[opInTrx] ||
                            trx.operations[opInTrx][0] !== opType)
                    ) {
                        return {virtual: true};
                    }
                    const id = transactionId(trx);
                    return id ? {id} : null;
                }
            )
            .catch(() => null);
        found.set(key, result as Promise<TransactionIdResult>);
        // a block that could not be read is asked for again next time
        (result as Promise<TransactionIdResult>).then(r => {
            if (r === null) found.delete(key);
        });
    }
    return result as Promise<TransactionIdResult>;
}
