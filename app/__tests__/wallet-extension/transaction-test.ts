import {PrivateKey, TransactionBuilder} from "bitsharesjs";
import {
    assertOperationsBelongTo,
    toExtensionTransaction
} from "../../wallet-extension/transaction";
import {ExternalSignerError} from "../../wallet-extension/types";

function build(name: string, op: any) {
    const tr = new (TransactionBuilder as any)();
    tr.add_type_operation(name, op);
    return tr.operations;
}

const transfer = (overrides: any = {}) => ({
    fee: {amount: 0, asset_id: 0},
    from: "1.2.100",
    to: "1.2.200",
    amount: {amount: 123456, asset_id: "1.3.0"},
    ...overrides
});

function codeOf(fn: () => void): string | undefined {
    try {
        fn();
    } catch (e) {
        return (e as ExternalSignerError).code;
    }
    return undefined;
}

describe("toExtensionTransaction", () => {
    it("emits canonical node JSON with exact integer strings", () => {
        const tx = toExtensionTransaction(build("transfer", transfer()));
        expect(tx.operations).toHaveLength(1);
        const [id, data] = tx.operations[0];
        expect(id).toBe(0);
        expect(data.from).toBe("1.2.100");
        expect(data.amount).toEqual({amount: "123456", asset_id: "1.3.0"});
        expect(data.fee).toEqual({amount: "0", asset_id: "1.3.0"});
    });

    it("keeps an int64 a JS number cannot hold", () => {
        const tx = toExtensionTransaction(
            build(
                "transfer",
                transfer({
                    amount: {amount: "9007199254740993", asset_id: "1.3.0"}
                })
            )
        );
        expect(tx.operations[0][1].amount.amount).toBe("9007199254740993");
    });

    it("carries a limit order with its expiration as node time", () => {
        const tx = toExtensionTransaction(
            build("limit_order_create", {
                fee: {amount: 0, asset_id: 0},
                seller: "1.2.100",
                amount_to_sell: {amount: 100000, asset_id: "1.3.0"},
                min_to_receive: {amount: 5, asset_id: "1.3.861"},
                expiration: new Date(1900000000000),
                fill_or_kill: false,
                extensions: []
            })
        );
        expect(tx.operations[0][0]).toBe(1);
        expect(tx.operations[0][1].expiration).toBe("2030-03-17T17:46:40");
        expect(tx.operations[0][1].min_to_receive.asset_id).toBe("1.3.861");
    });

    it("refuses a memo, which the extension would publish unencrypted", () => {
        const key = (PrivateKey as any)
            .fromSeed("memo-test")
            .toPublicKey()
            .toPublicKeyString();
        const withMemo = build(
            "transfer",
            transfer({
                memo: {from: key, to: key, nonce: "1", message: "deadbeef"}
            })
        );
        expect(codeOf(() => toExtensionTransaction(withMemo))).toBe(
            "unsupported"
        );
    });

    it("refuses a fee in any asset but the core asset", () => {
        const other = build(
            "transfer",
            transfer({fee: {amount: 0, asset_id: "1.3.861"}})
        );
        expect(codeOf(() => toExtensionTransaction(other))).toBe("unsupported");
    });

    it("refuses an empty transaction", () => {
        expect(codeOf(() => toExtensionTransaction([]))).toBe("unsupported");
    });

    it("reports a malformed operation instead of throwing a raw error", () => {
        expect(
            codeOf(() => toExtensionTransaction([[0, {from: "nonsense"}]]))
        ).toBe("failed");
    });
});

describe("assertOperationsBelongTo", () => {
    it("accepts operations for the connected account", () => {
        const tx = toExtensionTransaction(build("transfer", transfer()));
        expect(() => assertOperationsBelongTo(tx, "1.2.100")).not.toThrow();
    });

    it("does not treat the recipient as an authority", () => {
        const tx = toExtensionTransaction(
            build("transfer", transfer({to: "1.2.999"}))
        );
        expect(() => assertOperationsBelongTo(tx, "1.2.100")).not.toThrow();
    });

    it("refuses a transfer from another account", () => {
        const tx = toExtensionTransaction(
            build("transfer", transfer({from: "1.2.555"}))
        );
        expect(codeOf(() => assertOperationsBelongTo(tx, "1.2.100"))).toBe(
            "account_mismatch"
        );
    });

    it("also covers fields the extension's own check does not know", () => {
        const tx = {
            operations: [
                [
                    64,
                    {
                        fee: {amount: "0", asset_id: "1.3.0"},
                        owner_account: "1.2.555",
                        asset_type: "1.3.0",
                        balance: "1000",
                        fee_rate: 100
                    }
                ] as [number, any]
            ]
        };
        expect(codeOf(() => assertOperationsBelongTo(tx, "1.2.100"))).toBe(
            "account_mismatch"
        );
    });
});
