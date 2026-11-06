import "../../lib/chain/extraOperations";
import {ops} from "bitsharesjs";
import {ChainConfig} from "bitsharesjs-ws";
import {applyFixedOperations} from "../../lib/chain/fixedOperations";
import vectors from "../fixtures/coreOperationVectors.json";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ByteBuffer: any = require("bytebuffer");
const operation = (ops as any).operation;

beforeAll(() => {
    // public keys carry the chain's prefix
    (ChainConfig as any).setPrefix("BTS");
});

function hexOf(object: any): string {
    const bb = new ByteBuffer(
        ByteBuffer.DEFAULT_CAPACITY,
        ByteBuffer.LITTLE_ENDIAN
    );
    operation.appendByteBuffer(bb, operation.fromObject(object));
    bb.flip();
    return bb.toHex();
}

function objectOf(hex: string): any {
    const bb = ByteBuffer.fromHex(hex, ByteBuffer.LITTLE_ENDIAN);
    return operation.toObject(operation.fromByteBuffer(bb));
}

const names = Object.keys(vectors as any);

describe("operations the library could not serialize, against the bytes bitshares-core makes", () => {
    it("has a vector for each of the operations without a creation screen before", () => {
        const ids = names.map(name => (vectors as any)[name].op[0]);
        [9, 30, 31, 35, 36, 38, 39, 40, 41, 54, 55, 56, 67, 68].forEach(id =>
            expect(ids).toContain(id)
        );
    });

    names.forEach(name => {
        const {op, hex} = (vectors as any)[name];
        // the node's own serialization (scripts/serialization-vectors.py)
        it(`serializes ${name} like the node`, () => {
            expect(hexOf(op)).toBe(hex);
        });
        it(`reads ${name} back from the node's bytes`, () => {
            // what the library makes of the object = what it reads from the node's bytes
            expect(objectOf(hex)).toEqual(
                operation.toObject(operation.fromObject(op))
            );
        });
    });

    it("keeps the order of restrictions (they apply in order)", () => {
        const first = {
            member_index: 2,
            restriction_type: 0,
            argument: [7, "1.2.9"],
            extensions: []
        };
        const second = {
            member_index: 1,
            restriction_type: 0,
            argument: [7, "1.2.3"],
            extensions: []
        };
        const op = {
            fee: {amount: 0, asset_id: "1.3.0"},
            account: "1.2.5",
            authority_to_update: "1.17.3",
            restrictions_to_remove: [3, 1, 2],
            restrictions_to_add: [first, second],
            extensions: []
        };
        const back = objectOf(hexOf([55, op]));
        expect(
            back[1].restrictions_to_add.map((r: any) => Number(r.member_index))
        ).toEqual([2, 1]);
        // a flat_set: ascending
        expect(back[1].restrictions_to_remove).toEqual([1, 2, 3]);
    });

    it("applies once", () => {
        expect(applyFixedOperations()).toEqual([]);
    });
});
