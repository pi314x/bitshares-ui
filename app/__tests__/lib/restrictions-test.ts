import "../../lib/chain/extraOperations";
import {ops} from "bitsharesjs";
import {ChainConfig} from "bitsharesjs-ws";
import vectors from "../fixtures/coreOperationVectors.json";
import {
    buildRestriction,
    buildRestrictions,
    CUSTOM_AUTHORITY_OPERATIONS,
    describeRestrictions,
    functionsFor,
    parseRestrictionsJson,
    resolveRowNames,
    restrictableFields,
    withPlaceholderIds
} from "../../lib/common/restrictions";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const ByteBuffer: any = require("bytebuffer");
const operation = (ops as any).operation;
const nodeRestrictions: any[] = (vectors as any)["custom_authority_create"]
    .op[1].restrictions;

beforeAll(() => {
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

describe("the operations a custom authority can be for", () => {
    it("are the ones bitshares-core supports, each known to the library", () => {
        const ids = CUSTOM_AUTHORITY_OPERATIONS.map(([id]) => id);
        expect(ids).toEqual([
            0,
            1,
            2,
            3,
            5,
            6,
            10,
            13,
            14,
            15,
            19,
            21,
            32,
            33,
            38,
            49,
            50,
            52
        ]);
        CUSTOM_AUTHORITY_OPERATIONS.forEach(([, name]) =>
            expect((ops as any)[name]).toBeDefined()
        );
    });
});

describe("restrictableFields", () => {
    it("lists a transfer's accounts and, inside each amount, its asset and its figure", () => {
        const fields = restrictableFields("transfer");
        expect(fields.map(f => f.path)).toEqual([
            "fee.asset_id",
            "fee.amount",
            "from",
            "to",
            "amount.asset_id",
            "amount.amount"
        ]);
        const to = fields.find(f => f.path === "to");
        expect(to).toMatchObject({kind: "id", idType: 2, memberIndex: 2});
        const asset = fields.find(f => f.path === "amount.asset_id");
        expect(asset).toMatchObject({
            kind: "id",
            idType: 3,
            memberIndex: 1,
            parentIndex: 3
        });
        const figure = fields.find(f => f.path === "amount.amount");
        expect(figure).toMatchObject({
            kind: "integer",
            memberIndex: 0,
            parentIndex: 3
        });
    });

    it("knows booleans, times and numbers of a limit order", () => {
        const kinds: any = {};
        restrictableFields("limit_order_create").forEach(
            f => (kinds[f.path] = f.kind)
        );
        expect(kinds.seller).toBe("id");
        expect(kinds.expiration).toBe("time");
        expect(kinds.fill_or_kill).toBe("bool");
    });

    it("is empty for an operation the library does not know", () => {
        expect(restrictableFields("no_such_operation")).toEqual([]);
    });
});

describe("buildRestriction", () => {
    const fields = restrictableFields("transfer");
    const field = (path: string) => fields.find(f => f.path === path)!;

    it("eq on an account: the account argument", () => {
        expect(buildRestriction(field("to"), "eq", "1.2.6")).toEqual({
            ok: true,
            op: {
                member_index: 2,
                restriction_type: 0,
                argument: [7, "1.2.6"],
                extensions: []
            }
        });
    });

    it("in on assets: the list argument, each asset once", () => {
        const built = buildRestriction(
            field("amount.asset_id"),
            "in",
            "1.3.0, 1.3.121\n1.3.0"
        );
        expect(built.ok && built.op.argument).toEqual([
            27,
            ["1.3.0", "1.3.121"]
        ]);
    });

    it("compares numbers as int64 text", () => {
        const built = buildRestriction(
            field("amount.amount"),
            "le",
            "9223372036854775807"
        );
        expect(built.ok && built.op.argument).toEqual([
            2,
            "9223372036854775807"
        ]);
        expect(
            buildRestriction(
                field("amount.amount"),
                "le",
                "9223372036854775808"
            )
        ).toMatchObject({ok: false, error: "value_invalid"});
        expect(
            buildRestriction(field("amount.amount"), "le", "1.5")
        ).toMatchObject({ok: false, error: "value_invalid"});
    });

    it("refuses a function the field cannot take, a wrong id, no value", () => {
        expect(buildRestriction(field("to"), "lt", "1.2.6")).toMatchObject({
            ok: false,
            error: "function_not_allowed"
        });
        expect(buildRestriction(field("to"), "eq", "1.3.6")).toMatchObject({
            ok: false,
            error: "value_invalid"
        });
        expect(buildRestriction(field("to"), "eq", " ")).toMatchObject({
            ok: false,
            error: "value_missing"
        });
        expect(buildRestriction(field("to"), "in", " , ")).toMatchObject({
            ok: false,
            error: "values_missing"
        });
    });

    it("reads times and booleans", () => {
        const order = restrictableFields("limit_order_create");
        const time = order.find(f => f.path === "expiration")!;
        const built = buildRestriction(time, "gt", "2030-01-02 03:04");
        expect(built.ok && built.op.argument).toEqual([
            4,
            "2030-01-02T03:04:00"
        ]);
        const flag = order.find(f => f.path === "fill_or_kill")!;
        const yes = buildRestriction(flag, "eq", "true");
        expect(yes.ok && yes.op.argument).toEqual([1, true]);
        expect(buildRestriction(flag, "eq", "maybe").ok).toBe(false);
        // the 31st of February is not a day
        expect(buildRestriction(time, "gt", "2030-02-31 00:00").ok).toBe(false);
        expect(buildRestriction(time, "gt", "2030-13-01 00:00").ok).toBe(false);
        expect(functionsFor(flag)).toEqual(["eq", "ne"]);
        expect(functionsFor(time)).toContain("gt");
    });
});

describe("buildRestrictions", () => {
    it("makes the restrictions the node serializes the same way (an account, and an attr over an amount)", () => {
        const built = buildRestrictions("transfer", [
            {path: "to", fn: "eq", value: "1.2.6"},
            {path: "amount.asset_id", fn: "in", value: "1.3.0 1.3.121"}
        ]);
        expect(built.ok).toBe(true);
        if (!built.ok) return;
        expect(built.op).toEqual(nodeRestrictions.slice(0, 2));
    });

    it("gathers the rows of one amount under one attr", () => {
        const built = buildRestrictions("transfer", [
            {path: "amount.asset_id", fn: "eq", value: "1.3.0"},
            {path: "amount.amount", fn: "le", value: "5000"}
        ]);
        expect(built.ok && built.op.length).toBe(1);
        expect(built.ok && built.op[0]).toMatchObject({
            member_index: 3,
            restriction_type: 10,
            argument: [
                39,
                [
                    {member_index: 1, restriction_type: 0},
                    {member_index: 0, restriction_type: 3}
                ]
            ]
        });
    });

    it("serializes inside a whole operation the library accepts", () => {
        const built = buildRestrictions("transfer", [
            {path: "to", fn: "in", value: "1.2.6 1.2.7"},
            {path: "amount.amount", fn: "le", value: "100"}
        ]);
        expect(built.ok).toBe(true);
        if (!built.ok) return;
        const authority = {
            weight_threshold: 1,
            account_auths: [["1.2.6", 1]],
            key_auths: [],
            address_auths: []
        };
        expect(() =>
            hexOf([
                54,
                {
                    fee: {amount: 0, asset_id: "1.3.0"},
                    account: "1.2.5",
                    enabled: true,
                    valid_from: "2030-01-01T00:00:00",
                    valid_to: "2031-01-01T00:00:00",
                    operation_type: 0,
                    auth: authority,
                    restrictions: built.op,
                    extensions: []
                }
            ])
        ).not.toThrow();
    });

    it("refuses an unknown field", () => {
        expect(
            buildRestrictions("transfer", [
                {path: "nope", fn: "eq", value: "x"}
            ])
        ).toMatchObject({ok: false, error: "field_unknown"});
    });
});

describe("parseRestrictionsJson", () => {
    it("takes what the chain reads, including the kinds rows cannot say", () => {
        const text = JSON.stringify(nodeRestrictions);
        const parsed = parseRestrictionsJson(text);
        expect(parsed.ok && parsed.op.length).toBe(nodeRestrictions.length);
    });

    it("refuses what is not a list of restrictions", () => {
        expect(parseRestrictionsJson("x")).toMatchObject({ok: false});
        expect(parseRestrictionsJson("{}")).toMatchObject({ok: false});
        expect(parseRestrictionsJson('[{"member_index": 1}]')).toMatchObject({
            ok: false
        });
    });
});

describe("resolveRowNames", () => {
    const lookups = {
        accounts: jest.fn(async (names: string[]) => ({
            alice: "1.2.100",
            ...Object.fromEntries(
                names.filter(n => n === "ghost").map(n => [n, null])
            )
        })),
        assets: jest.fn(async () => ({USD: "1.3.121"}))
    };

    it("replaces names by ids and leaves ids alone", async () => {
        const rows = await resolveRowNames(
            "transfer",
            [
                {path: "to", fn: "in", value: "alice, 1.2.7"},
                {path: "amount.asset_id", fn: "eq", value: "USD"},
                {path: "amount.amount", fn: "le", value: "5"}
            ],
            lookups
        );
        expect(rows.map(r => r.value)).toEqual([
            "1.2.100, 1.2.7",
            "1.3.121",
            "5"
        ]);
    });

    it("rejects with the name that does not exist", async () => {
        await expect(
            resolveRowNames(
                "transfer",
                [{path: "to", fn: "eq", value: "ghost"}],
                lookups
            )
        ).rejects.toThrow("ghost");
    });
});

describe("describeRestrictions", () => {
    it("reads the node's list back as lines", () => {
        const lines = describeRestrictions("transfer", [
            [
                0,
                {
                    member_index: 2,
                    restriction_type: 0,
                    argument: [7, "1.2.6"],
                    extensions: []
                }
            ],
            [
                3,
                {
                    member_index: 3,
                    restriction_type: 10,
                    argument: [
                        39,
                        [
                            {
                                member_index: 1,
                                restriction_type: 6,
                                argument: [27, ["1.3.0", "1.3.121"]]
                            }
                        ]
                    ],
                    extensions: []
                }
            ]
        ]);
        expect(lines).toEqual([
            {id: 0, field: "to", fn: "eq", value: "1.2.6"},
            {
                id: 3,
                field: "amount.asset_id",
                fn: "in",
                value: '["1.3.0","1.3.121"]'
            }
        ]);
    });
});

describe("withPlaceholderIds", () => {
    it("lets a row with names be checked before the names are looked up", () => {
        const rows = withPlaceholderIds("transfer", [
            {path: "to", fn: "in", value: "alice, 1.2.7"},
            {path: "amount.asset_id", fn: "eq", value: "USD"},
            {path: "amount.amount", fn: "le", value: "5"}
        ]);
        expect(rows.map((r: any) => r.value)).toEqual([
            "1.2.1, 1.2.7",
            "1.3.0",
            "5"
        ]);
        expect(buildRestrictions("transfer", rows).ok).toBe(true);
    });
});
