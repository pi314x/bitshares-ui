// Find a transaction by its id ("the hash", see transactionId.ts) - by the id alone.
//
// A node has no index of transaction ids. What it can do is `get_recent_transaction_by_id`: the
// transaction itself, for as long as it may still be included or replayed (until its expiration, a
// day at most). It does not say which block holds it - but the transaction names the block it was
// made for (`ref_block_num`, the low 16 bits of that block's number), and it can only be in a block
// after that one, so the blocks from there on are read until one has it.
// For an older transaction a public index of the chain's history is asked which block holds it (the
// only thing it is trusted for): the connected node then reads that block, and the transaction is
// shown only when its id, worked out from what the node's block holds, is the one searched for.
import {transactionId} from "./transactionId";

/** What the finder asks of the chain (the real one is lib/chain/transactionFinder.ts). */
export interface TxChain {
    /** the transaction as the node knows it (no block), or null */
    recentTransaction(id: string): Promise<any | null>;
    headBlock(): Promise<number>;
    block(num: number): Promise<any | null>;
    /** the block and place an index of the chain's history gives for the id, or null when it has none; rejects when the index cannot be asked */
    indexed(id: string): Promise<{blockNum: number; trxInBlock: number} | null>;
}

export interface Place {
    blockNum: number;
    /** the transaction's place in the block (0 is the first), as the block page numbers it */
    trxInBlock: number;
    /** the type numbers of the operations it holds */
    opTypes: number[];
}

export type FindResult =
    | ({kind: "found"; via: "node" | "index"} & Place)
    /** the node has it, no block holds it yet */
    | {kind: "pending"; expiration: string}
    /** the node has it, its block is not among the blocks read */
    | {kind: "lost"; expiration: string; blocks: number}
    | {kind: "not_found"}
    /** the index names a block, and the node's copy of it does not hold this transaction */
    | {kind: "unverified"; blockNum: number}
    /** the node does not know it, and the index could not be asked */
    | {kind: "index_unreachable"; message: string}
    | {kind: "stopped"};

export interface Control {
    cancelled(): boolean;
}

/** blocks read at the same time */
export const BATCH = 8;
/** how far past the block a transaction was made for the finder reads before it gives up */
export const MAX_BLOCKS_AFTER_REF = 4000;

/** 40 hex characters, with or without "0x", in any case, with spaces around: the id in lower case; otherwise null. */
export function normalizeTransactionId(input?: string): string | null {
    const text = (input || "")
        .trim()
        .replace(/^0x/i, "")
        .toLowerCase();
    return /^[0-9a-f]{40}$/.test(text) ? text : null;
}

/** The block and place in an answer of the index (Elasticsearch, `block_data.trx_id`), or null. */
export function indexHit(
    body: any
): {blockNum: number; trxInBlock: number} | null {
    const hit = body && body.hits && body.hits.hits && body.hits.hits[0];
    const source = hit && hit._source;
    if (!source) return null;
    const blockNum = Number(source.block_data && source.block_data.block_num);
    const place =
        source.operation_history && source.operation_history.trx_in_block;
    const trxInBlock = Number(place);
    return place !== undefined &&
        place !== null &&
        Number.isInteger(blockNum) &&
        blockNum > 0 &&
        Number.isInteger(trxInBlock) &&
        trxInBlock >= 0
        ? {blockNum, trxInBlock}
        : null;
}

function numbers(from: number, to: number): number[] {
    const out: number[] = [];
    for (let n = from; n <= to; n++) out.push(n);
    return out;
}

/** The blocks `nums`, read BATCH at a time. */
async function readBlocks(
    chain: TxChain,
    nums: number[],
    control: Control
): Promise<Map<number, any>> {
    const blocks = new Map<number, any>();
    for (let i = 0; i < nums.length && !control.cancelled(); i += BATCH) {
        const part = nums.slice(i, i + BATCH);
        const read = await Promise.all(part.map(n => chain.block(n)));
        part.forEach((n, k) => blocks.set(n, read[k]));
    }
    return blocks;
}

/** The transaction an index says is at `blockNum`, `trxInBlock`: shown only when the node's block holds it. */
async function confirmIndexed(
    chain: TxChain,
    id: string,
    blockNum: number,
    trxInBlock: number
): Promise<FindResult> {
    const block = await chain.block(blockNum);
    const trx = block && block.transactions && block.transactions[trxInBlock];
    if (!trx || transactionId(trx) !== id) {
        return {kind: "unverified", blockNum};
    }
    return {
        kind: "found",
        via: "index",
        blockNum,
        trxInBlock,
        opTypes: trx.operations.map((op: any) => op[0])
    };
}

/** `id` is the normalised id (normalizeTransactionId). */
export async function findTransaction(
    chain: TxChain,
    id: string,
    control: Control
): Promise<FindResult> {
    const known = await chain.recentTransaction(id);
    if (!known) {
        // the node does not know it (any more): the index of the chain's history may
        if (control.cancelled()) return {kind: "stopped"};
        let hit;
        try {
            hit = await chain.indexed(id);
        } catch (error) {
            return {
                kind: "index_unreachable",
                message: (error && (error as Error).message) || ""
            };
        }
        if (control.cancelled()) return {kind: "stopped"};
        return hit
            ? confirmIndexed(chain, id, hit.blockNum, hit.trxInBlock)
            : {kind: "not_found"};
    }
    let head = await chain.headBlock();
    // the block it was made for: the latest block whose number ends in `ref_block_num` (16 bits)
    const behind = (((head - known.ref_block_num) % 65536) + 65536) % 65536;
    const first = head - behind + 1;
    let next = first;
    while (!control.cancelled()) {
        if (next > head) {
            const now = await chain.headBlock();
            // nothing newer: the node has it and no block does (yet)
            if (now <= head)
                return {kind: "pending", expiration: known.expiration};
            head = now;
        }
        if (next - first >= MAX_BLOCKS_AFTER_REF) {
            return {
                kind: "lost",
                expiration: known.expiration,
                blocks: MAX_BLOCKS_AFTER_REF
            };
        }
        const last = Math.min(
            head,
            first + MAX_BLOCKS_AFTER_REF - 1,
            next + BATCH - 1
        );
        const wanted = numbers(next, last);
        const blocks = await readBlocks(chain, wanted, control);
        for (const num of wanted) {
            const block = blocks.get(num);
            const list: any[] = (block && block.transactions) || [];
            const index = list.findIndex(
                trx =>
                    trx.ref_block_num === known.ref_block_num &&
                    trx.ref_block_prefix === known.ref_block_prefix &&
                    trx.expiration === known.expiration &&
                    transactionId(trx) === id
            );
            if (index !== -1) {
                return {
                    kind: "found",
                    via: "node",
                    blockNum: num,
                    trxInBlock: index,
                    opTypes: list[index].operations.map((op: any) => op[0])
                };
            }
        }
        next = last + 1;
    }
    return {kind: "stopped"};
}
