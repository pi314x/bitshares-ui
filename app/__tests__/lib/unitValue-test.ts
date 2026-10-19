import {formatUnitValue, toHuman} from "../../lib/common/unitValue";

describe("unitValue", () => {
    const usdt = {symbol: "XBTSX.USDT", precision: 5};

    it("turns the converted steps of the unit into a human figure", () => {
        expect(toHuman(123456, 5)).toBe(1.23456);
        expect(toHuman(0, 5)).toBe(0);
    });

    it("has no figure without a price", () => {
        expect(toHuman(null, 5)).toBeNull();
        expect(toHuman(undefined, 5)).toBeNull();
        expect(toHuman(NaN, 5)).toBeNull();
        expect(toHuman(Infinity, 5)).toBeNull();
    });

    it("writes cents from 1 up and four decimals below", () => {
        expect(formatUnitValue(1234.5678, usdt, "en-US")).toBe(
            "1,234.57 XBTSX.USDT"
        );
        expect(formatUnitValue(0.123456, usdt, "en-US")).toBe(
            "0.1235 XBTSX.USDT"
        );
    });

    it("never writes more decimals than the unit has", () => {
        expect(
            formatUnitValue(0.123456, {symbol: "X", precision: 2}, "en-US")
        ).toBe("0.12 X");
    });
});
