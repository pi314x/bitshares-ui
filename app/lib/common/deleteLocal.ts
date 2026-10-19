// Deleting what this browser holds for the app: the local wallets and their keys (the
// IndexedDB databases), and the saved settings and preferences (localStorage). The
// BitShares blockchain is not touched - the accounts and funds stay where they are -
// but without a backup of the keys nothing here can be brought back, so the screens
// that call this make the user approve twice (lib is the part that deletes).
//
// Names of what is ours: IndexedDB `graphene_db_<chain>` (the root: which wallet is
// current, the wallets' names) and `graphene_v2_<chain>_<wallet>` (one per wallet and
// chain: the wallet record, its keys, the linked accounts); localStorage keys that
// start with `__graphene__` or `__bts__`, and the theme.

export const INDEXED_DB_PREFIXES = ["graphene_db", "graphene_v2"];
export const STORAGE_PREFIXES = ["__graphene__", "__bts__"];
export const STORAGE_KEYS = ["bts-ui-theme"];

export interface DeleteEnvironment {
    indexedDB?: {
        deleteDatabase: (name: string) => any;
        databases?: () => Promise<Array<{name?: string}>>;
    } | null;
    localStorage?: {
        length: number;
        key: (index: number) => string | null;
        removeItem: (key: string) => void;
    } | null;
}

export interface LocalInventory {
    databases: string[];
    storageKeys: string[];
}

const isOurs = (name: string, prefixes: string[]) =>
    prefixes.some(prefix => name.startsWith(prefix));

/** What there is to delete, as far as the browser lets us list it. */
export async function localInventory(
    env: DeleteEnvironment,
    /** database names to add when the browser cannot list them (older Firefox) */
    knownDatabases: string[] = []
): Promise<LocalInventory> {
    const names = new Set<string>(knownDatabases);
    try {
        if (env.indexedDB && typeof env.indexedDB.databases === "function") {
            const listed = await env.indexedDB.databases();
            listed.forEach(entry => {
                if (entry.name && isOurs(entry.name, INDEXED_DB_PREFIXES)) {
                    names.add(entry.name);
                }
            });
        }
    } catch (e) {
        // the list is only what the browser can tell
    }
    const keys: string[] = [];
    const storage = env.localStorage;
    if (storage) {
        for (let i = 0; i < storage.length; i++) {
            const key = storage.key(i);
            if (
                key &&
                (isOurs(key, STORAGE_PREFIXES) || STORAGE_KEYS.includes(key))
            ) {
                keys.push(key);
            }
        }
    }
    return {databases: Array.from(names).sort(), storageKeys: keys.sort()};
}

export interface DeleteResult {
    databases: string[];
    storageKeys: number;
    /** databases another tab still had open: deleted as soon as that tab lets go */
    blocked: string[];
}

function deleteDatabase(
    factory: NonNullable<DeleteEnvironment["indexedDB"]>,
    name: string,
    timeoutMs: number
): Promise<"deleted" | "blocked"> {
    return new Promise((resolve, reject) => {
        let blocked = false;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const request = factory.deleteDatabase(name);
        request.onsuccess = () => {
            if (timer) clearTimeout(timer);
            resolve("deleted");
        };
        request.onerror = () => {
            if (timer) clearTimeout(timer);
            reject(request.error || new Error(`Could not delete ${name}`));
        };
        request.onblocked = () => {
            blocked = true;
            // the delete goes through when the other connection closes; do not
            // wait for it forever
            timer = setTimeout(() => resolve("blocked"), timeoutMs);
        };
        if (blocked) return;
    });
}

/**
 * Delete the databases and the saved keys of `inventory`. `closeConnections` is called
 * first (the app's own open connections would block the deletion). Resolves with what
 * was deleted; rejects when a database cannot be deleted.
 */
export async function deleteLocalData(
    env: DeleteEnvironment,
    inventory: LocalInventory,
    options: {closeConnections?: () => void; timeoutMs?: number} = {}
): Promise<DeleteResult> {
    try {
        if (options.closeConnections) options.closeConnections();
    } catch (e) {
        // already closed
    }
    const result: DeleteResult = {databases: [], storageKeys: 0, blocked: []};
    if (env.indexedDB) {
        for (const name of inventory.databases) {
            const outcome = await deleteDatabase(
                env.indexedDB,
                name,
                options.timeoutMs ?? 3000
            );
            if (outcome === "deleted") result.databases.push(name);
            else result.blocked.push(name);
        }
    }
    if (env.localStorage) {
        inventory.storageKeys.forEach(key => {
            env.localStorage!.removeItem(key);
            result.storageKeys++;
        });
    }
    return result;
}

// ----- the two approvals

export type DeleteStep = "warning" | "final";

/** The word to type for the last approval. */
export const CONFIRM_WORD = "DELETE";

/** The first approval: the warning read, the risk accepted. */
export function canContinue(accepted: boolean): boolean {
    return accepted === true;
}

/** The second approval: the word typed exactly as it is shown. */
export function canDelete(typed: string): boolean {
    return typed.trim() === CONFIRM_WORD;
}
