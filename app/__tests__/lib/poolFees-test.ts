import "../../lib/chain/extraOperations";
import {ops} from "bitsharesjs";
import {
    MAX_FEE_UNITS,
    buildPoolUpdateOp,
    feeText,
    feeUnits
} from "../../lib/common/poolFees";

describe("feeUnits / feeText", () => {
    it("turns percent into hundredths of a percent", () => {
        expect(feeUnits("0.25")).toBe(25);
        expect(feeUnits("0,3")).toBe(30);
        expect(feeUnits("1")).toBe(100);
        expect(feeUnits(" 2.5 % ")).toBe(250);
        expect(feeUnits("0")).toBe(0);
        expect(feeUnits("100")).toBe(MAX_FEE_UNITS);
    });

    it("refuses what is not a fee", () => {
        expect(feeUnits("")).toBeNull();
        expect(feeUnits("abc")).toBeNull();
        expect(feeUnits("-1")).toBeNull();
        expect(feeUnits("0.255")).toBeNull(); // finer than the chain's step
        expect(feeUnits("100.01")).toBeNull();
        expect(feeUnits("101")).toBeNull();
    });

    it("writes a fee for a field", () => {
        expect(feeText(25)).toBe("0.25");
        expect(feeText(100)).toBe("1");
        expect(feeText(0)).toBe("0");
        expect(feeText(250)).toBe("2.5");
    });
});

describe("buildPoolUpdateOp", () => {
    const base = {account: "1.2.100", poolId: "1.19.5"};

    it("sends only the fee that changed", () => {
        const op = buildPoolUpdateOp({
            ...base,
            current: {taker: 25, withdrawal: 50},
            next: {taker: 30, withdrawal: 50}
        });
        expect(op).toEqual({
            fee: {amount: 0, asset_id: "1.3.0"},
            account: "1.2.100",
            pool: "1.19.5",
            taker_fee_percent: 30,
            extensions: []
        });
    });

    it("sends both when both changed, and none when none did", () => {
        const both = buildPoolUpdateOp({
            ...base,
            current: {taker: 25, withdrawal: 50},
            next: {taker: 0, withdrawal: 75}
        });
        expect(both && both.taker_fee_percent).toBe(0);
        expect(both && both.withdrawal_fee_percent).toBe(75);
        expect(
            buildPoolUpdateOp({
                ...base,
                current: {taker: 25, withdrawal: 50},
                next: {taker: 25, withdrawal: 50}
            })
        ).toBeNull();
    });

    it("is an operation the serializer takes (a zero fee is sent, not left out)", () => {
        const op = buildPoolUpdateOp({
            ...base,
            current: {taker: 25, withdrawal: 50},
            next: {taker: 0, withdrawal: 50}
        });
        const operation = (ops as any).operation;
        const back = operation.toObject(operation.fromObject([75, op]));
        expect(back[1].taker_fee_percent).toBe(0);
        expect(back[1].withdrawal_fee_percent).toBeUndefined();
    });
});
