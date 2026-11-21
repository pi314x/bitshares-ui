// Numbers as the strategies page shows them.

/** An amount of money: whole above a thousand, two decimals above 1, else six significant digits. */
export function amountText(n: number): string {
    if (!Number.isFinite(n)) return "-";
    const abs = Math.abs(n);
    if (abs >= 1000)
        return n.toLocaleString(undefined, {maximumFractionDigits: 0});
    if (abs >= 1)
        return n.toLocaleString(undefined, {maximumFractionDigits: 2});
    return n.toLocaleString(undefined, {maximumSignificantDigits: 4});
}

/** A price or a size: six significant digits. */
export function priceText(n: number): string {
    return Number.isFinite(n)
        ? n.toLocaleString(undefined, {maximumSignificantDigits: 6})
        : "-";
}

/** With its sign: +12.3, -4.5, 0 */
export function signed(n: number): string {
    if (!Number.isFinite(n)) return "-";
    const text = amountText(Math.abs(n));
    return n > 0 ? `+${text}` : n < 0 ? `-${text}` : text;
}

export const percentText = (n: number, digits = 2): string =>
    Number.isFinite(n) ? n.toFixed(digits) : "-";

/** An amount in units of an asset (precision `precision`) as the person reads it. */
export function unitsText(units: bigint, precision: number): string {
    return (Number(units) / Math.pow(10, precision)).toLocaleString(undefined, {
        maximumFractionDigits: precision
    });
}
