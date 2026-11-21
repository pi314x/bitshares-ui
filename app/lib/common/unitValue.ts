// What an amount of an asset is worth in the user's chosen currency (the
// preferred unit of account, Settings), written the way the wallet writes
// figures. The conversion itself is `next/dashboard/balanceCalculations`'s
// `convertAssetValue` (a market price, directly or through the core asset);
// this is the part around it that is plain arithmetic and text.

/**
 * `unitsOfUnit` (what `convertAssetValue` returns: in the unit's smallest
 * steps) as a human figure, or null when there is no price.
 */
export function toHuman(
    unitsOfUnit: number | null | undefined,
    unitPrecision: number
): number | null {
    if (unitsOfUnit === null || unitsOfUnit === undefined) return null;
    if (!Number.isFinite(unitsOfUnit)) return null;
    return unitsOfUnit / Math.pow(10, unitPrecision);
}

/**
 * "1,234.56 XBTSX.USDT": two decimals from 1 up (cents), four below it, never
 * more than the unit's precision.
 */
export function formatUnitValue(
    value: number,
    unit: {symbol: string; precision: number},
    locale?: string
): string {
    const abs = Math.abs(value);
    const digits = Math.min(unit.precision, abs >= 1 ? 2 : 4);
    return `${value.toLocaleString(locale, {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    })} ${unit.symbol}`;
}
