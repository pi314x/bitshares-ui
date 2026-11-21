// SameT funds move real money (create/update/delete fund operations), so the
// pure helpers behind the new page are tested hard: exact amount parsing and
// formatting, no floating point anywhere, and the operations the page builds
// must round-trip through the real bitsharesjs serializers - including int64
// values that a JS number cannot represent and negative withdrawal deltas.
import {ops} from "bitsharesjs";
import {
    FEE_RATE_DENOM,
    buildCreateOp,
    buildDeleteOp,
    buildUpdateOp,
    formatAmount,
    formatFeeRate,
    nextStartId,
    normalizeFund,
    parseAmount,
    parseFeeRate
} from "../../lib/common/sametFunds";

const serializers = ops as any;

function roundTrip(name: string, op: any) {
    const serializer = serializers[name];
    return serializer.toObject(serializer.fromHex(serializer.toHex(op)));
}

describe("formatAmount", () => {
    it("places the decimal point by precision and groups thousands", () => {
        expect(formatAmount("123456", 2)).toBe("1,234.56");
        expect(formatAmount("5", 3)).toBe("0.005");
        expect(formatAmount(100005000, 5)).toBe("1,000.05000");
        expect(formatAmount("0", 5)).toBe("0.00000");
        expect(formatAmount("1234", 0)).toBe("1,234");
    });

    it("is exact beyond Number.MAX_SAFE_INTEGER", () => {
        expect(formatAmount("9007199254740993", 0)).toBe(
            "9,007,199,254,740,993"
        );
        expect(formatAmount("9223372036854775807", 8)).toBe(
            "92,233,720,368.54775807"
        );
    });

    it("keeps the sign", () => {
        expect(formatAmount("-250", 2)).toBe("-2.50");
    });
});

describe("parseAmount", () => {
    it("turns decimal text into smallest-unit integers", () => {
        expect(parseAmount("12.5", 2)).toBe("1250");
        expect(parseAmount("0.05", 2)).toBe("5");
        expect(parseAmount("1,234.5", 2)).toBe("123450");
        expect(parseAmount("5.", 2)).toBe("500");
        expect(parseAmount("007", 0)).toBe("7");
        expect(parseAmount("0", 5)).toBe("0");
        expect(parseAmount("  3 ", 1)).toBe("30");
    });

    it("refuses anything that would need rounding or is not a number", () => {
        expect(parseAmount("12.345", 2)).toBeNull();
        expect(parseAmount("1.5", 0)).toBeNull();
        expect(parseAmount("", 2)).toBeNull();
        expect(parseAmount("abc", 2)).toBeNull();
        expect(parseAmount("-1", 2)).toBeNull();
        expect(parseAmount(".5", 2)).toBeNull();
        expect(parseAmount("1e3", 2)).toBeNull();
        expect(parseAmount("1.2.3", 2)).toBeNull();
    });

    it("is exact for amounts a float cannot hold", () => {
        expect(parseAmount("90071992547409.93", 2)).toBe("9007199254740993");
    });

    it("round-trips with formatAmount", () => {
        ["0", "1", "99", "100", "123456789012345"].forEach(raw => {
            expect(parseAmount(formatAmount(raw, 4), 4)).toBe(raw);
        });
    });
});

describe("fee rates", () => {
    it("formats rate/1,000,000 as a percentage without trailing zeros", () => {
        expect(formatFeeRate(300)).toBe("0.03%");
        expect(formatFeeRate(1)).toBe("0.0001%");
        expect(formatFeeRate(0)).toBe("0%");
        expect(formatFeeRate(10000)).toBe("1%");
        expect(formatFeeRate(12500)).toBe("1.25%");
        expect(formatFeeRate(FEE_RATE_DENOM)).toBe("100%");
    });

    it("parses percentages at the chain's resolution", () => {
        expect(parseFeeRate("0.03")).toBe(300);
        expect(parseFeeRate("0.0001")).toBe(1);
        expect(parseFeeRate("1%")).toBe(10000);
        expect(parseFeeRate(" 100 ")).toBe(FEE_RATE_DENOM);
        expect(parseFeeRate("0")).toBe(0);
    });

    it("rejects out-of-range or over-precise input", () => {
        expect(parseFeeRate("100.0001")).toBeNull();
        expect(parseFeeRate("0.00001")).toBeNull();
        expect(parseFeeRate("-1")).toBeNull();
        expect(parseFeeRate("abc")).toBeNull();
        expect(parseFeeRate("")).toBeNull();
    });

    it("round-trips every value we show", () => {
        [0, 1, 300, 12500, 999999, FEE_RATE_DENOM].forEach(rate => {
            expect(parseFeeRate(formatFeeRate(rate).replace("%", ""))).toBe(
                rate
            );
        });
    });
});

describe("nextStartId", () => {
    it("steps to the next object id for paging", () => {
        expect(nextStartId("1.20.14")).toBe("1.20.15");
        expect(nextStartId("1.20.9")).toBe("1.20.10");
        expect(() => nextStartId("nonsense")).toThrow();
    });
});

describe("normalizeFund", () => {
    it("stringifies int64 values and keeps the rate numeric", () => {
        expect(
            normalizeFund({
                id: "1.20.12",
                owner_account: "1.2.1804540",
                asset_type: "1.3.0",
                balance: "100000823118",
                fee_rate: 300,
                unpaid_amount: 0
            })
        ).toEqual({
            id: "1.20.12",
            owner_account: "1.2.1804540",
            asset_type: "1.3.0",
            balance: "100000823118",
            fee_rate: 300,
            unpaid_amount: "0"
        });
        expect(
            normalizeFund({
                id: "1.20.1",
                owner_account: "1.2.3",
                asset_type: "1.3.1",
                balance: 5,
                fee_rate: 1
            }).unpaid_amount
        ).toBe("0");
    });
});

describe("operation builders", () => {
    it("builds a create operation that serializes losslessly", () => {
        const op = buildCreateOp({
            owner: "1.2.12345",
            assetId: "1.3.0",
            balance: "9007199254740993",
            feeRate: 300
        });
        expect(op).toEqual({
            fee: {amount: 0, asset_id: "1.3.0"},
            owner_account: "1.2.12345",
            asset_type: "1.3.0",
            balance: "9007199254740993",
            fee_rate: 300
        });
        const back = roundTrip("samet_fund_create", op);
        expect(back.balance).toBe("9007199254740993");
        expect(back.fee_rate).toBe(300);
        expect(back.owner_account).toBe("1.2.12345");
        expect(back.asset_type).toBe("1.3.0");
    });

    it("builds update operations for deposits, withdrawals and rate changes", () => {
        const withdraw = buildUpdateOp({
            owner: "1.2.12345",
            fundId: "1.20.14",
            deltaAmount: {assetId: "1.3.0", amount: "-5000"},
            newFeeRate: 500
        });
        const back = roundTrip("samet_fund_update", withdraw);
        expect(back.delta_amount).toEqual({amount: "-5000", asset_id: "1.3.0"});
        expect(back.new_fee_rate).toBe(500);
        expect(back.fund_id).toBe("1.20.14");

        const deposit = buildUpdateOp({
            owner: "1.2.12345",
            fundId: "1.20.14",
            deltaAmount: {assetId: "1.3.0", amount: "7"}
        });
        expect(deposit.new_fee_rate).toBeUndefined();
        expect(
            roundTrip("samet_fund_update", deposit).delta_amount.amount
        ).toBe("7");

        const rateOnly = buildUpdateOp({
            owner: "1.2.12345",
            fundId: "1.20.14",
            newFeeRate: 0
        });
        expect(rateOnly.delta_amount).toBeUndefined();
        expect(roundTrip("samet_fund_update", rateOnly).new_fee_rate).toBe(0);
    });

    it("builds a delete operation", () => {
        const op = buildDeleteOp({owner: "1.2.12345", fundId: "1.20.14"});
        const back = roundTrip("samet_fund_delete", op);
        expect(back.fund_id).toBe("1.20.14");
        expect(back.owner_account).toBe("1.2.12345");
    });

    it("lets the caller pick the fee asset", () => {
        expect(
            buildDeleteOp({
                owner: "1.2.1",
                fundId: "1.20.1",
                feeAssetId: "1.3.113"
            }).fee
        ).toEqual({amount: 0, asset_id: "1.3.113"});
    });

    it("refuses malformed or dangerous input instead of building it", () => {
        const base = {
            owner: "1.2.12345",
            assetId: "1.3.0",
            balance: "100",
            feeRate: 300
        };
        expect(() => buildCreateOp({...base, balance: "0"})).toThrow();
        expect(() => buildCreateOp({...base, balance: "-5"})).toThrow();
        expect(() => buildCreateOp({...base, balance: "1.5"})).toThrow();
        expect(() => buildCreateOp({...base, feeRate: -1})).toThrow();
        expect(() =>
            buildCreateOp({...base, feeRate: FEE_RATE_DENOM + 1})
        ).toThrow();
        expect(() => buildCreateOp({...base, feeRate: 1.5})).toThrow();
        expect(() => buildCreateOp({...base, owner: "1.3.0"})).toThrow();
        expect(() => buildCreateOp({...base, assetId: "1.2.5"})).toThrow();
        const upd = {owner: "1.2.12345", fundId: "1.20.14"};
        expect(() => buildUpdateOp(upd)).toThrow(/nothing to update/);
        expect(() =>
            buildUpdateOp({
                ...upd,
                deltaAmount: {assetId: "1.3.0", amount: "0"}
            })
        ).toThrow();
        expect(() =>
            buildUpdateOp({
                ...upd,
                deltaAmount: {assetId: "1.3.0", amount: "1.5"}
            })
        ).toThrow();
        expect(() =>
            buildUpdateOp({...upd, fundId: "1.21.14", newFeeRate: 1})
        ).toThrow();
        expect(() =>
            buildDeleteOp({owner: "1.2.12345", fundId: "x"})
        ).toThrow();
    });
});
