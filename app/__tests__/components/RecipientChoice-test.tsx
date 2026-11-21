// The recipient helper of the Send dialog remembers WHICH entry was picked, by its id: two entries can be for one account
// (an exchange takes a tag for each asset) and even carry one label, and the account and the asset alone cannot say which
// was meant - the first always won ("only the first one is chosen, even when I select the second one").
import * as React from "react";
import {fireEvent, render} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";
import {reduxStore} from "../../store/reduxStore";
import {patchState as patchWalletUnlock} from "../../store/slices/walletUnlockSlice";

jest.mock("../../components/AddressBook/useOwnAccounts", () => ({
    __esModule: true,
    useOwnAccounts: () => []
}));

import RecipientHelper from "../../components/AddressBook/RecipientHelper";
import {
    getAddressBook,
    reloadAddressBook,
    saveEntry
} from "../../lib/common/addressBook";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

let xlm: string;
let xrp: string;
beforeEach(() => {
    // the memos come along only while the wallet is unlocked
    reduxStore.dispatch(patchWalletUnlock({locked: false}));
    window.localStorage.clear();
    reloadAddressBook();
    // one label, one account, two assets (the entries of the report)
    const a = saveEntry({
        name: "ioxbank-gateway",
        label: "MEXC",
        memo: "xlm-memo",
        asset: "IOB.XLM"
    });
    const b = saveEntry({
        name: "ioxbank-gateway",
        label: "MEXC",
        memo: "xrp-memo",
        asset: "IOB.XRP"
    });
    xlm = a.ok ? a.entry.id : "";
    xrp = b.ok ? b.entry.id : "";
});

type Props = React.ComponentProps<typeof RecipientHelper>;

function Dialog(props: Partial<Props> & {onMemo?: (m: string) => void}) {
    // the parts of the dialog that the helper talks to: the recipient, the memo box, the asset
    const [toName, setToName] = React.useState(props.toName ?? "");
    const [memo, setMemo] = React.useState(props.memo ?? "");
    return (
        <div>
            <span data-testid="memo">{memo}</span>
            <RecipientHelper
                toName={toName}
                memo={memo}
                asset={props.asset}
                known={true}
                entryId={props.entryId}
                onPick={entry => setToName(entry.name)}
                onUseMemo={m => {
                    setMemo(m);
                    if (props.onMemo) props.onMemo(m);
                }}
            />
            <button onClick={() => setToName("someone-else")}>retype</button>
            <button onClick={() => setMemo("typed by hand")}>type memo</button>
        </div>
    );
}

const pick = (container: HTMLElement, text: string) => {
    fireEvent.click(
        container.querySelector("[aria-haspopup='listbox']") as HTMLElement
    );
    fireEvent.click(
        Array.from(document.body.querySelectorAll("[role='option']")).find(o =>
            (o.textContent || "").includes(text)
        ) as HTMLElement
    );
};
const shown = (container: HTMLElement) =>
    (container.querySelector("[aria-haspopup='listbox']") as HTMLElement)
        .textContent;
const memoOf = (container: HTMLElement) =>
    (container.querySelector("[data-testid='memo']") as HTMLElement)
        .textContent;

describe("picking between entries of one account", () => {
    it("shows the entry that was picked, and its memo, whichever it is", () => {
        const {container} = render(<Dialog asset="BTS" />);
        pick(container, "(IOB.XLM)");
        expect(shown(container)).toContain("IOB.XLM");
        expect(memoOf(container)).toBe("xlm-memo");
        pick(container, "(IOB.XRP)");
        expect(shown(container)).toContain("IOB.XRP");
        expect(memoOf(container)).toBe("xrp-memo");
        pick(container, "(IOB.XLM)");
        expect(shown(container)).toContain("IOB.XLM");
        expect(memoOf(container)).toBe("xlm-memo");
    });

    it("keeps a memo that was typed, and offers the picked entry's instead", () => {
        const {container, getByText} = render(<Dialog asset="BTS" />);
        pick(container, "(IOB.XLM)");
        fireEvent.click(getByText("type memo"));
        pick(container, "(IOB.XRP)");
        expect(memoOf(container)).toBe("typed by hand");
        expect(container.textContent).toContain("Use the saved memo: xrp-memo");
    });
});

describe("the entry the dialog was opened for", () => {
    it("is the entry of the id, though the account has others (the second card's Send)", () => {
        const {container} = render(
            <Dialog toName="ioxbank-gateway" entryId={xrp} asset="BTS" />
        );
        expect(shown(container)).toContain("IOB.XRP");
        expect(memoOf(container)).toBe("xrp-memo");
    });

    it("holds while the dialog's asset is put on the entry's asset, and when the asset moves on: the drop-down keeps the entry", () => {
        const view = render(
            <Dialog toName="ioxbank-gateway" entryId={xlm} asset="BTS" />
        );
        expect(shown(view.container)).toContain("IOB.XLM");
        // the dialog selects the entry's asset
        view.rerender(
            <Dialog toName="ioxbank-gateway" entryId={xlm} asset="IOB.XLM" />
        );
        expect(shown(view.container)).toContain("IOB.XLM");
        // and the user changes to the other asset, which has an entry of its own: the drop-down stays on the one it had
        view.rerender(
            <Dialog toName="ioxbank-gateway" entryId={xlm} asset="IOB.XRP" />
        );
        expect(shown(view.container)).toContain("IOB.XLM");
        expect(shown(view.container)).not.toContain("IOB.XRP");
        expect(memoOf(view.container)).toBe("xlm-memo");
    });

    it("lets go when another recipient is typed", () => {
        saveEntry({name: "someone-else", label: "Other", memo: "other-memo"});
        const {container, getByText} = render(
            <Dialog toName="ioxbank-gateway" entryId={xlm} asset="BTS" />
        );
        expect(shown(container)).toContain("IOB.XLM");
        fireEvent.click(getByText("retype"));
        expect(shown(container)).toContain("Other - someone-else");
    });

    it("is not lost while the recipient is still empty (the dialog sets itself up)", () => {
        const view = render(<Dialog toName="" entryId={xrp} asset="BTS" />);
        expect(memoOf(view.container)).toBe("xrp-memo");
    });
});

describe("changing the asset of the dialog after an entry was picked", () => {
    it("keeps the picked entry and its memo, to an asset the account has no entry for as well", () => {
        const view = render(<Dialog asset="BTS" />);
        pick(view.container, "(IOB.XRP)");
        expect(shown(view.container)).toContain("IOB.XRP");
        expect(memoOf(view.container)).toBe("xrp-memo");
        view.rerender(<Dialog asset="IOB.XLM" />);
        expect(shown(view.container)).toContain("IOB.XRP");
        view.rerender(<Dialog asset="USD" />);
        expect(shown(view.container)).toContain("IOB.XRP");
        expect(memoOf(view.container)).toBe("xrp-memo");
        view.rerender(<Dialog asset="IOB.XRP" />);
        expect(shown(view.container)).toContain("IOB.XRP");
    });

    it("keeps an entry for any asset, too", () => {
        saveEntry({name: "friend", label: "Friend", memo: "hi"});
        const view = render(<Dialog asset="BTS" />);
        pick(view.container, "Friend - friend");
        view.rerender(<Dialog asset="USD" />);
        expect(shown(view.container)).toContain("Friend - friend");
        view.rerender(<Dialog asset="BTS" />);
        expect(shown(view.container)).toContain("Friend - friend");
    });

    it("says that the entry is for another asset than the one sent, and not otherwise", () => {
        saveEntry({name: "friend", label: "Friend", memo: "hi"});
        const view = render(<Dialog asset="BTS" />);
        pick(view.container, "(IOB.XRP)");
        // (picking an entry for an asset: the dialog puts that asset in, the entry is for the one sent)
        view.rerender(<Dialog asset="IOB.XRP" />);
        expect(view.container.textContent).not.toContain("This entry is for");
        view.rerender(<Dialog asset="USD" />);
        expect(view.container.textContent).toContain(
            "This entry is for IOB.XRP, but you are sending USD."
        );
        // an entry for any asset fits every asset
        pick(view.container, "Friend - friend");
        view.rerender(<Dialog asset="BTS" />);
        expect(view.container.textContent).not.toContain("This entry is for");
    });

    it("still follows the asset when the account was only typed (nothing was picked)", () => {
        const view = render(
            <Dialog toName="ioxbank-gateway" asset="IOB.XLM" />
        );
        expect(shown(view.container)).toContain("IOB.XLM");
        view.rerender(<Dialog toName="ioxbank-gateway" asset="IOB.XRP" />);
        expect(shown(view.container)).toContain("IOB.XRP");
    });
});

describe("saving the recipient as a new entry", () => {
    const open = (container: HTMLElement) =>
        fireEvent.click(
            Array.from(container.querySelectorAll("button")).find(b =>
                (b.textContent || "").includes(
                    "Save as a new address book entry"
                )
            ) as HTMLElement
        );
    const field = (label: string) =>
        document.body.querySelector(
            `[aria-label="${label}"]`
        ) as HTMLInputElement;
    const typeIn = (label: string, text: string) =>
        fireEvent.change(field(label), {target: {value: text}});
    const press = (name: string) =>
        fireEvent.click(
            Array.from(document.body.querySelectorAll("button")).find(
                b => (b.textContent || "").trim() === name
            ) as HTMLElement
        );

    it("is offered with an entry shown, and not offered for an account that is not there or a name that is no account", () => {
        const view = render(
            <Dialog toName="ioxbank-gateway" entryId={xlm} asset="IOB.XLM" />
        );
        expect(view.container.textContent).toContain(
            "Save as a new address book entry"
        );
        expect(view.container.textContent).not.toContain(
            "Save this recipient in the address book"
        );
        view.unmount();
        // nothing in the book for this one: the old wording
        const fresh = render(<Dialog toName="newcomer" asset="BTS" />);
        expect(fresh.container.textContent).toContain(
            "Save this recipient in the address book"
        );
        expect(fresh.container.textContent).not.toContain(
            "Save as a new address book entry"
        );
        fresh.unmount();
        const bad = render(<Dialog toName="NOT AN ACCOUNT!" asset="BTS" />);
        expect(bad.container.textContent).not.toContain("Save");
    });

    it("opens with the recipient, the memo that is in the box and the asset that is sent, and keeps the others", () => {
        const view = render(
            <Dialog toName="ioxbank-gateway" entryId={xlm} asset="USD" />
        );
        fireEvent.click(view.getByText("type memo"));
        open(view.container);
        expect(field("Account name").value).toBe("ioxbank-gateway");
        expect(field("Memo").value).toBe("typed by hand");
        expect(field("Asset").value).toBe("USD");
        press("Save");
        expect(getAddressBook()).toHaveLength(3);
        const added = getAddressBook().find(e => e.asset === "USD")!;
        expect(added.memo).toBe("typed by hand");
        expect(added.id).not.toBe(xlm);
        expect(getAddressBook().find(e => e.id === xlm)!.memo).toBe("xlm-memo");
    });

    it("shows the new entry in the drop-down once it is saved, and keeps it", () => {
        const view = render(
            <Dialog toName="ioxbank-gateway" entryId={xlm} asset="USD" />
        );
        expect(shown(view.container)).toContain("IOB.XLM");
        open(view.container);
        press("Save");
        expect(shown(view.container)).toContain("(USD)");
        expect(shown(view.container)).not.toContain("IOB.XLM");
        view.rerender(
            <Dialog toName="ioxbank-gateway" entryId={xlm} asset="BTS" />
        );
        expect(shown(view.container)).toContain("(USD)");
    });

    it("has no warning about the account when it is changed in the form that opened from here (the entry is new)", () => {
        const view = render(
            <Dialog toName="ioxbank-gateway" entryId={xlm} asset="USD" />
        );
        open(view.container);
        typeIn("Account name", "someone-else");
        expect(document.body.querySelector("[role='alert']")).toBeNull();
    });

    it("refuses the account and the asset that are in the book already, and takes it with another asset", () => {
        const view = render(
            <Dialog toName="ioxbank-gateway" entryId={xlm} asset="IOB.XLM" />
        );
        open(view.container);
        press("Save");
        expect(document.body.textContent).toContain(
            "That account is in the address book already for this asset."
        );
        expect(getAddressBook()).toHaveLength(2);
        typeIn("Asset", "");
        press("Save");
        expect(getAddressBook()).toHaveLength(3);
        expect(
            getAddressBook().filter(e => e.name === "ioxbank-gateway")
        ).toHaveLength(3);
    });
});

describe("the entries are the book's", () => {
    it("knows both entries", () => {
        expect(
            getAddressBook()
                .map(e => e.asset)
                .sort()
        ).toEqual(["IOB.XLM", "IOB.XRP"]);
    });
});
