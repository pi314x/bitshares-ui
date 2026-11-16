// Deposit in its two layouts: the dialog (the portfolio's Deposit, ...) and the page (the Payments menu): the same
// asset and gateway selection and the same address, as one body in a popup or as two cards with a summary. The
// selectors are stubs; what is looked at is the layout and the button of the summary.
import * as React from "react";
import {fireEvent, render} from "@testing-library/react";
import Immutable from "immutable";
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
jest.mock("common/gatewayMethods", () => ({
    requestDepositAddress: jest.fn()
}));
jest.mock("common/BlockTradesDepositAddressCache", () => ({
    __esModule: true,
    default: function BlockTradesDepositAddressCache() {
        return {};
    }
}));
jest.mock(
    "../../components/DepositWithdraw/DepositWithdrawAssetSelector",
    () => ({
        __esModule: true,
        default: () => <div data-field="asset-selector">asset selector</div>
    })
);
jest.mock("../../components/Utility/CryptoLinkFormatter", () => ({
    __esModule: true,
    default: () => <div data-field="qr">qr</div>
}));
jest.mock("../../components/LoadingIndicator", () => ({
    __esModule: true,
    default: () => <div>loading</div>
}));

import DepositModal from "../../components/Modal/DepositModal";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

const BACKED = Immutable.Map();

describe("Deposit, as a page", () => {
    it("is two cards and a summary with no dialog, and says to choose an asset first", () => {
        const {container, getByText} = render(
            <DepositModal
                visible
                layout="page"
                account="alice"
                backedCoins={BACKED}
                hideModal={() => undefined}
            />
        );
        expect(document.querySelector('[role="dialog"]')).toBeNull();
        expect(
            Array.from(container.querySelectorAll("h2")).map(h => h.textContent)
        ).toEqual(["What to deposit", "Where to send it", "Summary"]);
        // the selector is in the first card, the hint in the second
        expect(
            container.querySelector('section [data-field="asset-selector"]')
        ).not.toBeNull();
        expect(
            getByText("Choose an asset first: its address is shown here.")
        ).toBeTruthy();
        // the page's title carries the account
        expect(container.textContent).toContain("alice");
    });

    it("closes through the button of the summary", () => {
        const hideModal = jest.fn();
        const {getByText} = render(
            <DepositModal
                visible
                layout="page"
                account="alice"
                backedCoins={BACKED}
                hideModal={hideModal}
            />
        );
        fireEvent.click(getByText("Close"));
        expect(hideModal).toHaveBeenCalledTimes(1);
    });
});

describe("Deposit, as a dialog", () => {
    it("is the one popup with the selector in its body and Close in its foot", () => {
        render(
            <DepositModal
                visible
                account="alice"
                backedCoins={BACKED}
                hideModal={() => undefined}
            />
        );
        const dialog = document.querySelector('[role="dialog"]');
        expect(dialog).not.toBeNull();
        expect(
            dialog!.querySelector('[data-field="asset-selector"]')
        ).not.toBeNull();
        expect(dialog!.querySelectorAll("section h2").length).toBe(0);
        expect(
            Array.from(dialog!.querySelectorAll("button")).map(
                b => b.textContent
            )
        ).toEqual(expect.arrayContaining(["Close"]));
    });
});
