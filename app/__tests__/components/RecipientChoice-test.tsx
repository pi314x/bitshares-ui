// The recipient helper of the Send dialog remembers WHICH entry was picked, by its id: two entries can be for one account
// (an exchange takes a tag for each asset) and even carry one label, and the account and the asset alone cannot say which
// was meant - the first always won ("only the first one is chosen, even when I select the second one").
import * as React from "react";
import {fireEvent, render} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

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

    it("holds while the dialog's asset is put on the entry's asset, and lets go when the asset moves on", () => {
        const view = render(
            <Dialog toName="ioxbank-gateway" entryId={xlm} asset="BTS" />
        );
        expect(shown(view.container)).toContain("IOB.XLM");
        // the dialog selects the entry's asset
        view.rerender(
            <Dialog toName="ioxbank-gateway" entryId={xlm} asset="IOB.XLM" />
        );
        expect(shown(view.container)).toContain("IOB.XLM");
        // and the user changes to the other asset: the entry for that asset counts, and its memo comes along
        view.rerender(
            <Dialog toName="ioxbank-gateway" entryId={xlm} asset="IOB.XRP" />
        );
        expect(shown(view.container)).toContain("IOB.XRP");
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

describe("the entries are the book's", () => {
    it("knows both entries", () => {
        expect(
            getAddressBook()
                .map(e => e.asset)
                .sort()
        ).toEqual(["IOB.XLM", "IOB.XRP"]);
    });
});
