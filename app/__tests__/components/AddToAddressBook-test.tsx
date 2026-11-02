// The button on a payment in the recent activity that saves who it went to in the address book: with the memo that
// went along when it can be read, after an unlock when the wallet is locked, and a note instead when the book has the
// account already.
import * as React from "react";
import {act, fireEvent, render} from "@testing-library/react";
import counterpart from "counterpart";
import Immutable from "immutable";
import localeEn from "../../assets/locales/locale-en.json";

let mockAccounts: Record<string, any> = {};
jest.mock("bitsharesjs", () => ({
    ...jest.requireActual("bitsharesjs"),
    ChainStore: {getAccount: (id: string) => mockAccounts[id]}
}));
const mockDecode = jest.fn<any, any[]>();
jest.mock("stores/PrivateKeyStore", () => ({
    __esModule: true,
    default: {decodeMemo: (...args: any[]) => mockDecode(...args)}
}));
let mockLocked = false;
jest.mock("stores/WalletDb", () => ({
    __esModule: true,
    default: {isLocked: () => mockLocked}
}));
const mockUnlock = jest.fn<Promise<void>, []>();
jest.mock("../../actions/WalletUnlockActions", () => ({
    __esModule: true,
    default: {unlock: () => mockUnlock()}
}));

import AddToAddressBook from "../../components/AddressBook/AddToAddressBook";
import {
    findEntry,
    isSentPayment,
    reloadAddressBook,
    saveEntry
} from "../../lib/common/addressBook";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

const MEMO = {from: "BTS1", to: "BTS2", nonce: "1", message: "00"};

beforeEach(() => {
    window.localStorage.clear();
    reloadAddressBook();
    jest.clearAllMocks();
    mockLocked = false;
    mockAccounts = {
        "1.2.50": Immutable.fromJS({id: "1.2.50", name: "mexc-deposit"})
    };
    mockDecode.mockReturnValue({text: "tag-12345", isMine: true});
    mockUnlock.mockResolvedValue(undefined);
});

const addButton = () =>
    Array.from(document.body.querySelectorAll("button")).find(
        b => (b.textContent || "").trim() === "Add to address book"
    ) as HTMLButtonElement | undefined;
const field = (label: string) =>
    document.body.querySelector(`[aria-label="${label}"]`) as HTMLInputElement;
const flush = () => act(async () => {});

describe("AddToAddressBook", () => {
    it("opens the form with the account that was paid and the memo that went with it, and saves them", async () => {
        render(<AddToAddressBook to="1.2.50" memo={MEMO} />);
        expect(findEntry("mexc-deposit")).toBeUndefined();
        await act(async () => {
            fireEvent.click(addButton() as HTMLButtonElement);
        });
        expect(field("Account name").value).toBe("mexc-deposit");
        expect(field("Memo").value).toBe("tag-12345");
        fireEvent.change(field("Who is it?"), {target: {value: "MEXC"}});
        fireEvent.click(
            Array.from(document.body.querySelectorAll("button")).find(
                b => (b.textContent || "").trim() === "Save"
            ) as HTMLButtonElement
        );
        expect(findEntry("mexc-deposit")).toMatchObject({
            label: "MEXC",
            memo: "tag-12345"
        });
        // the account is in the book now: a note instead of the button
        await flush();
        expect(addButton()).toBeUndefined();
        expect(document.body.textContent).toContain("In the address book");
    });

    it("says that the book has the account, with no button, when it does", () => {
        saveEntry({name: "mexc-deposit", memo: "old"});
        render(<AddToAddressBook to="1.2.50" memo={MEMO} />);
        expect(addButton()).toBeUndefined();
        expect(document.body.textContent).toContain("In the address book");
    });

    it("opens with no memo for a payment that had none, and does not ask for the wallet", async () => {
        mockLocked = true;
        render(<AddToAddressBook to="1.2.50" />);
        await act(async () => {
            fireEvent.click(addButton() as HTMLButtonElement);
        });
        expect(field("Account name").value).toBe("mexc-deposit");
        expect(field("Memo").value).toBe("");
        expect(mockUnlock).not.toHaveBeenCalled();
        expect(mockDecode).not.toHaveBeenCalled();
    });

    it("asks a locked wallet to unlock first, to read the memo, and opens with it once it is open", async () => {
        mockLocked = true;
        mockDecode.mockReturnValueOnce({text: undefined, isMine: true});
        mockUnlock.mockImplementation(async () => {
            mockLocked = false;
        });
        render(<AddToAddressBook to="1.2.50" memo={MEMO} />);
        await act(async () => {
            fireEvent.click(addButton() as HTMLButtonElement);
        });
        expect(mockUnlock).toHaveBeenCalledTimes(1);
        expect(field("Memo").value).toBe("tag-12345");
    });

    it("opens without the memo when the unlock is cancelled, and never asks an open wallet", async () => {
        mockLocked = true;
        mockDecode.mockReturnValue({text: undefined, isMine: true});
        mockUnlock.mockRejectedValue(new Error("cancelled"));
        const first = render(<AddToAddressBook to="1.2.50" memo={MEMO} />);
        await act(async () => {
            fireEvent.click(addButton() as HTMLButtonElement);
        });
        expect(field("Account name").value).toBe("mexc-deposit");
        expect(field("Memo").value).toBe("");
        first.unmount();
        // an open wallet that cannot read it (not our memo key): no prompt either
        mockLocked = false;
        mockUnlock.mockClear();
        render(<AddToAddressBook to="1.2.50" memo={MEMO} />);
        await act(async () => {
            fireEvent.click(addButton() as HTMLButtonElement);
        });
        expect(mockUnlock).not.toHaveBeenCalled();
    });

    it("shows nothing until the account is loaded", () => {
        mockAccounts = {};
        const {container} = render(
            <AddToAddressBook to="1.2.50" memo={MEMO} />
        );
        expect(container.textContent).toBe("");
    });

    it("knows which operations are payments an account sent: transfers from it, not to it, not other operations", () => {
        const op = {from: "1.2.9", to: "1.2.50"};
        expect(isSentPayment("transfer", op, ["1.2.9"])).toBe(true);
        expect(isSentPayment("transfer", op, ["1.2.1", "1.2.9"])).toBe(true);
        // received
        expect(isSentPayment("transfer", op, ["1.2.50"])).toBe(false);
        expect(isSentPayment("transfer", op, [null, undefined])).toBe(false);
        // other operations
        expect(isSentPayment("limit_order_create", op, ["1.2.9"])).toBe(false);
        expect(isSentPayment(undefined, op, ["1.2.9"])).toBe(false);
        expect(isSentPayment("transfer", null, ["1.2.9"])).toBe(false);
    });
});
