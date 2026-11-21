import "../../lib/chain/extraOperations";
import {ops, ChainTypes} from "bitsharesjs";
import {
    EXTRA_OPERATIONS,
    registerExtraOperations
} from "../../lib/chain/extraOperations";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ByteBuffer: any = require("bytebuffer");
const operation = (ops as any).operation;
const fee = {amount: 0, asset_id: "1.3.0"};

// Serialized by bitsharesjs's develop branch (the local fork's dist) from the same objects.
const VECTORS: Array<[string, any, string]> = [
    [
        "liquidity_pool_update with both fees",
        [
            75,
            {
                fee,
                account: "1.2.100",
                pool: "1.19.5",
                taker_fee_percent: 25,
                withdrawal_fee_percent: 50,
                extensions: []
            }
        ],
        "4b000000000000000000640501190001320000"
    ],
    [
        "liquidity_pool_update with neither",
        [75, {fee, account: "1.2.100", pool: "1.19.5", extensions: []}],
        "4b0000000000000000006405000000"
    ],
    [
        "credit_deal_update",
        [
            76,
            {
                fee,
                account: "1.2.100",
                deal_id: "1.22.7",
                auto_repay: 2,
                extensions: []
            }
        ],
        "4c00000000000000000064070200"
    ],
    [
        "limit_order_update with price, a smaller amount and an expiration",
        [
            77,
            {
                fee,
                seller: "1.2.100",
                order: "1.7.9",
                new_price: {
                    base: {amount: 1000, asset_id: "1.3.0"},
                    quote: {amount: 5, asset_id: "1.3.121"}
                },
                delta_amount_to_sell: {amount: -100, asset_id: "1.3.0"},
                new_expiration: "2030-01-01T00:00:00",
                extensions: []
            }
        ],
        "4d000000000000000000640901e80300000000000000050000000000000079019cffffffffffffff000180d8db700000"
    ],
    [
        "limit_order_update with only a bigger amount",
        [
            77,
            {
                fee,
                seller: "1.2.100",
                order: "1.7.9",
                delta_amount_to_sell: {amount: 50, asset_id: "1.3.0"},
                extensions: []
            }
        ],
        "4d00000000000000000064090001320000000000000000000000"
    ]
];

function hex(object: any): string {
    const bb = new ByteBuffer(
        ByteBuffer.DEFAULT_CAPACITY,
        ByteBuffer.LITTLE_ENDIAN
    );
    operation.appendByteBuffer(bb, operation.fromObject(object));
    bb.flip();
    return bb.toHex();
}

describe("operations 75-77 (not in bitsharesjs 6.0.3)", () => {
    it("are known by name and id, in id order after the last known operation", () => {
        const names = Object.keys((ChainTypes as any).operations);
        EXTRA_OPERATIONS.forEach(([name, id]) => {
            expect((ChainTypes as any).operations[name]).toBe(id);
            // the position in the key order is the id (the UI reads names that way)
            expect(names[id]).toBe(name);
            expect((ops as any)[name]).toBeDefined();
            expect(operation.st_operations[id]).toBe((ops as any)[name]);
        });
    });

    it("registering twice changes nothing", () => {
        const before = Object.keys((ChainTypes as any).operations).length;
        expect(registerExtraOperations()).toEqual([]);
        expect(Object.keys((ChainTypes as any).operations).length).toBe(before);
    });

    VECTORS.forEach(([title, object, expected]) => {
        it(`serializes ${title} like bitsharesjs develop`, () => {
            expect(hex(object)).toBe(expected);
        });
    });

    it("reads a serialized limit_order_update back", () => {
        const [, object] = VECTORS[3];
        const back = operation.toObject(operation.fromObject(object));
        expect(back[0]).toBe(77);
        expect(back[1].delta_amount_to_sell.amount).toBe("-100");
        expect(String(back[1].new_price.base.amount)).toBe("1000");
    });
});
