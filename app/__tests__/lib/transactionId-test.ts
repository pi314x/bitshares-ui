// The id of a transaction is not in an account's history: it is worked out from the
// transaction in its block. The vector is a real testnet transfer; the id is the
// one the node answered (`broadcast_transaction_synchronous`) when it was broadcast
// (block 101728315, transaction 0), so this is the chain's definition, not ours.
import {
    transactionId,
    fetchTransactionId
} from "../../lib/common/transactionId";

const transfer = {
    ref_block_num: 16442,
    ref_block_prefix: 2076179124,
    expiration: "2026-10-26T09:13:38",
    operations: [
        [
            0,
            {
                fee: {amount: 86869, asset_id: "1.3.0"},
                from: "1.2.26848",
                to: "1.2.26849",
                amount: {amount: 1000, asset_id: "1.3.0"},
                extensions: []
            }
        ]
    ],
    extensions: []
};
const nodeId = "1ff9fd3f6d2aa27d35aeca7474d4e819e8be47c2";

let mockBlocks: Record<number, any> = {};
let mockCalls = 0;
jest.mock("bitsharesjs-ws", () => ({
    ...jest.requireActual("bitsharesjs-ws"),
    Apis: {
        instance: () => ({
            db_api: () => ({
                exec: (method: string, [num]: [number]) => {
                    mockCalls++;
                    return method === "get_block" && num in mockBlocks
                        ? Promise.resolve(mockBlocks[num])
                        : Promise.reject(new Error("no such block"));
                }
            })
        })
    }
}));

describe("transactionId", () => {
    it("is the id the node answered for a real transfer", () => {
        expect(transactionId(transfer)).toBe(nodeId);
    });

    it("does not depend on the signatures or the results the block carries", () => {
        expect(
            transactionId({
                ...transfer,
                signatures: ["1f00"],
                operation_results: [[0, {}]]
            })
        ).toBe(nodeId);
    });

    it("changes with anything the transaction says", () => {
        expect(
            transactionId({...transfer, expiration: "2026-10-26T09:13:39"})
        ).not.toBe(nodeId);
    });

    it("is null for something that is not a transaction", () => {
        expect(transactionId({operations: [[999, {}]]})).toBeNull();
        expect(transactionId(null)).toBeNull();
    });
});

describe("fetchTransactionId", () => {
    beforeEach(() => {
        mockCalls = 0;
        mockBlocks = {
            1000: {transactions: [transfer]},
            1001: {transactions: []}
            // a block the history names but that cannot be asked for: no entry
        };
    });

    it("reads the block and gives the id of the transaction at that place", async () => {
        expect(await fetchTransactionId(1000, 0, 0, 0)).toEqual({id: nodeId});
    });

    it("asks a block once for all the places in it", async () => {
        mockBlocks[1002] = {transactions: [transfer, transfer]};
        await Promise.all([
            fetchTransactionId(1002, 0, 0, 0),
            fetchTransactionId(1002, 1, 0, 0),
            fetchTransactionId(1002, 0, 0, 4)
        ]);
        expect(mockCalls).toBe(1);
    });

    it("says virtual for an operation the chain made (another type at that place)", async () => {
        // a fill (4) is filed under the transaction that caused it
        expect(await fetchTransactionId(1000, 0, 0, 4)).toEqual({
            virtual: true
        });
        // ... or under no transaction at all
        expect(await fetchTransactionId(1001, 65535, 0, 4)).toEqual({
            virtual: true
        });
    });

    it("is null when the block cannot be read, and asks again next time", async () => {
        expect(await fetchTransactionId(5, 0, 0, 0)).toBeNull();
        expect(await fetchTransactionId(5, 0, 0, 0)).toBeNull();
        expect(mockCalls).toBe(2);
    });
});
