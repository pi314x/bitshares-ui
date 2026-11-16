// Withdraw in its two layouts: the dialog (the portfolio's Withdraw, ...) and the page (the Payments menu): the same
// selection, address, amount and fee blocks, stacked in one popup body or laid out as three cards with a summary
// whose button says what is missing. The blocks' own components are stubs; what is looked at is the layout.
import * as React from "react";
import {render} from "@testing-library/react";
import Immutable from "immutable";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

jest.mock("bitsharesjs", () => ({
    ...jest.requireActual("bitsharesjs"),
    ChainStore: {
        getAccount: (name: string) =>
            name === "alice"
                ? // eslint-disable-next-line @typescript-eslint/no-var-requires
                  require("immutable").fromJS({
                      id: "1.2.5",
                      name: "alice",
                      balances: {}
                  })
                : undefined,
        getAsset: () => undefined,
        getObject: () => undefined,
        subscribe: () => undefined,
        unsubscribe: () => undefined
    }
}));
jest.mock("../../next/hooks/useReduxState", () => ({
    useReduxState: () => ({
        currentAccount: "alice",
        allMarketStats: {},
        settings: {get: () => undefined},
        viewSettings: {get: () => undefined}
    })
}));
jest.mock("../../next/hooks/useChainStoreTick", () => ({
    useChainStoreTick: () => undefined
}));
jest.mock("actions/MarketsActions", () => ({
    __esModule: true,
    default: {getMarketStats: jest.fn()}
}));
jest.mock("actions/AccountActions", () => ({
    __esModule: true,
    default: {transfer: jest.fn()}
}));
jest.mock("stores/SettingsStore", () => ({
    __esModule: true,
    default: {getSetting: () => "BTS"}
}));
jest.mock("lib/common/gatewayMethods", () => ({
    validateAddress: jest.fn(),
    WithdrawAddresses: {
        get: () => [],
        has: () => false,
        set: jest.fn(),
        getLast: () => ""
    }
}));
jest.mock(
    "../../components/DepositWithdraw/DepositWithdrawAssetSelector",
    () => ({
        __esModule: true,
        default: () => <div data-field="asset-selector">asset selector</div>
    })
);
jest.mock("components/Exchange/ExchangeInput", () => ({
    __esModule: true,
    default: () => <input data-field="quantity" />
}));
jest.mock("../../components/Utility/AssetName", () => ({
    __esModule: true,
    default: () => <span>asset</span>
}));
jest.mock("../../components/Utility/FormattedAsset", () => ({
    __esModule: true,
    default: () => <span>formatted</span>
}));
jest.mock("../../components/Utility/BalanceComponent", () => ({
    __esModule: true,
    default: () => <span>balance</span>
}));
jest.mock("../../components/QRAddressScanner", () => ({
    __esModule: true,
    default: () => <span>scan</span>
}));
jest.mock("components/Account/AccountSelector", () => ({
    __esModule: true,
    default: () => <div data-field="account-selector">account</div>
}));
jest.mock("components/Utility/FeeAssetSelector", () => ({
    __esModule: true,
    default: () => <div data-field="fee">fee</div>
}));

import WithdrawModal from "../../components/Modal/WithdrawModalNew";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

const BACKED = Immutable.Map();

describe("Withdraw, as a page", () => {
    it("is three cards and a summary with no dialog, and says what is missing", () => {
        const {container, getByText} = render(
            <WithdrawModal
                visible
                layout="page"
                backedCoins={BACKED}
                hideModal={() => undefined}
            />
        );
        expect(document.querySelector('[role="dialog"]')).toBeNull();
        expect(
            Array.from(container.querySelectorAll("h2")).map(h => h.textContent)
        ).toEqual([
            "What to withdraw",
            "Where it goes",
            "Amount and fees",
            "Summary"
        ]);
        expect(
            container.querySelector('section [data-field="asset-selector"]')
        ).not.toBeNull();
        // nothing chosen: the later cards wait, the button is off and says why
        expect(container.querySelectorAll("p").length).toBeGreaterThanOrEqual(
            2
        );
        expect(getByText("Choose an asset to withdraw.")).toBeTruthy();
        const withdraw = Array.from(container.querySelectorAll("button")).find(
            b => b.textContent === "Withdraw"
        ) as HTMLButtonElement;
        expect(withdraw.disabled).toBe(true);
    });
});

describe("Withdraw, as a dialog", () => {
    it("is the one popup with the selector in its body and Withdraw and Cancel in its foot", () => {
        render(
            <WithdrawModal
                visible
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
        ).toEqual(expect.arrayContaining(["Withdraw", "Cancel"]));
    });
});
