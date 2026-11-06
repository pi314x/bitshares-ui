import {
    HISTORY_DB_NAME,
    createIdbHistoryCache,
    createMemoryHistoryCache
} from "../../lib/common/balanceHistoryCache";
import {CachedHistory} from "../../lib/common/balanceHistoryStore";

const saved = (ids: number[]): CachedHistory => ({
    v: 1,
    entries: ids.map(n => ({
        id: `1.11.${n}`,
        op: [0, {}] as [number, any],
        block_num: n
    })),
    times: {1: 1000},
    complete: true,
    capped: false
});

// A small stand-in for IndexedDB: a database of stores of records by key, requests that
// answer on the next turn, and the events the cache listens to.
function fakeIndexedDb(options: {failOpen?: boolean} = {}) {
    const stores: {[name: string]: Map<string, any>} = {};
    const opened: string[] = [];
    const later = (fn: () => void) => setTimeout(fn, 0);
    const request = (work: () => any) => {
        const r: any = {};
        later(() => {
            r.result = work();
            r.onsuccess && r.onsuccess();
        });
        return r;
    };
    const factory: any = {
        open: (name: string) => {
            opened.push(name);
            const r: any = {};
            later(() => {
                if (options.failOpen) {
                    r.error = new Error("denied");
                    r.onerror && r.onerror();
                    return;
                }
                const db = {
                    createObjectStore: (store: string) => {
                        stores[store] = new Map();
                    },
                    transaction: (store: string) => {
                        const tx: any = {
                            objectStore: () => ({
                                get: (key: string) =>
                                    request(() => stores[store].get(key)),
                                put: (record: any) => {
                                    stores[store].set(record.key, record);
                                    later(
                                        () => tx.oncomplete && tx.oncomplete()
                                    );
                                },
                                clear: () => {
                                    stores[store].clear();
                                    later(
                                        () => tx.oncomplete && tx.oncomplete()
                                    );
                                }
                            })
                        };
                        return tx;
                    }
                };
                r.result = db;
                if (!Object.keys(stores).length) {
                    r.onupgradeneeded && r.onupgradeneeded();
                }
                r.onsuccess && r.onsuccess();
            });
            return r;
        }
    };
    return {factory, stores, opened};
}

describe("the memory cache", () => {
    it("keeps and forgets", async () => {
        const cache = createMemoryHistoryCache();
        expect(await cache.load("k")).toBeNull();
        await cache.save("k", saved([3, 2, 1]));
        expect((await cache.load("k"))!.entries).toHaveLength(3);
        await cache.clear!();
        expect(await cache.load("k")).toBeNull();
    });
});

describe("the IndexedDB cache", () => {
    it("is the memory cache where the browser has no IndexedDB", async () => {
        const cache = createIdbHistoryCache(null);
        await cache.save("k", saved([1]));
        expect((await cache.load("k"))!.entries).toHaveLength(1);
    });

    it("saves into its own database and reads it back", async () => {
        const idb = fakeIndexedDb();
        const cache = createIdbHistoryCache(idb.factory);
        expect(await cache.load("a")).toBeNull();
        await cache.save("a", saved([5, 4]));
        const back = await cache.load("a");
        expect(back!.entries.map(e => e.id)).toEqual(["1.11.5", "1.11.4"]);
        expect(back!.times).toEqual({1: 1000});
        expect(idb.opened).toEqual([HISTORY_DB_NAME]); // opened once, then reused
        await cache.clear!();
        expect(await cache.load("a")).toBeNull();
    });

    it("is best effort: a browser that refuses is a cache that is empty", async () => {
        const cache = createIdbHistoryCache(
            fakeIndexedDb({failOpen: true}).factory
        );
        expect(await cache.load("a")).toBeNull();
        await expect(cache.save("a", saved([1]))).resolves.toBeUndefined();
    });
});
