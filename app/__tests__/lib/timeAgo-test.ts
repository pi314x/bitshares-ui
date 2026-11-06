import {timeAgo} from "../../lib/common/timeAgo";

describe("timeAgo", () => {
    const now = 1_000_000_000_000;
    it("says now, minutes, hours and days", () => {
        expect(timeAgo(now - 10_000, now)).toEqual({unit: "now", count: 0});
        expect(timeAgo(now - 50_000, now)).toEqual({unit: "minutes", count: 1});
        expect(timeAgo(now - 5 * 60_000, now)).toEqual({
            unit: "minutes",
            count: 5
        });
        expect(timeAgo(now - 3 * 3600_000, now)).toEqual({
            unit: "hours",
            count: 3
        });
        expect(timeAgo(now - 49 * 3600_000, now)).toEqual({
            unit: "days",
            count: 2
        });
    });
    it("never goes negative", () => {
        expect(timeAgo(now + 5000, now)).toEqual({unit: "now", count: 0});
    });
});
