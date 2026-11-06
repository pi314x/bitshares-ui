// Where the history of an account is kept on this device: an IndexedDB database of its own
// (the entries are too many for localStorage), or the memory of the page where the browser
// has none (a private window, a test). The copy is public chain data - no key, no password -
// and "delete local data" removes the database (lib/common/deleteLocal.ts).
import {CachedHistory, HistoryCache} from "./balanceHistoryStore";

export const HISTORY_DB_NAME = "bts_desk_cache";
const STORE = "balance_history";

export function createMemoryHistoryCache(): HistoryCache {
    const saved = new Map<string, CachedHistory>();
    return {
        load: key => Promise.resolve(saved.get(key) || null),
        save: (key, value) => {
            saved.set(key, value);
            return Promise.resolve();
        },
        clear: () => {
            saved.clear();
            return Promise.resolve();
        }
    };
}

export function createIdbHistoryCache(
    factory: IDBFactory | null | undefined = typeof indexedDB !== "undefined"
        ? indexedDB
        : null
): HistoryCache {
    if (!factory) return createMemoryHistoryCache();
    let opening: Promise<IDBDatabase> | null = null;
    const open = (): Promise<IDBDatabase> => {
        if (!opening) {
            opening = new Promise<IDBDatabase>((resolve, reject) => {
                const request = factory.open(HISTORY_DB_NAME, 1);
                request.onupgradeneeded = () => {
                    request.result.createObjectStore(STORE, {keyPath: "key"});
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
                request.onblocked = () => reject(new Error("blocked"));
            });
            // a failed opening is tried again next time
            opening.catch(() => {
                opening = null;
            });
        }
        return opening;
    };
    return {
        load: key =>
            open()
                .then(
                    db =>
                        new Promise<CachedHistory | null>(resolve => {
                            const request = db
                                .transaction(STORE, "readonly")
                                .objectStore(STORE)
                                .get(key);
                            request.onsuccess = () =>
                                resolve(
                                    request.result ? request.result.value : null
                                );
                            request.onerror = () => resolve(null);
                        })
                )
                .catch(() => null),
        save: (key, value) =>
            open()
                .then(
                    db =>
                        new Promise<void>(resolve => {
                            const tx = db.transaction(STORE, "readwrite");
                            tx.objectStore(STORE).put({
                                key,
                                value,
                                savedAt: Date.now()
                            });
                            tx.oncomplete = () => resolve();
                            tx.onerror = () => resolve();
                            tx.onabort = () => resolve();
                        })
                )
                .catch(() => undefined),
        clear: () =>
            open()
                .then(
                    db =>
                        new Promise<void>(resolve => {
                            const tx = db.transaction(STORE, "readwrite");
                            tx.objectStore(STORE).clear();
                            tx.oncomplete = () => resolve();
                            tx.onerror = () => resolve();
                            tx.onabort = () => resolve();
                        })
                )
                .catch(() => undefined)
    };
}
