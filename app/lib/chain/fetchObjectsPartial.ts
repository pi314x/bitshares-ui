/**
 * Fetches chain objects (`fetch`, which rejects on a timeout) and, when that
 * does not succeed, makes the best of it instead of leaving the caller with
 * nothing.
 *
 * The chain store caches every object as it arrives, so a retry only waits
 * for the rest. After the last attempt `readNow` returns what is in the cache
 * (still missing objects as undefined). A list of 200 witnesses on a slow
 * connection used to stay empty for good: the rejection was never handled.
 */
export function fetchObjectsPartial<T>(
    fetch: () => Promise<T[]>,
    readNow: () => T[],
    attempts = 3
): Promise<T[]> {
    return fetch().catch(() =>
        attempts > 1
            ? fetchObjectsPartial(fetch, readNow, attempts - 1)
            : readNow()
    );
}
