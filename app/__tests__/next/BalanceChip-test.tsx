// The top bar's balance: the core-asset balance of the current account, an eye that hides it, and nothing at
// all while the chain store has not loaded what it needs (a masked or zero figure there would be wrong).
import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import Immutable from "immutable";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

const mockObjects: Record<string, any> = {};
const mockAccounts: Record<string, any> = {};
const mockAssets: Record<string, any> = {};
const mockViewSettings = {map: Immutable.Map<string, any>()};
const mockChangeViewSetting = jest.fn();
const mockCurrent = {name: "alice" as string | null};

jest.mock("bitsharesjs", () => ({
    __esModule: true,
    ChainStore: {
        getObject: (id: string) => mockObjects[id],
        getAccount: (name: string) => mockAccounts[name],
        getAsset: (id: string) => mockAssets[id],
        subscribe: () => undefined,
        unsubscribe: () => undefined
    }
}));
jest.mock("actions/SettingsActions", () => ({
    __esModule: true,
    default: {
        changeViewSetting: (value: any) => mockChangeViewSetting(value)
    }
}));
jest.mock("../../store/slices/accountSlice", () => ({
    __esModule: true,
    selectAccountState: () => ({
        currentAccount: mockCurrent.name,
        passwordAccount: null
    })
}));
jest.mock("../../store/slices/settingsSlice", () => ({
    __esModule: true,
    selectSettingsState: () => ({viewSettings: mockViewSettings.map})
}));
jest.mock("../../store/slices/intlSlice", () => ({
    __esModule: true,
    selectIntlState: () => ({currentLocale: "en"})
}));
jest.mock("../../next/hooks/useReduxState", () => ({
    __esModule: true,
    useReduxState: (selector: any) => selector({})
}));

import BalanceChip, {
    BALANCE_HIDDEN_KEY,
    CoreBalance,
    coreBalance
} from "../../next/BalanceChip";

const core = () => Immutable.Map({id: "1.3.0", symbol: "BTS", precision: 5});
const accountWith = (balances: Record<string, string> | undefined) =>
    Immutable.Map({
        id: "1.2.100",
        name: "alice",
        ...(balances ? {balances: Immutable.Map(balances)} : {})
    });

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    for (const m of [mockObjects, mockAccounts, mockAssets]) {
        for (const k of Object.keys(m)) delete m[k];
    }
    mockViewSettings.map = Immutable.Map();
    mockCurrent.name = "alice";
    mockChangeViewSetting.mockClear();
    mockAssets["1.3.0"] = core();
    mockAccounts.alice = accountWith({"1.3.0": "2.5.1"});
    mockObjects["2.5.1"] = Immutable.Map({balance: "123456789012"});
});

describe("coreBalance", () => {
    it("reads the balance object of the core asset", () => {
        expect(coreBalance("alice")).toEqual({
            amount: BigInt("123456789012"),
            precision: 5,
            symbol: "BTS"
        });
    });

    it("is zero for an account whose balances are loaded and hold none of it", () => {
        mockAccounts.alice = accountWith({});
        expect((coreBalance("alice") as CoreBalance).amount).toBe(BigInt(0));
    });

    it("says loading while anything it needs has not loaded", () => {
        expect(coreBalance("bob")).toBe("loading"); // the account
        mockAccounts.alice = accountWith(undefined); // known by name, no balances yet
        expect(coreBalance("alice")).toBe("loading");
        mockAccounts.alice = accountWith({"1.3.0": "2.5.1"});
        delete mockObjects["2.5.1"]; // the balance object
        expect(coreBalance("alice")).toBe("loading");
        mockObjects["2.5.1"] = Immutable.Map({balance: "5"});
        delete mockAssets["1.3.0"]; // the asset
        expect(coreBalance("alice")).toBe("loading");
    });

    it("has nothing to say without an account, or for one that does not exist", () => {
        expect(coreBalance(null)).toBeNull();
        mockAccounts.ghost = null; // the chain store: asked for, not there
        expect(coreBalance("ghost")).toBeNull();
    });
});

describe("BalanceChip", () => {
    it("shows the amount with the asset's symbol", () => {
        const {container} = render(<BalanceChip />);
        expect(container.textContent).toContain("1,234,567.89012");
        expect(container.textContent).toContain("BTS");
    });

    it("says \u2026 until the balance is loaded, with no symbol and no amount of anything else", () => {
        delete mockObjects["2.5.1"];
        const {container} = render(<BalanceChip />);
        expect(container.textContent).toContain("\u2026");
        expect(container.textContent).not.toContain("BTS");
        expect(
            container.querySelector("[data-balance='loading']")
        ).toBeTruthy();
    });

    it("shows nothing for no account at all", () => {
        mockCurrent.name = null;
        const {container} = render(<BalanceChip />);
        expect(container.innerHTML).toBe("");
    });

    it("switches to the amount of the other account at once, and never shows the old one for it", () => {
        mockAccounts.bob = accountWith({"1.3.0": "2.5.2"});
        mockObjects["2.5.2"] = Immutable.Map({balance: "700000"});
        const {container, rerender} = render(<BalanceChip />);
        expect(container.textContent).toContain("1,234,567.89012");
        mockCurrent.name = "bob";
        rerender(<BalanceChip />);
        expect(container.textContent).toContain("7 BTS");
        expect(container.textContent).not.toContain("1,234,567");
        // and to an account the store has not loaded yet: the dots of waiting, not alice's amount
        mockCurrent.name = "carol";
        rerender(<BalanceChip />);
        expect(container.textContent).toContain("\u2026");
        expect(container.textContent).not.toContain("1,234,567");
        expect(container.textContent).not.toContain("7 BTS");
    });

    it("masks the amount when the view setting says so, and offers to show it", () => {
        mockViewSettings.map = Immutable.Map({[BALANCE_HIDDEN_KEY]: true});
        const {container, getByLabelText} = render(<BalanceChip />);
        expect(container.textContent).not.toContain("1,234,567");
        expect(container.textContent).toContain("••");
        expect(container.textContent).toContain("BTS");
        expect(getByLabelText("Show balance")).toBeTruthy();
    });

    it("the eye hides a shown amount, and shows a hidden one", () => {
        const {getByLabelText, unmount} = render(<BalanceChip />);
        fireEvent.click(getByLabelText("Hide balance"));
        expect(mockChangeViewSetting).toHaveBeenLastCalledWith({
            [BALANCE_HIDDEN_KEY]: true
        });
        unmount();

        mockViewSettings.map = Immutable.Map({[BALANCE_HIDDEN_KEY]: true});
        const again = render(<BalanceChip />);
        fireEvent.click(again.getByLabelText("Show balance"));
        expect(mockChangeViewSetting).toHaveBeenLastCalledWith({
            [BALANCE_HIDDEN_KEY]: false
        });
    });

    it("never prints the amount into an accessible name while it is hidden", () => {
        mockViewSettings.map = Immutable.Map({[BALANCE_HIDDEN_KEY]: true});
        const {container} = render(<BalanceChip />);
        const masked = container.querySelector("[aria-hidden='true']");
        expect(masked?.textContent).toMatch(/^•+$/);
    });
});
