import {
    MAX_LEAD_SECONDS,
    MIN_LEAD_SECONDS,
    buildTimedTransferOp,
    checkRelease,
    parseLocalDateTime,
    toChainTime
} from "../../lib/common/timedTransfer";

const NOW = 1800000000; // 2027-01-15T08:00:00Z
const base = {
    creator: "1.2.100",
    owner: "1.2.200",
    assetId: "1.3.0",
    amount: "150000",
    nowSec: NOW,
    releaseSec: NOW + 7 * 86400
};

describe("buildTimedTransferOp", () => {
    it("locks everything until the release time with a linear policy", () => {
        const op: any = buildTimedTransferOp(base);
        expect(op.creator).toBe("1.2.100");
        expect(op.owner).toBe("1.2.200");
        expect(op.amount).toEqual({amount: "150000", asset_id: "1.3.0"});
        expect(op.fee).toEqual({amount: 0, asset_id: "1.3.0"});
        const [variant, policy] = op.policy;
        expect(variant).toBe(0); // linear_vesting_policy_initializer
        expect(policy.begin_timestamp).toBe(toChainTime(NOW));
        // cliff == duration: nothing before the release, all of it at it
        expect(policy.vesting_cliff_seconds).toBe(7 * 86400);
        expect(policy.vesting_duration_seconds).toBe(7 * 86400);
    });

    it("uses the chain's time format", () => {
        expect(toChainTime(NOW)).toBe("2027-01-15T08:00:00");
    });

    it("pays the fee in the asset asked for", () => {
        const op: any = buildTimedTransferOp({...base, feeAssetId: "1.3.121"});
        expect(op.fee.asset_id).toBe("1.3.121");
    });

    it("refuses a release in the past, too soon, or too far", () => {
        expect(() =>
            buildTimedTransferOp({...base, releaseSec: NOW - 5})
        ).toThrow(/past/);
        expect(() =>
            buildTimedTransferOp({
                ...base,
                releaseSec: NOW + MIN_LEAD_SECONDS - 1
            })
        ).toThrow(/too_soon/);
        expect(() =>
            buildTimedTransferOp({
                ...base,
                releaseSec: NOW + MAX_LEAD_SECONDS + 1
            })
        ).toThrow(/too_far/);
    });

    it("refuses bad ids and amounts", () => {
        expect(() => buildTimedTransferOp({...base, owner: "alice"})).toThrow(
            /recipient/
        );
        expect(() => buildTimedTransferOp({...base, assetId: "1.2.5"})).toThrow(
            /asset/
        );
        ["0", "-5", "1.5", "", "abc"].forEach(amount => {
            expect(() => buildTimedTransferOp({...base, amount})).toThrow(
                /amount/
            );
        });
    });

    it("accepts exactly the minimum lead", () => {
        const op: any = buildTimedTransferOp({
            ...base,
            releaseSec: NOW + MIN_LEAD_SECONDS
        });
        expect(op.policy[1].vesting_duration_seconds).toBe(MIN_LEAD_SECONDS);
    });
});

describe("checkRelease / parseLocalDateTime", () => {
    it("classifies the release time", () => {
        expect(checkRelease(NOW, NOW + 3600)).toEqual({
            ok: true,
            seconds: 3600
        });
        expect(checkRelease(NOW, NOW)).toEqual({ok: false, reason: "past"});
    });

    it("parses a datetime-local value and rejects anything else", () => {
        expect(typeof parseLocalDateTime("2030-06-01T12:30")).toBe("number");
        expect(parseLocalDateTime("2030-06-01T12:30:15")).toBe(
            (parseLocalDateTime("2030-06-01T12:30") as number) + 15
        );
        expect(parseLocalDateTime("")).toBeNull();
        expect(parseLocalDateTime("tomorrow")).toBeNull();
        expect(parseLocalDateTime("2030-13-45T99:99")).toBeNull();
    });
});
