import * as React from "react";
import {act, fireEvent, render} from "@testing-library/react";
import {MemoryRouter, Route, Routes, useLocation} from "react-router-dom";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

const mockSaveAs = jest.fn();
jest.mock("file-saver", () => ({
    saveAs: (...args: any[]) => mockSaveAs(...args)
}));
jest.mock("../../design-system/Notification", () => ({
    Notification: {success: jest.fn(), error: jest.fn()}
}));

import {Notification} from "../../design-system/Notification";
import AddressBookPage, {
    matches
} from "../../components/AddressBook/AddressBookPage";
import RecipientHelper from "../../components/AddressBook/RecipientHelper";
import {
    exportAddressBook,
    findEntry,
    getAddressBook,
    importAddressBook,
    normalizeAsset,
    reloadAddressBook,
    saveEntry,
    validAssetSymbol
} from "../../lib/common/addressBook";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    window.localStorage.clear();
    reloadAddressBook();
    mockSaveAs.mockClear();
    (Notification.success as jest.Mock).mockClear();
    (Notification.error as jest.Mock).mockClear();
});

const button = (name: string) =>
    Array.from(document.body.querySelectorAll("button")).find(
        b => (b.textContent || "").trim() === name
    ) as HTMLButtonElement;

const type = (label: string, text: string) =>
    fireEvent.change(
        document.body.querySelector(`[aria-label="${label}"]`) as HTMLElement,
        {target: {value: text}}
    );

const Where = () => {
    const location = useLocation();
    return (
        <span data-testid="where">
            {location.pathname}|{JSON.stringify(location.state)}
        </span>
    );
};

const page = () =>
    render(
        <MemoryRouter initialEntries={["/address-book"]}>
            <Routes>
                <Route path="/address-book" element={<AddressBookPage />} />
                <Route path="/send" element={<span>send</span>} />
            </Routes>
            <Where />
        </MemoryRouter>
    );

describe("the address book page", () => {
    it("says it is empty, and how to fill it", () => {
        const {container} = page();
        expect(container.textContent).toContain("Nothing here yet");
        expect(container.textContent).toContain("Address book");
        expect(button("Export").disabled).toBe(true);
    });

    it("adds an entry with who it is, the info and the memo, and shows it as a card", () => {
        const {container} = page();
        fireEvent.click(button("Add"));
        // a name that is not an account's cannot be saved
        type("Account name", "No Good");
        expect(button("Save").disabled).toBe(true);
        type("Account name", "alice-landlord");
        type("Who is it?", "Landlord");
        type("Info", "Rent is due on the 1st");
        type("Memo", "rent");
        fireEvent.click(button("Save"));
        expect(document.body.querySelector("[role='dialog']")).toBeNull();
        const text = container.textContent || "";
        expect(text).toContain("Landlord");
        expect(text).toContain("alice-landlord");
        expect(text).toContain("Rent is due on the 1st");
        expect(text).toContain("rent");
        expect(findEntry("alice-landlord")?.memo).toBe("rent");
    });

    it("refuses an account that is in the book already, and says so", () => {
        saveEntry({name: "alice"});
        page();
        fireEvent.click(button("Add"));
        type("Account name", "alice");
        fireEvent.click(button("Save"));
        expect(document.body.textContent).toContain(
            "That account is in the address book already for this asset."
        );
        expect(getAddressBook()).toHaveLength(1);
    });

    it("searches in every part of an entry", () => {
        saveEntry({name: "alice", label: "Landlord", note: "rent", memo: "m1"});
        saveEntry({name: "bob", label: "Plumber", note: "", memo: "tag-77"});
        const {container} = page();
        expect(container.querySelectorAll("li")).toHaveLength(2);
        type("Search the address book", "tag-77");
        expect(container.textContent).toContain("Plumber");
        expect(container.textContent).not.toContain("Landlord");
        type("Search the address book", "zzz");
        expect(container.textContent).toContain("Nobody matches that.");
        expect(matches(getAddressBook()[0], "")).toBe(true);
    });

    it("sends to an entry: the Send page opens with the recipient chosen", () => {
        saveEntry({name: "alice", label: "Landlord"});
        const {getByTestId} = page();
        fireEvent.click(button("Send"));
        expect(getByTestId("where").textContent).toBe(
            '/send|{"toName":"alice"}'
        );
    });

    it("changes an entry, and deletes one only on the second press", () => {
        saveEntry({name: "alice", label: "Landlord"});
        const {container} = page();
        fireEvent.click(button("Edit"));
        expect(
            (document.body.querySelector(
                '[aria-label="Account name"]'
            ) as HTMLInputElement).value
        ).toBe("alice");
        type("Who is it?", "Old landlord");
        fireEvent.click(button("Save"));
        expect(container.textContent).toContain("Old landlord");
        // one press asks, the next deletes
        fireEvent.click(button("Delete"));
        expect(getAddressBook()).toHaveLength(1);
        fireEvent.click(button("Really delete?"));
        expect(getAddressBook()).toHaveLength(0);
        expect(container.textContent).toContain("Nothing here yet");
    });

    it("exports the book as a file and imports one, saying how many it took", async () => {
        saveEntry({name: "alice", label: "A"});
        const {container} = page();
        fireEvent.click(button("Export"));
        expect(mockSaveAs).toHaveBeenCalledTimes(1);
        expect(mockSaveAs.mock.calls[0][1]).toBe("address-book.json");
        const input = container.querySelector(
            "input[type=file]"
        ) as HTMLInputElement;
        const file = new File(
            [JSON.stringify([{name: "carol", label: "C"}, {name: "alice"}])],
            "book.json",
            {type: "application/json"}
        );
        await act(async () => {
            fireEvent.change(input, {target: {files: [file]}});
            await new Promise(resolve => setTimeout(resolve, 50));
        });
        expect(findEntry("carol")?.label).toBe("C");
        expect(Notification.success).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "Imported: 1 added, 1 skipped."
            })
        );
        // something that is not a book is said so
        const bad = new File(["not json"], "x.json");
        await act(async () => {
            fireEvent.change(input, {target: {files: [bad]}});
            await new Promise(resolve => setTimeout(resolve, 50));
        });
        expect(Notification.error).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "That file is not an address book."
            })
        );
    });
});

describe("the address book in the Send dialog", () => {
    const mount = (props: any = {}) => {
        const picked = jest.fn();
        const memo = jest.fn();
        const view = render(
            <RecipientHelper
                toName=""
                memo=""
                known={false}
                onPick={picked}
                onUseMemo={memo}
                {...props}
            />
        );
        return {view, picked, memo};
    };

    it("is not there with an empty book and nobody to save", () => {
        const {view} = mount();
        expect(view.container.innerHTML).toBe("");
    });

    it("picks a recipient from the book", () => {
        saveEntry({name: "alice", label: "Landlord"});
        saveEntry({name: "bob", label: "Plumber"});
        const {view, picked} = mount();
        fireEvent.click(
            view.container.querySelector(
                "[aria-haspopup='listbox']"
            ) as HTMLElement
        );
        const option = Array.from(
            document.body.querySelectorAll("[role='option']")
        ).find(o => (o.textContent || "").includes("Landlord")) as HTMLElement;
        fireEvent.click(option);
        expect(picked).toHaveBeenCalledTimes(1);
        expect(picked.mock.calls[0][0].name).toBe("alice");
    });

    it("says who the typed account is, and fills its memo once when the memo box is empty", () => {
        saveEntry({
            name: "alice",
            label: "Landlord",
            note: "Rent is due on the 1st",
            memo: "rent"
        });
        const {view, memo} = mount({toName: "alice"});
        expect(view.container.textContent).toContain("Landlord");
        expect(view.container.textContent).toContain("Rent is due on the 1st");
        expect(memo).toHaveBeenCalledTimes(1);
        expect(memo).toHaveBeenCalledWith("rent");
        // rendered again with the same recipient: not filled again
        view.rerender(
            <RecipientHelper
                toName="alice"
                memo=""
                known={true}
                onPick={() => undefined}
                onUseMemo={memo}
            />
        );
        expect(memo).toHaveBeenCalledTimes(1);
    });

    it("never replaces a memo that was typed, and offers the saved one instead", () => {
        saveEntry({name: "alice", memo: "rent"});
        const {view, memo} = mount({toName: "alice", memo: "my own words"});
        expect(memo).not.toHaveBeenCalled();
        fireEvent.click(
            Array.from(view.container.querySelectorAll("button")).find(b =>
                (b.textContent || "").includes("Use the saved memo: rent")
            ) as HTMLElement
        );
        expect(memo).toHaveBeenCalledWith("rent");
    });

    it("offers to save a recipient the book does not know, when the account is there", () => {
        saveEntry({name: "bob"});
        const unknown = mount({toName: "carol", known: false});
        expect(unknown.view.container.textContent).not.toContain(
            "Save this recipient"
        );
        unknown.view.unmount();
        const {view} = mount({toName: "carol", known: true, memo: "inv 5"});
        fireEvent.click(
            Array.from(view.container.querySelectorAll("button")).find(b =>
                (b.textContent || "").includes("Save this recipient")
            ) as HTMLElement
        );
        // the form opens with the recipient and the memo that was typed
        expect(
            (document.body.querySelector(
                '[aria-label="Account name"]'
            ) as HTMLInputElement).value
        ).toBe("carol");
        expect(
            (document.body.querySelector(
                '[aria-label="Memo"]'
            ) as HTMLInputElement).value
        ).toBe("inv 5");
        fireEvent.click(button("Save"));
        expect(findEntry("carol")?.memo).toBe("inv 5");
    });
});

describe("an entry for an asset (a withdrawal of it)", () => {
    it("knows what an asset symbol is, and keeps it in capitals; what is not one makes the entry for any asset", () => {
        expect(validAssetSymbol("XBTSX.HIVE")).toBe(true);
        expect(validAssetSymbol("BTS")).toBe(true);
        for (const bad of [
            "",
            "AB",
            "xbtsx",
            "1ABC",
            "ABC.",
            "A B C",
            "A".repeat(17)
        ]) {
            expect(validAssetSymbol(bad)).toBe(false);
        }
        expect(normalizeAsset("  xbtsx.hive ")).toBe("XBTSX.HIVE");
        expect(normalizeAsset("no good")).toBe("");
        expect(normalizeAsset(undefined)).toBe("");
        expect(
            saveEntry({name: "xbts-hive", asset: "xbtsx.hive"})
        ).toMatchObject({
            ok: true,
            entry: {asset: "XBTSX.HIVE"}
        });
        expect(saveEntry({name: "alice", asset: "no good"})).toMatchObject({
            ok: true,
            entry: {asset: ""}
        });
    });

    it("keeps one entry for each account and asset: the same account for another asset, or for any, is another entry", () => {
        expect(saveEntry({name: "gateway", asset: "AAA", memo: "a"}).ok).toBe(
            true
        );
        expect(saveEntry({name: "gateway", asset: "BBB", memo: "b"}).ok).toBe(
            true
        );
        expect(saveEntry({name: "gateway", memo: "any"}).ok).toBe(true);
        expect(getAddressBook()).toHaveLength(3);
        // the same account and asset again is refused
        expect(saveEntry({name: "gateway", asset: "aaa"})).toEqual({
            ok: false,
            error: "duplicate"
        });
        // and so is moving an entry onto another's account and asset
        const bbb = findEntry("gateway", undefined, "BBB")!;
        expect(saveEntry({id: bbb.id, name: "gateway", asset: "AAA"})).toEqual({
            ok: false,
            error: "duplicate"
        });
        // changing its own memo is not a clash
        expect(
            saveEntry({id: bbb.id, name: "gateway", asset: "BBB", memo: "b2"})
                .ok
        ).toBe(true);
        reloadAddressBook();
        expect(getAddressBook()).toHaveLength(3);
        expect(findEntry("gateway", undefined, "BBB")?.memo).toBe("b2");
    });

    it("finds the entry for the asset that is sent, or else the one for any asset", () => {
        saveEntry({name: "gateway", asset: "AAA", memo: "a"});
        saveEntry({name: "gateway", asset: "BBB", memo: "b"});
        expect(findEntry("gateway", undefined, "AAA")?.memo).toBe("a");
        expect(findEntry("gateway", undefined, "bbb")?.memo).toBe("b");
        // no entry for CCC, and none for any asset
        expect(findEntry("gateway", undefined, "CCC")).toBeUndefined();
        saveEntry({name: "gateway", memo: "any"});
        expect(findEntry("gateway", undefined, "CCC")?.memo).toBe("any");
        // the exact one wins over the one for any asset
        expect(findEntry("gateway", undefined, "AAA")?.memo).toBe("a");
        // without an asset: the one for any asset, else the newest
        expect(findEntry("gateway")?.memo).toBe("any");
        saveEntry({name: "solo", asset: "AAA"});
        expect(findEntry("solo")?.asset).toBe("AAA");
        expect(findEntry("solo", undefined, "BBB")).toBeUndefined();
    });

    it("is exported and imported with its asset, and an older file without assets still imports", () => {
        saveEntry({name: "gateway", asset: "AAA", memo: "a"});
        saveEntry({name: "gateway", memo: "any"});
        const file = exportAddressBook();
        expect(JSON.parse(file).entries).toEqual(
            expect.arrayContaining([
                expect.objectContaining({name: "gateway", asset: "AAA"}),
                expect.objectContaining({name: "gateway", asset: ""})
            ])
        );
        window.localStorage.clear();
        reloadAddressBook();
        expect(importAddressBook(file)).toEqual({added: 2, skipped: 0});
        expect(findEntry("gateway", undefined, "AAA")?.memo).toBe("a");
        expect(
            importAddressBook(
                JSON.stringify({
                    format: "address-book",
                    version: 1,
                    entries: [{name: "oldfriend", memo: "m"}]
                })
            )
        ).toEqual({added: 1, skipped: 0});
        expect(findEntry("oldfriend")).toMatchObject({asset: "", memo: "m"});
    });

    it("is read as it was kept: an entry from before assets has none, and two kept for one account and asset are one", () => {
        window.localStorage.setItem(
            "__graphene__addressBook",
            JSON.stringify([
                {id: "1", name: "alice", memo: "old"},
                {id: "2", name: "gate", asset: "AAA"},
                {id: "3", name: "gate", asset: "aaa"},
                {id: "4", name: "gate", asset: "BBB"}
            ])
        );
        reloadAddressBook();
        expect(getAddressBook().map(e => [e.name, e.asset])).toEqual([
            ["alice", ""],
            ["gate", "AAA"],
            ["gate", "BBB"]
        ]);
    });
});

describe("the asset on the address book page", () => {
    it("adds an entry for an asset, shows it on the card, and finds it in the search", () => {
        saveEntry({name: "bob", label: "Plumber"});
        const {container} = page();
        fireEvent.click(button("Add"));
        type("Account name", "xbts-hive");
        type("Asset", "xbtsx.hive");
        type("Memo", "hive-address-1");
        fireEvent.click(button("Save"));
        expect(findEntry("xbts-hive")).toMatchObject({
            asset: "XBTSX.HIVE",
            memo: "hive-address-1"
        });
        expect(container.textContent).toContain("XBTSX.HIVE");
        expect(container.querySelectorAll("li")).toHaveLength(2);
        type("Search the address book", "xbtsx");
        expect(container.querySelectorAll("li")).toHaveLength(1);
        expect(container.textContent).toContain("xbts-hive");
    });

    it("refuses what is not an asset symbol, and the same account and asset twice, but takes the account for another asset", () => {
        saveEntry({name: "xbts-hive", asset: "XBTSX.HIVE"});
        page();
        fireEvent.click(button("Add"));
        type("Account name", "xbts-hive");
        type("Asset", "no good");
        expect(button("Save").disabled).toBe(true);
        expect(document.body.textContent).toContain(
            "That is not an asset symbol"
        );
        type("Asset", "XBTSX.HIVE");
        fireEvent.click(button("Save"));
        expect(document.body.textContent).toContain(
            "That account is in the address book already for this asset."
        );
        type("Asset", "XBTSX.BTC");
        fireEvent.click(button("Save"));
        expect(getAddressBook()).toHaveLength(2);
        expect(findEntry("xbts-hive", undefined, "XBTSX.BTC")).toBeDefined();
    });

    it("sends to an entry with its asset: the Send page opens with the recipient and the asset", () => {
        saveEntry({name: "xbts-hive", asset: "XBTSX.HIVE"});
        const {getByTestId} = page();
        fireEvent.click(button("Send"));
        expect(getByTestId("where").textContent).toBe(
            '/send|{"toName":"xbts-hive","asset":"XBTSX.HIVE"}'
        );
    });
});

describe("the asset in the Send dialog", () => {
    const helper = (props: any = {}) => {
        const picked = jest.fn();
        const memo = jest.fn();
        const view = render(
            <RecipientHelper
                toName="gateway"
                memo=""
                known={true}
                onPick={picked}
                onUseMemo={memo}
                {...props}
            />
        );
        const again = (next: any) =>
            view.rerender(
                <RecipientHelper
                    toName="gateway"
                    memo=""
                    known={true}
                    onPick={picked}
                    onUseMemo={memo}
                    {...props}
                    {...next}
                />
            );
        return {view, picked, memo, again};
    };

    beforeEach(() => {
        saveEntry({name: "gateway", asset: "AAA", memo: "address-a"});
        saveEntry({name: "gateway", asset: "BBB", memo: "address-b"});
    });

    it("fills the memo of the entry for the asset that is sent, and says who it is", () => {
        const {memo, view} = helper({asset: "BBB"});
        expect(memo).toHaveBeenCalledTimes(1);
        expect(memo).toHaveBeenCalledWith("address-b");
        expect(view.container.textContent).not.toContain("Save this recipient");
    });

    it("takes the memo of another asset's entry when the asset is changed, as long as the memo is the one that was filled in", () => {
        const {memo, again} = helper({asset: "AAA"});
        expect(memo).toHaveBeenLastCalledWith("address-a");
        // the box holds what was filled in: another asset, another address
        again({asset: "BBB", memo: "address-a"});
        expect(memo).toHaveBeenLastCalledWith("address-b");
        expect(memo).toHaveBeenCalledTimes(2);
    });

    it("never replaces a memo that was typed, when the asset is changed", () => {
        const {memo, again} = helper({asset: "AAA", memo: "my own words"});
        expect(memo).not.toHaveBeenCalled();
        again({asset: "BBB", memo: "my own words"});
        expect(memo).not.toHaveBeenCalled();
    });

    it("has nothing to fill for an asset the account has no entry for (unless one is for any asset), and offers to save it for that asset", () => {
        const {memo, view} = helper({asset: "CCC", memo: "inv 5"});
        expect(memo).not.toHaveBeenCalled();
        fireEvent.click(
            Array.from(view.container.querySelectorAll("button")).find(b =>
                (b.textContent || "").includes("Save this recipient")
            ) as HTMLElement
        );
        expect(
            (document.body.querySelector(
                '[aria-label="Asset"]'
            ) as HTMLInputElement).value
        ).toBe("CCC");
        fireEvent.click(button("Save"));
        expect(findEntry("gateway", undefined, "CCC")?.memo).toBe("inv 5");
        // (the others are untouched)
        expect(findEntry("gateway", undefined, "AAA")?.memo).toBe("address-a");
    });

    it("names the asset in the list of the book, and an entry for any asset applies to every asset", () => {
        saveEntry({name: "friend", label: "Friend", memo: "hi"});
        const {view, memo} = helper({toName: "friend", asset: "CCC"});
        expect(memo).toHaveBeenCalledWith("hi");
        fireEvent.click(
            view.container.querySelector(
                "[aria-haspopup='listbox']"
            ) as HTMLElement
        );
        const options = Array.from(
            document.body.querySelectorAll("[role='option']")
        ).map(o => o.textContent);
        expect(options).toEqual(
            expect.arrayContaining([
                "gateway (AAA)",
                "gateway (BBB)",
                "Friend - friend"
            ])
        );
    });
});
