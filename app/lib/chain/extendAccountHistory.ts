import Immutable from "immutable";

// bitsharesjs's ChainStore fetches an account's most recent 100 operations (the
// node's limit for one request) and only ever prepends newer ones. This reads
// the next page of OLDER operations and appends it to the account's history in
// the store, so every screen that shows the history (Recent activity, the
// export) can go further back than the first hundred.

const idNumber = (id: string): number => Number(String(id).split(".")[2]);

export interface HistoryApi {
    exec(method: string, params: any[]): Promise<any[]>;
}

/**
 * Appends up to `limit` operations older than the oldest one in the store's
 * history of `accountId`. Resolves with how many were added (0 when there is
 * nothing older, or the account is not loaded).
 */
export type OlderFallback = (
    accountId: string,
    startId: string,
    limit: number
) => Promise<any[]>;

export async function extendAccountHistory(
    accountId: string,
    chainStore: any,
    historyApi: HistoryApi,
    limit = 100,
    /** Asked when the node has nothing older: other nodes may have more. */
    fallback?: OlderFallback
): Promise<number> {
    const account = chainStore.objects_by_id.get(accountId);
    if (!account || account === true) return 0;
    const history = account.get("history");
    if (!history || !history.size) return 0;

    const oldest = idNumber(history.last().get("id"));
    if (!(oldest > 1)) return 0;

    const startId = `1.11.${oldest - 1}`;
    let rows = await historyApi.exec("get_account_history", [
        accountId,
        "1.11.0",
        limit,
        startId
    ]);
    if ((!rows || !rows.length) && fallback) {
        rows = await fallback(accountId, startId, limit);
    }
    if (!rows || !rows.length) return 0;

    // the store may have moved on while the request was out
    const current = chainStore.objects_by_id.get(accountId);
    if (!current || current === true) return 0;
    const currentHistory = current.get("history") || Immutable.List();
    const currentOldest = currentHistory.size
        ? idNumber(currentHistory.last().get("id"))
        : Infinity;
    const fresh = rows.filter((row: any) => idNumber(row.id) < currentOldest);
    if (!fresh.length) return 0;

    chainStore.objects_by_id.set(
        accountId,
        current.set("history", currentHistory.concat(Immutable.fromJS(fresh)))
    );
    chainStore.notifySubscribers();
    return fresh.length;
}
