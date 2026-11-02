// The address book: the accounts the user pays, with who they are and the memo to send with a payment (an
// exchange's deposit tag, an invoice number, the address of a withdrawal). An entry can be for one ASSET: a
// withdrawal of an asset goes to the account of its gateway with the address in the memo, and the same account
// takes another address for another asset, so the book keeps one entry for each account and asset (no asset:
// the entry is for any). Kept in this browser; nothing here is a key or a secret, but it is the user's own list,
// so it can be exported and imported as a file.
//
// A small external store (read with `useSyncExternalStore`), persisted in localStorage.
import * as React from "react";

export interface AddressEntry {
    id: string;
    /** the BitShares account name */
    name: string;
    /** who it is, in the user's words ("Landlord") */
    label: string;
    /** anything worth knowing about the recipient */
    note: string;
    /** the memo to send with a payment to it (may be empty) */
    memo: string;
    /** the symbol of the asset the entry is for (a withdrawal of it); empty: any asset */
    asset: string;
    /** ms since the epoch */
    at: number;
}

export type AddressInput = Pick<AddressEntry, "name"> &
    Partial<Pick<AddressEntry, "id" | "label" | "note" | "memo" | "asset">>;

export const MAX_ENTRIES = 500;
export const MAX_LABEL = 60;
export const MAX_NOTE = 500;
export const MAX_MEMO = 256;
export const MAX_ASSET = 16;

const KEY = "__graphene__addressBook";

/** A BitShares account name: lower case, digits, dashes and dots, from 3 to 63 characters. */
export const validAccountName = (name: string): boolean =>
    /^[a-z][a-z0-9.-]{1,61}[a-z0-9]$/.test(name);

/** A BitShares asset symbol: upper case letters, digits and dots, from 3 to 16 characters, a letter first. */
export const validAssetSymbol = (symbol: string): boolean =>
    /^[A-Z][A-Z0-9.]{1,14}[A-Z0-9]$/.test(symbol);

/** The symbol as it is kept: trimmed, upper case, or empty when it is not a symbol (then the entry is for any asset). */
export const normalizeAsset = (value: unknown): string => {
    const symbol =
        typeof value === "string"
            ? value
                  .trim()
                  .slice(0, MAX_ASSET)
                  .toUpperCase()
            : "";
    return validAssetSymbol(symbol) ? symbol : "";
};

const clean = (value: unknown, max: number): string =>
    typeof value === "string" ? value.trim().slice(0, max) : "";

function sanitize(raw: any): AddressEntry | null {
    if (!raw || typeof raw !== "object") return null;
    const name = clean(raw.name, 63).toLowerCase();
    if (!validAccountName(name)) return null;
    return {
        id:
            typeof raw.id === "string" && raw.id
                ? raw.id.slice(0, 40)
                : makeId(),
        name,
        label: clean(raw.label, MAX_LABEL),
        note: clean(raw.note, MAX_NOTE),
        memo: clean(raw.memo, MAX_MEMO),
        asset: normalizeAsset(raw.asset),
        at: typeof raw.at === "number" && isFinite(raw.at) ? raw.at : Date.now()
    };
}

/** What an entry is for: the account and the asset (an empty asset is any). */
const targetOf = (entry: {name: string; asset: string}): string =>
    `${entry.name}|${entry.asset}`;

let counter = 0;
function makeId(): string {
    counter++;
    return `${Date.now().toString(36)}${counter.toString(36)}${Math.floor(
        Math.random() * 1296
    ).toString(36)}`;
}

function load(): AddressEntry[] {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(KEY) || "[]");
        if (!Array.isArray(parsed)) return [];
        const seen = new Set<string>();
        const out: AddressEntry[] = [];
        for (const raw of parsed) {
            const entry = sanitize(raw);
            // an account is in the book once for each asset
            if (entry && !seen.has(targetOf(entry))) {
                seen.add(targetOf(entry));
                out.push(entry);
            }
        }
        return out.slice(0, MAX_ENTRIES);
    } catch (e) {
        return [];
    }
}

let entries: AddressEntry[] = load();
const listeners = new Set<() => void>();

function emit() {
    listeners.forEach(listener => listener());
}

function save() {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(entries));
    } catch (e) {
        // not kept: the list stays for this visit
    }
}

export const getAddressBook = (): AddressEntry[] => entries;

/**
 * The entry for an account name, if the book has one. With an asset (a symbol), the entry for that asset, or else
 * the account's entry for any asset: what is to be paid in that asset. Without one, the account's entry for any
 * asset, or else its newest entry.
 */
export function findEntry(
    name: string | null | undefined,
    list: AddressEntry[] = entries,
    asset?: string | null
): AddressEntry | undefined {
    if (!name) return undefined;
    const wanted = name.trim().toLowerCase();
    const mine = list.filter(entry => entry.name === wanted);
    const wantedAsset = normalizeAsset(asset);
    if (wantedAsset) {
        return (
            mine.find(entry => entry.asset === wantedAsset) ||
            mine.find(entry => !entry.asset)
        );
    }
    return mine.find(entry => !entry.asset) || mine[0];
}

/**
 * Whether an operation of an account's history is a payment that one of these accounts sent (a withdrawal to an
 * exchange or a gateway is one): the recipient of such a payment can be saved in the book.
 */
export function isSentPayment(
    type: string | undefined,
    payload: any,
    ownIds: Array<string | null | undefined>
): boolean {
    return (
        type === "transfer" &&
        !!payload &&
        typeof payload.from === "string" &&
        ownIds.indexOf(payload.from) >= 0
    );
}

export type SaveResult =
    | {ok: true; entry: AddressEntry}
    | {ok: false; error: "name" | "duplicate" | "full"};

/**
 * Adds an entry, or changes the one with the same `id` (moving it onto the account and asset of another entry is
 * refused: an account is in the book once for each asset).
 */
export function saveEntry(input: AddressInput): SaveResult {
    const entry = sanitize({...input, id: input.id || undefined});
    if (!entry) return {ok: false, error: "name"};
    const index = input.id ? entries.findIndex(e => e.id === input.id) : -1;
    const clash = entries.find(e => targetOf(e) === targetOf(entry));
    if (clash && (index < 0 || clash.id !== entries[index].id)) {
        return {ok: false, error: "duplicate"};
    }
    if (index >= 0) {
        entries = entries.map((e, i) =>
            i === index ? {...entry, id: e.id, at: e.at} : e
        );
    } else {
        if (entries.length >= MAX_ENTRIES) return {ok: false, error: "full"};
        entries = [entry, ...entries];
    }
    save();
    emit();
    return {
        ok: true,
        entry: entries.find(
            e => targetOf(e) === targetOf(entry)
        ) as AddressEntry
    };
}

export function removeEntry(id: string): void {
    if (!entries.some(entry => entry.id === id)) return;
    entries = entries.filter(entry => entry.id !== id);
    save();
    emit();
}

/** The book as a file the user can keep. */
export function exportAddressBook(list: AddressEntry[] = entries): string {
    return JSON.stringify(
        {
            format: "address-book",
            version: 1,
            entries: list.map(({name, label, note, memo, asset}) => ({
                name,
                label,
                note,
                memo,
                asset
            }))
        },
        null,
        2
    );
}

/**
 * Adds the entries of an exported file; one for an account and asset that are in the book already is left as it is.
 * Returns how many were added and how many were skipped (not valid, already there, or no room).
 */
export function importAddressBook(
    text: string
): {added: number; skipped: number} | null {
    let parsed: any;
    try {
        parsed = JSON.parse(text);
    } catch (e) {
        return null;
    }
    const list = Array.isArray(parsed)
        ? parsed
        : parsed &&
          parsed.format === "address-book" &&
          Array.isArray(parsed.entries)
        ? parsed.entries
        : null;
    if (!list) return null;
    let added = 0;
    let skipped = 0;
    for (const raw of list) {
        // the id of a file is not trusted: an entry is new here
        const result = saveEntry({...(raw || {}), id: undefined});
        if (result.ok) added++;
        else skipped++;
    }
    return {added, skipped};
}

/** Back to what is stored (tests). */
export function reloadAddressBook(): void {
    entries = load();
    emit();
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function useAddressBook(): AddressEntry[] {
    return React.useSyncExternalStore(subscribe, getAddressBook, () => []);
}
