import {
    MAX_ENTRIES,
    MAX_MEMO,
    exportAddressBook,
    findEntry,
    getAddressBook,
    importAddressBook,
    reloadAddressBook,
    removeEntry,
    saveEntry,
    validAccountName
} from "../../lib/common/addressBook";

const KEY = "__graphene__addressBook";

beforeEach(() => {
    window.localStorage.clear();
    reloadAddressBook();
});

describe("account names", () => {
    it("knows a BitShares account name", () => {
        [
            "alice",
            "abit",
            "xbtsx.deposit",
            "a1-b2",
            "committee-account"
        ].forEach(n => expect(validAccountName(n)).toBe(true));
        [
            "Alice",
            "ab",
            "1abc",
            "a b",
            "alice-",
            "x".repeat(64),
            "",
            "al/ice"
        ].forEach(n => expect(validAccountName(n)).toBe(false));
    });
});

describe("the address book", () => {
    it("adds an entry with who it is and the memo to use, newest first", () => {
        const first = saveEntry({
            name: "alice-landlord",
            label: "Landlord",
            note: "Rent is due on the 1st",
            memo: "rent"
        });
        expect(first.ok).toBe(true);
        saveEntry({
            name: "exchange-deposit",
            label: "Exchange",
            memo: "tag 4711"
        });
        expect(getAddressBook().map(e => e.name)).toEqual([
            "exchange-deposit",
            "alice-landlord"
        ]);
        expect(findEntry("alice-landlord")).toMatchObject({
            label: "Landlord",
            note: "Rent is due on the 1st",
            memo: "rent"
        });
        // looked up however it is typed
        expect(findEntry("  Alice-Landlord ")?.label).toBe("Landlord");
        expect(findEntry("nobody")).toBeUndefined();
        expect(findEntry("")).toBeUndefined();
        expect(findEntry(null)).toBeUndefined();
    });

    it("refuses a name that is not an account's, and an account that is in the book already", () => {
        expect(saveEntry({name: "No Good"})).toEqual({
            ok: false,
            error: "name"
        });
        saveEntry({name: "alice"});
        expect(saveEntry({name: "alice", label: "Other"})).toEqual({
            ok: false,
            error: "duplicate"
        });
        expect(getAddressBook()).toHaveLength(1);
    });

    it("changes an entry by its id, keeping its place, and does not let it take another entry's name", () => {
        const a = saveEntry({name: "alice", label: "A"});
        const b = saveEntry({name: "bob", label: "B"});
        if (!a.ok || !b.ok) throw new Error("setup");
        const changed = saveEntry({
            id: a.entry.id,
            name: "alice",
            label: "Alice",
            memo: "m"
        });
        expect(changed.ok).toBe(true);
        expect(findEntry("alice")).toMatchObject({
            label: "Alice",
            memo: "m",
            id: a.entry.id
        });
        expect(getAddressBook()).toHaveLength(2);
        // renamed to a free name
        expect(saveEntry({id: a.entry.id, name: "alicia"}).ok).toBe(true);
        expect(findEntry("alice")).toBeUndefined();
        // renamed onto bob
        expect(saveEntry({id: a.entry.id, name: "bob"})).toEqual({
            ok: false,
            error: "duplicate"
        });
    });

    it("trims and shortens what is typed, and keeps nothing but text", () => {
        const r = saveEntry({
            name: "alice",
            label: "  Alice  ",
            memo: "m".repeat(MAX_MEMO + 50),
            note: 42 as any
        });
        expect(r.ok).toBe(true);
        const entry = findEntry("alice")!;
        expect(entry.label).toBe("Alice");
        expect(entry.memo).toHaveLength(MAX_MEMO);
        expect(entry.note).toBe("");
    });

    it("removes an entry, and keeps the book in this browser", () => {
        const a = saveEntry({name: "alice"});
        saveEntry({name: "bob"});
        if (!a.ok) throw new Error("setup");
        removeEntry(a.entry.id);
        expect(getAddressBook().map(e => e.name)).toEqual(["bob"]);
        expect(
            JSON.parse(window.localStorage.getItem(KEY) || "[]")
        ).toHaveLength(1);
        reloadAddressBook();
        expect(getAddressBook().map(e => e.name)).toEqual(["bob"]);
        // removing what is not there changes nothing
        removeEntry("nope");
        expect(getAddressBook()).toHaveLength(1);
    });

    it("does not trust what was kept", () => {
        window.localStorage.setItem(
            KEY,
            JSON.stringify([
                {id: "1", name: "alice", label: "A"},
                {id: "2", name: "alice", label: "again"},
                {id: "3", name: "<script>"},
                null,
                "text",
                {id: "4", name: "bob", memo: 5}
            ])
        );
        reloadAddressBook();
        expect(
            getAddressBook().map(e => `${e.name}:${e.label}:${e.memo}`)
        ).toEqual(["alice:A:", "bob::"]);
        window.localStorage.setItem(KEY, "{not json");
        reloadAddressBook();
        expect(getAddressBook()).toEqual([]);
    });

    it("has room for a limited number of entries", () => {
        for (let i = 0; i < MAX_ENTRIES; i++) {
            expect(
                saveEntry({
                    name: `acct${String(i)
                        .padStart(4, "a")
                        .replace(/\d/g, c => "abcdefghij"[+c])}`
                }).ok
            ).toBe(true);
        }
        expect(saveEntry({name: "onemore"})).toEqual({
            ok: false,
            error: "full"
        });
    });
});

describe("export and import", () => {
    it("writes the book as a file, with no ids, and reads it back into an empty book", () => {
        saveEntry({name: "alice", label: "A", note: "n", memo: "m"});
        saveEntry({name: "bob"});
        const text = exportAddressBook();
        expect(JSON.parse(text).entries).toEqual([
            {name: "bob", label: "", note: "", memo: ""},
            {name: "alice", label: "A", note: "n", memo: "m"}
        ]);
        window.localStorage.clear();
        reloadAddressBook();
        expect(importAddressBook(text)).toEqual({added: 2, skipped: 0});
        expect(findEntry("alice")).toMatchObject({label: "A", memo: "m"});
    });

    it("adds only what is new, and says what it skipped", () => {
        saveEntry({name: "alice", label: "mine"});
        const result = importAddressBook(
            JSON.stringify({
                format: "address-book",
                entries: [
                    {name: "alice", label: "theirs"},
                    {name: "carol"},
                    {name: "bad name"},
                    null
                ]
            })
        );
        expect(result).toEqual({added: 1, skipped: 3});
        expect(findEntry("alice")?.label).toBe("mine");
        expect(findEntry("carol")).toBeDefined();
    });

    it("reads a plain list, and says no to a file that is not an address book", () => {
        expect(importAddressBook(JSON.stringify([{name: "dave"}]))).toEqual({
            added: 1,
            skipped: 0
        });
        expect(importAddressBook("not json")).toBeNull();
        expect(importAddressBook(JSON.stringify({hello: "world"}))).toBeNull();
        expect(importAddressBook("42")).toBeNull();
    });

    it("never takes the id of a file: an imported entry is new here", () => {
        importAddressBook(JSON.stringify([{id: "x", name: "erin"}]));
        expect(findEntry("erin")!.id).not.toBe("x");
    });
});
