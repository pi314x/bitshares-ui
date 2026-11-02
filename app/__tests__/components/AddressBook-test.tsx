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
    findEntry,
    getAddressBook,
    reloadAddressBook,
    saveEntry
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
            "That account is in the address book already."
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
