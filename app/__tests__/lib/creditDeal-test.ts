import "../../lib/chain/extraOperations";
import {ops} from "bitsharesjs";
import {
    AUTO_REPAY_MODES,
    autoRepayOf,
    buildCreditDealUpdateOp
} from "../../lib/common/creditDeal";

describe("autoRepayOf", () => {
    it("reads the mode of a deal, and takes anything else for none", () => {
        expect(autoRepayOf({auto_repay: 2})).toBe(2);
        expect(autoRepayOf({auto_repay: "1"})).toBe(1);
        expect(autoRepayOf({})).toBe(0);
        expect(autoRepayOf(null)).toBe(0);
        expect(autoRepayOf({auto_repay: 7})).toBe(0);
    });
});

describe("buildCreditDealUpdateOp", () => {
    it("builds the operation for each mode the chain knows", () => {
        AUTO_REPAY_MODES.forEach(mode => {
            const op = buildCreditDealUpdateOp({
                account: "1.2.100",
                dealId: "1.22.7",
                autoRepay: mode
            });
            expect(op).toEqual({
                fee: {amount: 0, asset_id: "1.3.0"},
                account: "1.2.100",
                deal_id: "1.22.7",
                auto_repay: mode,
                extensions: []
            });
        });
    });

    it("refuses a mode the chain does not know", () => {
        expect(
            buildCreditDealUpdateOp({
                account: "1.2.100",
                dealId: "1.22.7",
                autoRepay: 3
            })
        ).toBeNull();
    });

    it("is an operation the serializer takes", () => {
        const op = buildCreditDealUpdateOp({
            account: "1.2.100",
            dealId: "1.22.7",
            autoRepay: 2
        });
        const operation = (ops as any).operation;
        const back = operation.toObject(operation.fromObject([76, op]));
        expect(back[1].auto_repay).toBe(2);
        expect(back[1].deal_id).toBe("1.22.7");
    });
});
