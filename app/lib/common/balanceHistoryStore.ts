// The history an account's balance chart is built from, loaded in the background and
// kept: the newest operations first (the chart can draw at once), then page after page
// of older ones until the account's first operation, and all of it saved on this device
// so the next visit starts from what was there and only asks for what is new.
//
// The store lives outside the screens that show it: the Dashboard and the Portfolio draw
// the same chart, and leaving one for the other must not start the work again. Pure
// logic: the node (`HistorySource`) and the storage (`HistoryCache`) are handed in.
import {HistoryEntry, PAGE, olderStart} from "./balanceHistory";

/** The most operations loaded for one account (a trader's history can have a million). */
export const MAX_ENTRIES = 30000;

export interface HistoryState {
    /** newest first */
    entries: HistoryEntry[];
    /** block number -> unix seconds */
    times: {[block: number]: number};
    /** the account's first operation is in `entries` (or the cap was reached) */
    complete: boolean;
    /** stopped at the cap: older operations exist and are not loaded */
    capped: boolean;
    /** the node that supplied the older operations when it was not the connected one */
    source: string | null;
    /** a request, or the next one, is on its way */
    loading: boolean;
    /** the start of `entries` came from this device's saved copy */
    cached: boolean;
    error: string | null;
}

export interface CachedHistory {
    v: 1;
    entries: HistoryEntry[];
    times: {[block: number]: number};
    complete: boolean;
    capped: boolean;
}

export interface HistoryCache {
    load(key: string): Promise<CachedHistory | null>;
    save(key: string, value: CachedHistory): Promise<void>;
    /** forget everything (a test, or deleting the local data) */
    clear?(): Promise<void>;
}

export interface HistorySource {
    /** the chain the node serves: a saved copy is for one chain only */
    chainKey(): string;
    /** a page of an account's operations, newest first, from `start` (null = the newest) */
    getHistoryPage(
        accountId: string,
        start: string | null
    ): Promise<{rows: HistoryEntry[]; source: string | null}>;
    getBlockTimes(blocks: number[]): Promise<{[block: number]: number}>;
}

export interface StoreOptions {
    maxEntries?: number;
    now?: () => number;
    /** how long after a change the saved copy is written (a write is the whole list) */
    persistDelayMs?: number;
    /** a finished account is asked for what is new at most this often */
    refreshEveryMs?: number;
}

export const EMPTY_HISTORY: HistoryState = {
    entries: [],
    times: {},
    complete: false,
    capped: false,
    source: null,
    loading: false,
    cached: false,
    error: null
};

const idNumber = (id: string): number => Number(id.split(".")[2]);

/** A big list is shown a few times a second, not once per page. */
const BIG_LIST = 1000;
const BIG_LIST_NOTIFY_MS = 250;

export class BalanceHistoryStore {
    private states = new Map<string, HistoryState>();
    private listeners = new Map<string, Set<() => void>>();
    private tasks = new Map<string, Promise<void>>();
    private hydrated = new Set<string>();
    private refreshedAt = new Map<string, number>();
    private persistTimers = new Map<string, ReturnType<typeof setTimeout>>();
    private notifyTimers = new Map<string, ReturnType<typeof setTimeout>>();

    constructor(
        private source: HistorySource,
        private cache: HistoryCache,
        private options: StoreOptions = {}
    ) {}

    private key(accountId: string): string {
        return `${this.source.chainKey()}:${accountId}`;
    }

    private now(): number {
        return (this.options.now || Date.now)();
    }

    getState(accountId: string): HistoryState {
        return this.states.get(accountId) || EMPTY_HISTORY;
    }

    subscribe(accountId: string, listener: () => void): () => void {
        let set = this.listeners.get(accountId);
        if (!set) {
            set = new Set();
            this.listeners.set(accountId, set);
        }
        set.add(listener);
        return () => {
            set!.delete(listener);
        };
    }

    /**
     * Begin (or join) the loading of an account's history. Resolves when it has
     * finished or stopped on an error; calling it again resumes where it stopped.
     */
    start(accountId: string): Promise<void> {
        const running = this.tasks.get(accountId);
        if (running) return running;
        const state = this.getState(accountId);
        const refreshEvery = this.options.refreshEveryMs ?? 30000;
        if (
            state.complete &&
            !state.error &&
            this.now() - (this.refreshedAt.get(accountId) || 0) < refreshEvery
        ) {
            return Promise.resolve();
        }
        const task = this.run(accountId).then(() => {
            this.tasks.delete(accountId);
        });
        this.tasks.set(accountId, task);
        return task;
    }

    /** Forget everything held in memory (and in the cache when it can). */
    async reset(): Promise<void> {
        this.persistTimers.forEach(timer => clearTimeout(timer));
        this.notifyTimers.forEach(timer => clearTimeout(timer));
        this.persistTimers.clear();
        this.notifyTimers.clear();
        this.states.clear();
        this.tasks.clear();
        this.hydrated.clear();
        this.refreshedAt.clear();
        if (this.cache.clear) await this.cache.clear();
    }

    // ---------------------------------------------------------------- loading

    private async run(accountId: string): Promise<void> {
        this.update(accountId, {loading: true, error: null});
        try {
            if (!this.hydrated.has(accountId)) {
                this.hydrated.add(accountId);
                const saved = await this.cache
                    .load(this.key(accountId))
                    .catch(() => null);
                if (saved && saved.v === 1 && saved.entries.length) {
                    this.update(accountId, {
                        entries: saved.entries,
                        times: saved.times || {},
                        complete: !!saved.complete,
                        capped: !!saved.capped,
                        cached: true
                    });
                }
            }
            await this.fetchNewer(accountId);
            await this.fetchOlder(accountId);
            this.refreshedAt.set(accountId, this.now());
        } catch (error) {
            this.update(accountId, {
                error: String((error && (error as any).message) || error)
            });
        }
        this.update(accountId, {loading: false});
        await this.persistNow(accountId);
    }

    /** The operations since the saved copy (or the newest page when there is none). */
    private async fetchNewer(accountId: string): Promise<void> {
        const existing = this.getState(accountId).entries;
        const known = existing.length ? idNumber(existing[0].id) : 0;
        let start: string | null = null;
        let fresh: HistoryEntry[] = [];
        for (;;) {
            const {rows} = await this.source.getHistoryPage(accountId, start);
            if (!rows.length) {
                if (!existing.length) this.update(accountId, {complete: true});
                return;
            }
            const newer = rows.filter(row => idNumber(row.id) > known);
            const times = await this.timesFor(accountId, newer);
            fresh = fresh.concat(newer);
            this.update(accountId, {
                entries: fresh.concat(existing),
                times
            });
            this.schedulePersist(accountId);
            // nothing saved: this was the first page, the rest is "older"
            if (!existing.length) return;
            // the gap is closed when a page reaches what was saved, or is the last
            if (newer.length < rows.length || rows.length < PAGE) return;
            start = olderStart(rows);
            if (!start) return;
        }
    }

    /** Page after page back to the account's first operation. */
    private async fetchOlder(accountId: string): Promise<void> {
        const max = this.options.maxEntries ?? MAX_ENTRIES;
        for (;;) {
            const state = this.getState(accountId);
            if (state.complete) return;
            if (state.entries.length >= max) {
                this.update(accountId, {complete: true, capped: true});
                return;
            }
            const start = olderStart(state.entries);
            if (!start) {
                this.update(accountId, {complete: true});
                return;
            }
            const {rows, source} = await this.source.getHistoryPage(
                accountId,
                start
            );
            const oldest = idNumber(state.entries[state.entries.length - 1].id);
            const older = rows.filter(row => idNumber(row.id) < oldest);
            if (!older.length) {
                this.update(accountId, {complete: true});
                return;
            }
            const times = await this.timesFor(accountId, older);
            this.update(accountId, {
                entries: state.entries.concat(older),
                times,
                source: source || state.source
            });
            this.schedulePersist(accountId);
        }
    }

    /** The times of the blocks of `rows`, the known ones plus the missing ones asked for. */
    private async timesFor(
        accountId: string,
        rows: HistoryEntry[]
    ): Promise<{[block: number]: number}> {
        const known = this.getState(accountId).times;
        const missing = Array.from(
            new Set(rows.map(row => row.block_num))
        ).filter(block => known[block] === undefined);
        if (!missing.length) return known;
        const found = await this.source.getBlockTimes(missing);
        return {...known, ...found};
    }

    // ------------------------------------------------------------- state, saving

    private update(accountId: string, patch: Partial<HistoryState>): void {
        this.states.set(accountId, {...this.getState(accountId), ...patch});
        this.emit(accountId);
    }

    private emit(accountId: string): void {
        const delay =
            this.getState(accountId).entries.length > BIG_LIST
                ? BIG_LIST_NOTIFY_MS
                : 0;
        if (!delay) {
            this.listeners.get(accountId)?.forEach(listener => listener());
            return;
        }
        if (this.notifyTimers.has(accountId)) return;
        this.notifyTimers.set(
            accountId,
            setTimeout(() => {
                this.notifyTimers.delete(accountId);
                this.listeners.get(accountId)?.forEach(listener => listener());
            }, delay)
        );
    }

    private schedulePersist(accountId: string): void {
        if (this.persistTimers.has(accountId)) return;
        this.persistTimers.set(
            accountId,
            setTimeout(() => {
                this.persistTimers.delete(accountId);
                this.persistNow(accountId);
            }, this.options.persistDelayMs ?? 2000)
        );
    }

    private async persistNow(accountId: string): Promise<void> {
        const timer = this.persistTimers.get(accountId);
        if (timer) {
            clearTimeout(timer);
            this.persistTimers.delete(accountId);
        }
        const state = this.getState(accountId);
        if (!state.entries.length) return;
        try {
            await this.cache.save(this.key(accountId), {
                v: 1,
                entries: state.entries,
                times: state.times,
                complete: state.complete,
                capped: state.capped
            });
        } catch (e) {
            // a copy that could not be saved only means the next visit loads again
        }
    }
}
