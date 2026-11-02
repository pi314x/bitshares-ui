// The address book: the accounts the user pays, with who they are and the memo to send with a payment (an
// exchange's deposit tag, an invoice number). Kept in this browser; nothing here is a key or a secret, but it
// is the user's own list, so it can be exported and imported as a file.
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
    /** ms since the epoch */
    at: number;
}

export type AddressInput = Pick<AddressEntry, "name"> &
    Partial<Pick<AddressEntry, "id" | "label" | "note" | "memo">>;

export const MAX_ENTRIES = 500;
export const MAX_LABEL = 60;
export const MAX_NOTE = 500;
export const MAX_MEMO = 256;

const KEY = "__graphene__addressBook";

/** A BitShares account name: lower case, digits, dashes and dots, from 3 to 63 characters. */
export const validAccountName = (name: string): boolean =>
    /^[a-z][a-z0-9.-]{1,61}[a-z0-9]$/.test(name);

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
        at: typeof raw.at === "number" && isFinite(raw.at) ? raw.at : Date.now()
    };
}

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
            if (entry && !seen.has(entry.name)) {
                seen.add(entry.name);
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

/** The entry for an account name, if the book has one. */
export function findEntry(
    name: string | null | undefined,
    list: AddressEntry[] = entries
): AddressEntry | undefined {
    if (!name) return undefined;
    const wanted = name.trim().toLowerCase();
    return list.find(entry => entry.name === wanted);
}

export type SaveResult =
    | {ok: true; entry: AddressEntry}
    | {ok: false; error: "name" | "duplicate" | "full"};

/**
 * Adds an entry, or changes the one with the same `id` (renaming it onto the name of another entry is
 * refused: an account is in the book once).
 */
export function saveEntry(input: AddressInput): SaveResult {
    const entry = sanitize({...input, id: input.id || undefined});
    if (!entry) return {ok: false, error: "name"};
    const index = input.id ? entries.findIndex(e => e.id === input.id) : -1;
    const clash = entries.find(e => e.name === entry.name);
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
        entry: entries.find(e => e.name === entry.name) as AddressEntry
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
            entries: list.map(({name, label, note, memo}) => ({
                name,
                label,
                note,
                memo
            }))
        },
        null,
        2
    );
}

/**
 * Adds the entries of an exported file; one for an account that is in the book already is left as it is.
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
