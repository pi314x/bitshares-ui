// An account's history entries, the sequence numbers that order them, and how an amount
// is written.

export interface HistoryEntry {
    /** "1.11.1399572292" */
    id: string;
    op: [number, any];
    /** what the operation produced (an instant settlement says what was received) */
    result?: any;
}

/** The number at the end of an operation history id; -1 if it has none. */
export function historySequence(id: string): number {
    const m = /^1\.11\.(\d+)$/.exec(id);
    return m ? Number(m[1]) : -1;
}

/** The newest history sequence number among `entries`, or -1. */
export function newestSequence(entries: HistoryEntry[]): number {
    return entries.reduce((n, e) => Math.max(n, historySequence(e.id)), -1);
}

/**
 * An amount as the wallet writes it: the asset's symbol and the amount at the
 * asset's own precision ("49,620.21536 BTS"), grouped by thousands, never
 * rounded. `asset` is what is known of the asset (symbol and precision); the
 * core asset is known without asking the chain.
 */
export function formatAssetAmount(
    amount: {amount: string | number; asset_id: string} | null | undefined,
    asset: {symbol: string; precision: number} | null | undefined,
    locale?: string
): string {
    if (!amount) return "";
    const known =
        asset ||
        (amount.asset_id === "1.3.0" ? {symbol: "BTS", precision: 5} : null);
    if (!known) return `${amount.amount} ${amount.asset_id}`;
    const value = Number(amount.amount) / Math.pow(10, known.precision);
    return `${value.toLocaleString(locale, {
        minimumFractionDigits: known.precision,
        maximumFractionDigits: known.precision
    })} ${known.symbol}`;
}
