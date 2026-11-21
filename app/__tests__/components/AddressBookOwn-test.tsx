// The address book is linked to the wallet: the user's own accounts (the wallet's, and the one the extension is connected
// as) stand above the saved contacts and in the recipient picker of the Send dialog - and are never saved in the book.
import * as React from "react";
import {fireEvent, render} from "@testing-library/react";
import {MemoryRouter, Route, Routes, useLocation} from "react-router-dom";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

const mockOwn: {list: {name: string; source: "wallet" | "extension"}[]} = {
    list: []
};
const mockCurrent = {name: "alice" as string | null};

jest.mock("../../components/AddressBook/useOwnAccounts", () => ({
    __esModule: true,
    useOwnAccounts: () => mockOwn.list
}));
jest.mock("../../store/slices/accountSlice", () => ({
    __esModule: true,
    selectAccountState: () => ({currentAccount: mockCurrent.name})
}));
jest.mock("../../next/hooks/useReduxState", () => ({
    __esModule: true,
    useReduxState: (selector: any) => selector({})
}));
// (no lock state in the stubbed store: the memos are shown, this test is not about them)
jest.mock("../../components/AddressBook/useMemosVisible", () => ({
    __esModule: true,
    useMemosVisible: () => true
}));
jest.mock("file-saver", () => ({saveAs: () => undefined}));
jest.mock("../../components/AddressBook/HeldBalance", () => ({
    __esModule: true,
    default: () => null
}));

import AddressBookPage from "../../components/AddressBook/AddressBookPage";
import RecipientHelper from "../../components/AddressBook/RecipientHelper";
import {
    exportAddressBook,
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
    mockCurrent.name = "alice";
    mockOwn.list = [
        {name: "carol", source: "extension"},
        {name: "alice", source: "wallet"},
        {name: "bob", source: "wallet"}
    ];
});

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
                <Route path="/send" element={<Where />} />
            </Routes>
        </MemoryRouter>
    );

const ownCards = (container: HTMLElement) =>
    Array.from(
        container.querySelectorAll("[data-testid='own-accounts'] > li")
    ) as HTMLElement[];

describe("the address book page with the wallet's accounts", () => {
    it("lists them above the contacts, each with whose key signs for it", () => {
        saveEntry({name: "dave", label: "Landlord"});
        const {container} = page();
        const cards = ownCards(container);
        expect(cards.map(c => c.textContent)).toEqual([
            expect.stringContaining("carol"),
            expect.stringContaining("alice"),
            expect.stringContaining("bob")
        ]);
        expect(cards[0].getAttribute("data-own")).toBe("extension");
        expect(cards[0].textContent).toContain("Extension");
        expect(cards[1].textContent).toContain("Wallet");
        const text = container.textContent || "";
        expect(text.indexOf("My accounts")).toBeLessThan(
            text.indexOf("Contacts")
        );
        expect(text.indexOf("Contacts")).toBeLessThan(text.indexOf("Landlord"));
    });

    it("shows the extension's account even when the wallet has no accounts of its own", () => {
        mockOwn.list = [{name: "carol", source: "extension"}];
        const {container} = page();
        expect(ownCards(container)).toHaveLength(1);
        expect(ownCards(container)[0].textContent).toContain("carol");
    });

    it("offers Send to every account but the current one", () => {
        const {container} = page();
        const [carol, alice, bob] = ownCards(container);
        expect(alice.querySelector("button")).toBeNull();
        expect(carol.querySelector("button")).toBeTruthy();
        fireEvent.click(bob.querySelector("button") as HTMLElement);
        expect(
            (document.body.querySelector(
                "[data-testid='where']"
            ) as HTMLElement).textContent
        ).toBe('/send|{"toName":"bob"}');
    });

    it("searches them with the contacts, by name and by what they are", () => {
        saveEntry({name: "dave", label: "Landlord"});
        const {container} = page();
        const search = container.querySelector(
            "[aria-label='Search the address book']"
        ) as HTMLElement;
        fireEvent.change(search, {target: {value: "bo"}});
        expect(ownCards(container).map(c => c.textContent)).toEqual([
            expect.stringContaining("bob")
        ]);
        fireEvent.change(search, {target: {value: "extension"}});
        expect(ownCards(container).map(c => c.textContent)).toEqual([
            expect.stringContaining("carol")
        ]);
        fireEvent.change(search, {target: {value: "landlord"}});
        expect(ownCards(container)).toHaveLength(0);
        expect(container.textContent).not.toContain("My accounts");
        expect(container.textContent).toContain("Landlord");
    });

    it("keeps them out of the book, and out of its file", () => {
        page();
        expect(getAddressBook()).toEqual([]);
        expect(exportAddressBook()).not.toContain("carol");
    });

    it("looks as it did without any account of the user's", () => {
        mockOwn.list = [];
        const {container} = page();
        expect(container.textContent).not.toContain("My accounts");
        expect(container.textContent).not.toContain("Contacts");
        expect(container.textContent).toContain("Nothing here yet");
    });
});

describe("the recipient picker with the wallet's accounts", () => {
    const mount = (
        props: Partial<React.ComponentProps<typeof RecipientHelper>> = {}
    ) => {
        const picked = jest.fn();
        const view = render(
            <RecipientHelper
                toName=""
                memo=""
                known={false}
                onPick={picked}
                onUseMemo={() => undefined}
                {...props}
            />
        );
        return {view, picked};
    };
    const options = () =>
        Array.from(document.body.querySelectorAll("[role='option']"));
    const open = (view: ReturnType<typeof render>) =>
        fireEvent.click(
            view.container.querySelector(
                "[aria-haspopup='listbox']"
            ) as HTMLElement
        );

    it("is there for the user's own accounts alone, with an empty book", () => {
        const {view} = mount();
        expect(view.container.innerHTML).not.toBe("");
    });

    it("offers them after the book, each with whose it is", () => {
        saveEntry({name: "dave", label: "Landlord"});
        const {view} = mount();
        open(view);
        expect(options().map(o => o.textContent)).toEqual([
            "Landlord - dave",
            "carol (Extension)",
            "alice (Wallet)",
            "bob (Wallet)"
        ]);
    });

    it("picks one: only who is paid changes (no memo, no asset)", () => {
        const {view, picked} = mount();
        open(view);
        fireEvent.click(
            options().find(o =>
                (o.textContent || "").includes("carol")
            ) as HTMLElement
        );
        expect(picked).toHaveBeenCalledTimes(1);
        expect(picked.mock.calls[0][0]).toMatchObject({
            name: "carol",
            memo: "",
            asset: ""
        });
    });

    it("does not offer to save a recipient that is the user's own", () => {
        const own = mount({toName: "bob", known: true});
        expect(own.view.container.textContent).not.toContain(
            "Save this recipient"
        );
        own.view.unmount();
        const other = mount({toName: "erin", known: true});
        expect(other.view.container.textContent).toContain(
            "Save this recipient"
        );
    });
});
