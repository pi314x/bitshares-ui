// Which of an account's history entries are trades (fill orders) that happened
// since the last one the user was told about.

export interface HistoryEntry {
    /** "1.11.1399572292" */
    id: string;
    op: [number, any];
}

export const FILL_ORDER = 4;

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
 * The fills of `accountId` newer than `after`, oldest first, at most `limit`
 * (the newest ones when there are more).
 */
export function newFills(
    entries: HistoryEntry[],
    accountId: string,
    after: number,
    limit = 5
): HistoryEntry[] {
    const fills = entries
        .filter(
            e =>
                e.op &&
                e.op[0] === FILL_ORDER &&
                e.op[1] &&
                e.op[1].account_id === accountId &&
                historySequence(e.id) > after
        )
        .sort((a, b) => historySequence(a.id) - historySequence(b.id));
    return fills.slice(-limit);
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
