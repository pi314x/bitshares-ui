import "../../lib/chain/extraOperations";
import {ChainConfig} from "bitsharesjs-ws";
import {
    describeSerializerError,
    operationTemplate,
    parseOperationJson,
    parseSteps,
    sendableOperations
} from "../../lib/common/opJson";

beforeAll(() => {
    (ChainConfig as any).setPrefix("BTS");
});

describe("sendableOperations", () => {
    it("lists every operation but the ones the chain makes itself, in id order", () => {
        const list = sendableOperations();
        const ids = list.map(([id]) => id);
        expect(ids).toEqual([...ids].sort((a, b) => a - b));
        [4, 42, 44, 46, 51, 53, 74].forEach(id =>
            expect(ids).not.toContain(id)
        );
        expect(list[0]).toEqual([0, "transfer"]);
        expect(list).toContainEqual([77, "limit_order_update"]);
        // 78 operations, 7 of them virtual
        expect(list.length).toBe(71);
    });
});

describe("operationTemplate", () => {
    it("holds the required fields with defaults, without the fee, the extensions and the optional ones", () => {
        const template = JSON.parse(operationTemplate("transfer"));
        expect(Object.keys(template)).toEqual(["from", "to", "amount"]);
        expect(template.amount).toEqual({amount: "0", asset_id: "1.3.0"});
        const order = JSON.parse(operationTemplate("limit_order_create"));
        expect(order.fill_or_kill).toBe(false);
        expect(JSON.parse(operationTemplate("no_such"))).toEqual({});
    });

    it("is a skeleton that becomes valid once the ids are real", () => {
        const text = operationTemplate("account_transfer");
        expect(parseOperationJson("account_transfer", text).ok).toBe(true);
    });
});

describe("parseOperationJson", () => {
    it("makes [id, fields], filling the fee and the extensions", () => {
        const built = parseOperationJson(
            "account_transfer",
            '{"account_id":"1.2.5","new_owner":"1.2.6"}'
        );
        expect(built).toEqual({
            ok: true,
            op: [
                9,
                {
                    account_id: "1.2.5",
                    new_owner: "1.2.6",
                    fee: {amount: 0, asset_id: "1.3.0"},
                    extensions: []
                }
            ]
        });
    });

    it("keeps a fee that was written", () => {
        const built = parseOperationJson(
            "custom",
            JSON.stringify({
                fee: {amount: 5, asset_id: "1.3.121"},
                payer: "1.2.5",
                required_auths: [],
                id: 1,
                data: "00"
            })
        );
        expect(built.ok && built.op[1].fee).toEqual({
            amount: 5,
            asset_id: "1.3.121"
        });
    });

    it("refuses a virtual or unknown operation, and text that is not an object", () => {
        expect(parseOperationJson("fill_order", "{}")).toMatchObject({
            error: "operation_invalid"
        });
        expect(parseOperationJson("nope", "{}")).toMatchObject({
            error: "operation_invalid"
        });
        expect(parseOperationJson("transfer", "nope")).toMatchObject({
            error: "json_invalid"
        });
        expect(parseOperationJson("transfer", "[]")).toMatchObject({
            error: "json_invalid"
        });
        expect(parseOperationJson("transfer", "null")).toMatchObject({
            error: "json_invalid"
        });
    });

    it("says where the library cannot read it", () => {
        const built = parseOperationJson(
            "account_transfer",
            '{"account_id":"1.2.5","new_owner":"not an id"}'
        );
        expect(built.ok).toBe(false);
        if (!built.ok) {
            expect(built.error).toBe("json_invalid");
            expect(built.detail).toContain("new_owner");
            expect(built.detail).not.toContain("stack:");
        }
    });

    it("reads the operations bitsharesjs could not before (custom authority, parameters)", () => {
        expect(
            parseOperationJson(
                "custom_authority_delete",
                '{"account":"1.2.5","authority_to_delete":"1.17.3"}'
            ).ok
        ).toBe(true);
    });
});

describe("describeSerializerError", () => {
    it("drops the stack", () => {
        expect(
            describeSerializerError(
                new Error("a.b cause: bad\n stack: Error at x")
            )
        ).toBe("a.b cause: bad");
        expect(describeSerializerError(undefined)).toBe("");
    });
});

describe("parseSteps", () => {
    it("reads each step as [name, fields], in order", () => {
        const built = parseSteps([
            {
                name: "account_transfer",
                text: '{"account_id":"1.2.5","new_owner":"1.2.6"}'
            },
            {
                name: "custom_authority_delete",
                text: '{"account":"1.2.5","authority_to_delete":"1.17.3"}'
            }
        ]);
        expect(built.ok && built.op.map(s => s[0])).toEqual([
            "account_transfer",
            "custom_authority_delete"
        ]);
        expect(parseSteps([])).toEqual({ok: true, op: []});
    });

    it("names the step that cannot be read", () => {
        const built = parseSteps([
            {
                name: "account_transfer",
                text: '{"account_id":"1.2.5","new_owner":"1.2.6"}'
            },
            {name: "transfer", text: "nope"}
        ]);
        expect(built).toMatchObject({
            ok: false,
            detail: expect.stringMatching(/^#2/)
        });
    });
});
