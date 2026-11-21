import {formatDateTime} from "../../lib/common/dateTime";

describe("formatDateTime", () => {
    it("writes the afternoon on a 24-hour clock, with no AM/PM", () => {
        const text = formatDateTime(new Date(2026, 10, 16, 21, 36, 42));
        expect(text).toContain("21:36:42");
        expect(text).not.toMatch(/AM|PM/i);
    });

    it("writes midnight as 00, not 24 and not 12", () => {
        const text = formatDateTime(new Date(2026, 10, 17, 0, 5, 9));
        expect(text).toContain("00:05:09");
        expect(text).not.toMatch(/24:05|12:05|AM|PM/i);
    });

    it("takes a number of milliseconds and an ISO string as well as a Date", () => {
        const date = new Date(2026, 10, 17, 7, 8, 9);
        expect(formatDateTime(date.getTime())).toBe(formatDateTime(date));
        expect(formatDateTime(date.toISOString())).toBe(formatDateTime(date));
        expect(formatDateTime(date)).toContain("07:08:09");
    });
});
