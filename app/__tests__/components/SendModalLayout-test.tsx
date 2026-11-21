// Send in its two layouts: the dialog (the portfolio's Send, ...) and the page (the Payments menu): the same fields,
// laid out as one list in a popup or as numbered cards with a summary - and the button of the summary, which says what
// is missing while the form cannot be sent. The big fields (account selectors, the amount, the fee) are stubs here;
// what is looked at is the layout and what the page tells.
import * as React from "react";
import {act, render} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

jest.mock("bitsharesjs", () => ({
    ...jest.requireActual("bitsharesjs"),
    ChainStore: {
        getAccount: () => undefined,
        getAsset: () => undefined,
        getObject: () => undefined,
        subscribe: () => undefined,
        unsubscribe: () => undefined
    }
}));
jest.mock("stores/AccountStore", () => ({
    __esModule: true,
    default: {isMyAccount: () => true}
}));
jest.mock("stores/TransactionConfirmStore", () => ({
    __esModule: true,
    default: {listen: jest.fn(), unlisten: jest.fn(), reset: jest.fn()}
}));
jest.mock("actions/AccountActions", () => ({
    __esModule: true,
    default: {transfer: jest.fn()}
}));
jest.mock("../../components/Account/AccountSelector", () => ({
    __esModule: true,
    default: (props: any) => <div data-field={props.label}>{props.label}</div>
}));
jest.mock("../../components/Utility/AmountSelectorStyleGuide", () => ({
    __esModule: true,
    default: () => <div data-field="amount">amount</div>
}));
jest.mock("../../components/Utility/FeeAssetSelector", () => ({
    __esModule: true,
    default: () => <div data-field="fee">fee</div>
}));
jest.mock("../../components/Utility/BalanceComponent", () => ({
    __esModule: true,
    default: () => <span>balance</span>
}));
jest.mock("../../components/AddressBook/RecipientHelper", () => ({
    __esModule: true,
    default: () => <div data-field="helper">helper</div>
}));

import SendModal from "../../components/Modal/SendModal";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

function open(layout?: "page" | "dialog") {
    const ref = React.createRef<{show: () => void}>();
    const view = render(
        <SendModal
            id="send_test"
            from_name="alice"
            layout={layout}
            refCallback={(r: any) => {
                (ref as any).current = r;
            }}
        />
    );
    act(() => {
        ref.current!.show();
    });
    return view;
}

describe("Send, as a page", () => {
    it("lays the fields out as three numbered cards with a summary and no dialog", () => {
        const {container, getByText} = open("page");
        expect(document.querySelector('[role="dialog"]')).toBeNull();
        // the three steps, in order, and what the summary is called
        const titles = Array.from(container.querySelectorAll("h2")).map(
            h => h.textContent
        );
        expect(titles).toEqual([
            "Who pays whom",
            "What to send",
            "Fee",
            "Summary"
        ]);
        // every field is in a card
        [
            "transfer.from",
            "transfer.to",
            "helper",
            "amount",
            "fee"
        ].forEach(field =>
            expect(
                container.querySelector(`section [data-field="${field}"]`)
            ).not.toBeNull()
        );
        // the share buttons of the amount
        ["25%", "50%", "75%", "Max"].forEach(label =>
            expect(getByText(label)).toBeTruthy()
        );
    });

    it("keeps the button of the summary off and says what is missing", () => {
        const {container} = open("page");
        const send = Array.from(container.querySelectorAll("button")).filter(
            b => b.textContent === "Send"
        );
        // the mode tab and the summary's button both say "Send"; the last one is the button
        const primary = send[send.length - 1] as HTMLButtonElement;
        expect(primary.disabled).toBe(true);
        // no sender account has loaded (the stubs hold none): the form says to complete it
        expect(container.textContent).toContain("Complete the form.");
    });
});

describe("Send, as a dialog", () => {
    it("is the one popup of fields in a list, as before, with Send and Cancel in its foot", () => {
        open();
        const dialog = document.querySelector('[role="dialog"]');
        expect(dialog).not.toBeNull();
        expect(dialog!.querySelectorAll("section h2").length).toBe(0);
        [
            "transfer.from",
            "transfer.to",
            "helper",
            "amount",
            "fee"
        ].forEach(field =>
            expect(
                dialog!.querySelector(`[data-field="${field}"]`)
            ).not.toBeNull()
        );
        const foot = Array.from(dialog!.querySelectorAll("button")).map(
            b => b.textContent
        );
        expect(foot).toEqual(expect.arrayContaining(["Send", "Cancel"]));
    });
});
