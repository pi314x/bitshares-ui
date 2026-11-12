// An amount in the smallest units of an asset (a BigInt, as the chain has it) written the way the reader's language writes
// numbers. Kept apart from the parsing of what is typed: it is only the text of a figure.

// (not `10n ** n`: the build turns `**` into `Math.pow`, which is not for BigInt)
function pow10(n: number): bigint {
    let result = BigInt(1);
    for (let i = 0; i < n; i++) result *= BigInt(10);
    return result;
}

/**
 * Smallest units -> "1,234.5" in the number style of `locale` (the grouping and the decimal mark of the
 * reader's language). Exact: the whole part goes through BigInt, never through a double.
 */
export function formatUnitsLocal(
    units: bigint,
    precision: number,
    locale?: string
): string {
    const negative = units < BigInt(0);
    const abs = negative ? -units : units;
    const base = pow10(precision);
    const whole = (abs / base).toLocaleString(locale);
    const fraction = (abs % base)
        .toString()
        .padStart(precision, "0")
        .replace(/0+$/, "");
    const mark = (1.1).toLocaleString(locale).charAt(1) || ".";
    return `${negative ? "-" : ""}${whole}${fraction ? mark + fraction : ""}`;
}
