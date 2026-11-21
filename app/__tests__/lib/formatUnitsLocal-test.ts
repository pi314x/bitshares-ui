import {formatUnitsLocal} from "../../lib/common/formatUnitsLocal";

describe("amounts in the reader's number style", () => {
    it("groups the whole part and drops trailing zeros", () => {
        expect(formatUnitsLocal(BigInt("123456789012"), 5, "en")).toBe(
            "1,234,567.89012"
        );
        expect(formatUnitsLocal(BigInt("1250000"), 5, "en")).toBe("12.5");
        expect(formatUnitsLocal(BigInt("1200000"), 5, "en")).toBe("12");
        expect(formatUnitsLocal(BigInt(0), 5, "en")).toBe("0");
        expect(formatUnitsLocal(BigInt(1), 5, "en")).toBe("0.00001");
    });

    it("uses the grouping and decimal mark of the language", () => {
        expect(formatUnitsLocal(BigInt("123456789012"), 5, "de")).toBe(
            "1.234.567,89012"
        );
    });

    it("is exact above what a double holds", () => {
        // 2^53 + 1 smallest units, 0 decimals: a Number would print ...992
        expect(formatUnitsLocal(BigInt("9007199254740993"), 0, "en")).toBe(
            "9,007,199,254,740,993"
        );
    });

    it("writes a negative amount with its sign", () => {
        expect(formatUnitsLocal(BigInt(-150000), 5, "en")).toBe("-1.5");
    });
});
