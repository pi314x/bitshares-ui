import {
    BATCH,
    MAX_BLOCKS_AFTER_REF,
    TxChain,
    findTransaction,
    indexHit,
    normalizeTransactionId
} from "../../lib/common/findTransaction";
import {transactionId} from "../../lib/common/transactionId";
import {indexQuery} from "../../lib/chain/transactionFinder";

// a transfer as a block holds it; `n` makes another one (another amount, so another id)
const trx = (n: number, refBlock = 90000): any => ({
    ref_block_num: refBlock % 65536,
    ref_block_prefix: 2076179124,
    expiration: "2026-11-18T09:13:38",
    operations: [
        [
            0,
            {
                fee: {amount: 86869, asset_id: "1.3.0"},
                from: "1.2.26848",
                to: "1.2.26849",
                amount: {amount: 1000 + n, asset_id: "1.3.0"},
                extensions: []
            }
        ]
    ],
    extensions: []
});
const idOf = (n: number, refBlock?: number) => transactionId(trx(n, refBlock))!;

const notCancelled = {cancelled: () => false};

/**
 * A chain of `blocks` (number -> transactions; other blocks are empty), a head that may move, the
 * transactions the node still knows, and what the index says (a place, null, or an error).
 */
function chain(
    options: {
        blocks?: Record<number, any[] | null>;
        head?: () => number;
        known?: any[];
        index?: () => {blockNum: number; trxInBlock: number} | null;
    } = {}
) {
    const read: number[] = [];
    const asked = {index: 0};
    const known = new Map<string, any>();
    (options.known || []).forEach(t => known.set(transactionId(t)!, t));
    const fake: TxChain = {
        recentTransaction: async id => known.get(id) || null,
        headBlock: async () => (options.head ? options.head() : 0),
        block: async num => {
            read.push(num);
            const list = (options.blocks || {})[num];
            return list === null ? null : {transactions: list || []};
        },
        indexed: async () => {
            asked.index += 1;
            return options.index ? options.index() : null;
        }
    };
    return {fake, read, asked};
}

describe("normalizeTransactionId", () => {
    const id = "626f5fcd79cad1c3d57321d90f71aba0f703b92e";

    it("takes the id as it is, in upper case, with 0x and with spaces around", () => {
        expect(normalizeTransactionId(id)).toBe(id);
        expect(normalizeTransactionId(id.toUpperCase())).toBe(id);
        expect(normalizeTransactionId(`0x${id}`)).toBe(id);
        expect(normalizeTransactionId(`  ${id}\n`)).toBe(id);
    });

    it("is null for anything that is not 40 hex characters", () => {
        [
            undefined,
            "",
            id.slice(1),
            id + "0",
            id.replace("6", "g"),
            id + id.slice(0, 24)
        ].forEach(text => expect(normalizeTransactionId(text)).toBeNull());
    });
});

describe("a transaction the node still knows", () => {
    it("is looked for in the blocks after the one it was made for, and the block that holds it is named", async () => {
        const {fake, read, asked} = chain({
            head: () => 90010,
            known: [trx(1)],
            blocks: {90004: [trx(2), trx(1)]}
        });
        expect(await findTransaction(fake, idOf(1), notCancelled)).toEqual({
            kind: "found",
            via: "node",
            blockNum: 90004,
            trxInBlock: 1,
            opTypes: [0]
        });
        // it cannot be in or before the block it was made for, and the reading stops with the batch that has it
        expect(Math.min(...read)).toBe(90001);
        expect(Math.max(...read)).toBeLessThan(90001 + BATCH);
        // the index is not asked: nothing leaves the app for what the node knows
        expect(asked.index).toBe(0);
    });

    it("is found when the block number's low 16 bits wrapped since it was made", async () => {
        // made for block 262138 (low bits 65530); the head is 262150 (low bits 6)
        const {fake, read} = chain({
            head: () => 262150,
            known: [trx(1, 262138)],
            blocks: {262141: [trx(1, 262138)]}
        });
        const found: any = await findTransaction(
            fake,
            idOf(1, 262138),
            notCancelled
        );
        expect(found.blockNum).toBe(262141);
        expect(Math.min(...read)).toBe(262139);
    });

    it("is not confused with a transaction that only looks like it (same reference, same expiration)", async () => {
        const {fake} = chain({
            head: () => 90003,
            known: [trx(1)],
            blocks: {90002: [trx(2)]}
        });
        expect(await findTransaction(fake, idOf(1), notCancelled)).toEqual({
            kind: "pending",
            expiration: "2026-11-18T09:13:38"
        });
    });

    it("is said to be waiting for a block, when the reading reaches the head", async () => {
        const {fake} = chain({head: () => 90003, known: [trx(1)]});
        expect(await findTransaction(fake, idOf(1), notCancelled)).toEqual({
            kind: "pending",
            expiration: "2026-11-18T09:13:38"
        });
    });

    it("is looked for again when the chain has moved on while it was reading", async () => {
        let head = 90003;
        const {fake} = chain({
            head: () => {
                const now = head;
                head += 5; // a block or five every time the head is asked for
                return now;
            },
            known: [trx(1)],
            blocks: {90006: [trx(1)]}
        });
        const found: any = await findTransaction(fake, idOf(1), notCancelled);
        expect(found.kind).toBe("found");
        expect(found.blockNum).toBe(90006);
    });

    it("is given up after MAX_BLOCKS_AFTER_REF blocks", async () => {
        const {fake, read} = chain({
            head: () => 90000 + MAX_BLOCKS_AFTER_REF + 500,
            known: [trx(1)]
        });
        expect(await findTransaction(fake, idOf(1), notCancelled)).toEqual({
            kind: "lost",
            expiration: "2026-11-18T09:13:38",
            blocks: MAX_BLOCKS_AFTER_REF
        });
        expect(Math.max(...read)).toBe(90000 + MAX_BLOCKS_AFTER_REF);
    });

    it("stops when it is told to", async () => {
        const {fake} = chain({head: () => 90010, known: [trx(1)]});
        expect(
            await findTransaction(fake, idOf(1), {cancelled: () => true})
        ).toEqual({kind: "stopped"});
    });
});

describe("a transaction the node does not know", () => {
    it("is looked up in the index, and shown when the node's block holds it", async () => {
        const {fake, read} = chain({
            index: () => ({blockNum: 5000, trxInBlock: 1}),
            blocks: {5000: [trx(2), trx(1)]}
        });
        expect(await findTransaction(fake, idOf(1), notCancelled)).toEqual({
            kind: "found",
            via: "index",
            blockNum: 5000,
            trxInBlock: 1,
            opTypes: [0]
        });
        // only the block it names is read
        expect(read).toEqual([5000]);
    });

    it("is not shown when the node's block holds another transaction at that place", async () => {
        const {fake} = chain({
            index: () => ({blockNum: 5000, trxInBlock: 0}),
            blocks: {5000: [trx(2), trx(1)]}
        });
        expect(await findTransaction(fake, idOf(1), notCancelled)).toEqual({
            kind: "unverified",
            blockNum: 5000
        });
    });

    it("is not shown when the node has nothing at that place, or cannot give the block", async () => {
        const place = () => ({blockNum: 5000, trxInBlock: 3});
        const short = chain({index: place, blocks: {5000: [trx(1)]}});
        expect(
            await findTransaction(short.fake, idOf(1), notCancelled)
        ).toEqual({
            kind: "unverified",
            blockNum: 5000
        });
        const none = chain({index: place, blocks: {5000: null}});
        expect(await findTransaction(none.fake, idOf(1), notCancelled)).toEqual(
            {
                kind: "unverified",
                blockNum: 5000
            }
        );
    });

    it("is not found when the index does not have it either", async () => {
        const {fake, asked} = chain();
        expect(await findTransaction(fake, idOf(1), notCancelled)).toEqual({
            kind: "not_found"
        });
        expect(asked.index).toBe(1);
    });

    it("says so when the index cannot be asked, instead of saying the transaction is not there", async () => {
        const {fake} = chain({
            index: () => {
                throw new Error("es.bitshares.dev: 502");
            }
        });
        expect(await findTransaction(fake, idOf(1), notCancelled)).toEqual({
            kind: "index_unreachable",
            message: "es.bitshares.dev: 502"
        });
    });

    it("does not ask the index when it is told to stop first", async () => {
        const {fake, asked} = chain({
            index: () => ({blockNum: 5000, trxInBlock: 0}),
            blocks: {5000: [trx(1)]}
        });
        expect(
            await findTransaction(fake, idOf(1), {cancelled: () => true})
        ).toEqual({kind: "stopped"});
        expect(asked.index).toBe(0);
    });
});

describe("indexHit", () => {
    // the shape of an answer of the index (Elasticsearch), as it was for a real transfer
    const answer = (source: any) => ({
        took: 20,
        hits: {
            total: {value: 1, relation: "eq"},
            hits: [{_index: "bitshares-2026-10", _source: source}]
        }
    });

    it("is the block and the place in it", () => {
        expect(
            indexHit(
                answer({
                    block_data: {block_num: 115672436, trx_id: "ab"},
                    operation_history: {trx_in_block: 1, op_in_trx: 0}
                })
            )
        ).toEqual({blockNum: 115672436, trxInBlock: 1});
    });

    it("takes a place of 0 and numbers sent as text", () => {
        expect(
            indexHit(
                answer({
                    block_data: {block_num: "42"},
                    operation_history: {trx_in_block: 0}
                })
            )
        ).toEqual({blockNum: 42, trxInBlock: 0});
    });

    it("is null for no hit and for an answer it cannot read", () => {
        expect(indexHit({hits: {hits: []}})).toBeNull();
        [
            null,
            undefined,
            {},
            {error: "x"},
            answer({}),
            answer({block_data: {block_num: 5}}),
            answer({operation_history: {trx_in_block: 1}}),
            answer({
                block_data: {block_num: "abc"},
                operation_history: {trx_in_block: 1}
            }),
            answer({
                block_data: {block_num: 5},
                operation_history: {trx_in_block: -1}
            }),
            answer({
                block_data: {block_num: 0},
                operation_history: {trx_in_block: 1}
            })
        ].forEach(body => expect(indexHit(body)).toBeNull());
    });
});

describe("what the index is asked", () => {
    it("is the id and nothing else: which block and place hold it", () => {
        const id = "626f5fcd79cad1c3d57321d90f71aba0f703b92e";
        const query = indexQuery(id);
        expect(query.query.bool.must).toEqual([
            {match: {"block_data.trx_id.keyword": {query: id}}}
        ]);
        expect(query.size).toBe(1);
        expect(JSON.stringify(query)).not.toMatch(/1\.2\.|account|wallet/);
    });
});
