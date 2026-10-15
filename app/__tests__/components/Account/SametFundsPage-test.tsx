// The SameT funds page moves real money (create / top up / withdraw / delete a
// fund). The chain layer is mocked; what is verified here is everything the page
// itself decides: what it shows, what it lets the user submit, and exactly which
// arguments reach the transaction layer - never more than the account holds,
// never an amount that needs rounding, nothing at all for a form that changes
// nothing.
// The repo's jest (24) ships jsdom 11, which has no MutationObserver; Testing
// Library's waitFor/findBy only use it as an extra wake-up on top of polling,
// so an inert stand-in is enough.
if (typeof (global as any).MutationObserver === "undefined") {
    (global as any).MutationObserver = class {
        observe() {
            // intentionally inert
        }
        disconnect() {
            // intentionally inert
        }
        takeRecords() {
            return [];
        }
    };
}

jest.mock("../../../actions/SametFundActions", () => ({
    __esModule: true,
    PAGE_SIZE: 100,
    default: {
        listAll: jest.fn(),
        listByOwner: jest.fn(),
        getAssets: jest.fn(),
        getAccounts: jest.fn(),
        getAccountByName: jest.fn(),
        getBalances: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn()
    }
}));
jest.mock("../../../design-system/Notification", () => ({
    Notification: {
        success: jest.fn(),
        error: jest.fn(),
        warning: jest.fn(),
        info: jest.fn()
    }
}));

import * as React from "react";
import {
    render,
    screen,
    fireEvent,
    waitFor,
    within,
    act
} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import counterpart from "counterpart";
import localeEn from "../../../assets/locales/locale-en.json";
import SametFundActions from "../../../actions/SametFundActions";
import SametFundsPage from "../../../components/Account/SametFund/SametFundsPage";
import {reduxStore} from "../../../store/reduxStore";
import {patchState} from "../../../store/slices/accountSlice";

const actions = SametFundActions as any;

const FUNDS = [
    {
        id: "1.20.5",
        owner_account: "1.2.100",
        asset_type: "1.3.0",
        balance: "100000000",
        fee_rate: 300,
        unpaid_amount: "0"
    },
    {
        id: "1.20.9",
        owner_account: "1.2.200",
        asset_type: "1.3.7",
        balance: "2500",
        fee_rate: 1000,
        unpaid_amount: "10"
    }
];

function setAccount(name: string | null) {
    act(() => {
        reduxStore.dispatch(
            patchState({currentAccount: name, passwordAccount: null})
        );
    });
}

function mount() {
    return render(
        <MemoryRouter>
            <SametFundsPage />
        </MemoryRouter>
    );
}

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    jest.clearAllMocks();
    actions.listAll.mockResolvedValue({funds: FUNDS, next: null});
    actions.listByOwner.mockResolvedValue({funds: [FUNDS[0]], next: null});
    actions.getAssets.mockImplementation((ids: string[]) =>
        Promise.resolve(
            Object.fromEntries(
                ids.map(id => [
                    id,
                    id === "1.3.0"
                        ? {id, symbol: "BTS", precision: 5}
                        : {id, symbol: "XBTSX.USDT", precision: 2}
                ])
            )
        )
    );
    actions.getAccounts.mockResolvedValue({
        "1.2.100": {id: "1.2.100", name: "alice"},
        "1.2.200": {id: "1.2.200", name: "bob"}
    });
    actions.getAccountByName.mockImplementation((name: string) =>
        Promise.resolve(
            name === "alice" ? {id: "1.2.100", name: "alice"} : null
        )
    );
    actions.getBalances.mockResolvedValue([
        {asset_id: "1.3.0", amount: "150000"},
        {asset_id: "1.3.7", amount: "999"}
    ]);
    actions.create.mockResolvedValue([]);
    actions.update.mockResolvedValue([]);
    actions.delete.mockResolvedValue([]);
    setAccount(null);
});

async function choose(trigger: HTMLElement, optionText: string) {
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole("option", {name: optionText}));
}

describe("SametFundsPage - browsing", () => {
    it("lists every fund with resolved names, exact balances and fee rates", async () => {
        mount();
        expect(await screen.findByText("1.20.5")).toBeTruthy();
        // balances use the asset's precision; the fee rate is a percentage
        expect(await screen.findByText("1,000.00000")).toBeTruthy();
        expect(screen.getByText("25.00")).toBeTruthy();
        expect(screen.getByText("0.03%")).toBeTruthy();
        expect(screen.getByText("0.1%")).toBeTruthy();
        expect(await screen.findByText("alice")).toBeTruthy();
        expect(screen.getByText("bob")).toBeTruthy();
        expect(screen.getByText("BTS")).toBeTruthy();
        expect(screen.getByText("XBTSX.USDT")).toBeTruthy();
        expect(screen.getByText(/2 funds shown, 2 assets/)).toBeTruthy();
    });

    it("explains the flash-loan model and that it does not borrow", async () => {
        mount();
        await screen.findByText("1.20.5");
        expect(screen.getByText(/flash loan/)).toBeTruthy();
        expect(screen.getByText(/does not borrow from them/)).toBeTruthy();
    });

    it("offers no management without an account", async () => {
        mount();
        await screen.findByText("1.20.5");
        expect(screen.queryByRole("button", {name: "Create fund"})).toBeNull();
        fireEvent.click(screen.getByRole("tab", {name: "My funds"}));
        expect(screen.getByText(/Select an account/)).toBeTruthy();
        expect(actions.listByOwner).not.toHaveBeenCalled();
    });

    it("shows the account's own funds with actions once an account is selected", async () => {
        setAccount("alice");
        mount();
        await screen.findByRole("button", {name: "Create fund"});
        fireEvent.click(screen.getByRole("tab", {name: "My funds"}));
        expect(
            await screen.findByRole("button", {name: "Update"})
        ).toBeTruthy();
        expect(screen.getByRole("button", {name: "Delete"})).toBeTruthy();
        expect(actions.listByOwner).toHaveBeenCalledWith("1.2.100", null);
    });

    it("pages through the chain results", async () => {
        actions.listAll.mockResolvedValueOnce({
            funds: [FUNDS[0]],
            next: "1.20.6"
        });
        actions.listAll.mockResolvedValueOnce({funds: [FUNDS[1]], next: null});
        mount();
        fireEvent.click(await screen.findByRole("button", {name: "Load more"}));
        await screen.findByText("1.20.9");
        expect(actions.listAll).toHaveBeenNthCalledWith(2, "1.20.6");
        expect(screen.queryByRole("button", {name: "Load more"})).toBeNull();
    });

    it("says why a load failed instead of showing an empty list", async () => {
        actions.listAll.mockRejectedValue(new Error("node unreachable"));
        mount();
        expect(await screen.findByText(/node unreachable/)).toBeTruthy();
    });
});

describe("SametFundsPage - creating a fund", () => {
    async function openCreate() {
        setAccount("alice");
        mount();
        fireEvent.click(
            await screen.findByRole("button", {name: "Create fund"})
        );
        const dialog = await screen.findByRole("dialog");
        await within(dialog).findByText("Asset");
        return dialog;
    }

    it("blocks submission until the input is valid and within the balance", async () => {
        const dialog = await openCreate();
        const submit = within(dialog).getByRole("button", {
            name: "Create fund"
        });
        expect((submit as HTMLButtonElement).disabled).toBe(true);

        await choose(within(dialog).getByText("Select an asset"), "BTS");
        const [amount, rate] = within(dialog).getAllByRole("textbox");

        fireEvent.change(amount, {target: {value: "1.123456"}});
        expect(within(dialog).getByText(/at most 5 decimals/)).toBeTruthy();
        fireEvent.change(amount, {target: {value: "1.50001"}});
        expect(
            within(dialog).getByText(/More than your available balance/)
        ).toBeTruthy();
        fireEvent.change(amount, {target: {value: "0"}});
        expect(within(dialog).getByText(/greater than zero/)).toBeTruthy();
        fireEvent.change(amount, {target: {value: "1.5"}});
        expect((submit as HTMLButtonElement).disabled).toBe(true); // no fee rate yet

        fireEvent.change(rate, {target: {value: "100.5"}});
        expect(within(dialog).getByText(/between 0 and 100/)).toBeTruthy();
        expect((submit as HTMLButtonElement).disabled).toBe(true);

        fireEvent.change(rate, {target: {value: "0.03"}});
        expect((submit as HTMLButtonElement).disabled).toBe(false);
    });

    it("sends exact integer units and the fee rate, then refreshes the lists", async () => {
        const dialog = await openCreate();
        await choose(within(dialog).getByText("Select an asset"), "BTS");
        const [amount, rate] = within(dialog).getAllByRole("textbox");
        fireEvent.change(amount, {target: {value: "1.5"}});
        fireEvent.change(rate, {target: {value: "0.03"}});
        fireEvent.click(
            within(dialog).getByRole("button", {name: "Create fund"})
        );

        await waitFor(() => expect(actions.create).toHaveBeenCalledTimes(1));
        expect(actions.create).toHaveBeenCalledWith({
            owner: "1.2.100",
            assetId: "1.3.0",
            balance: "150000",
            feeRate: 300
        });
        await waitFor(() =>
            expect(actions.listAll.mock.calls.length).toBeGreaterThan(1)
        );
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    });

    it("keeps the dialog open and shows the reason when the transaction fails", async () => {
        actions.create.mockRejectedValue(new Error("insufficient balance"));
        const dialog = await openCreate();
        await choose(within(dialog).getByText("Select an asset"), "BTS");
        const [amount, rate] = within(dialog).getAllByRole("textbox");
        fireEvent.change(amount, {target: {value: "1"}});
        fireEvent.change(rate, {target: {value: "1"}});
        fireEvent.click(
            within(dialog).getByRole("button", {name: "Create fund"})
        );
        expect(
            await within(dialog).findByText("insufficient balance")
        ).toBeTruthy();
        expect(screen.getByRole("dialog")).toBeTruthy();
    });
});

describe("SametFundsPage - updating and deleting", () => {
    async function openMine() {
        setAccount("alice");
        mount();
        await screen.findByRole("button", {name: "Create fund"});
        fireEvent.click(screen.getByRole("tab", {name: "My funds"}));
        return screen.findByRole("button", {name: "Update"});
    }

    it("withdraws as a negative delta and refuses more than the fund holds", async () => {
        fireEvent.click(await openMine());
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(
            within(dialog).getByRole("button", {name: "Withdraw funds"})
        );
        const amount = within(dialog).getAllByRole("textbox")[0];
        fireEvent.change(amount, {target: {value: "1000.00001"}});
        expect(
            within(dialog).getByText(/More than the fund's balance/)
        ).toBeTruthy();
        fireEvent.change(amount, {target: {value: "250"}});
        fireEvent.click(
            within(dialog).getByRole("button", {name: "Update fund"})
        );
        await waitFor(() => expect(actions.update).toHaveBeenCalledTimes(1));
        expect(actions.update).toHaveBeenCalledWith({
            owner: "1.2.100",
            fundId: "1.20.5",
            deltaAmount: {assetId: "1.3.0", amount: "-25000000"},
            newFeeRate: undefined
        });
    });

    it("changes only the fee rate when the balance is left alone", async () => {
        fireEvent.click(await openMine());
        const dialog = await screen.findByRole("dialog");
        const submit = within(dialog).getByRole("button", {
            name: "Update fund"
        }) as HTMLButtonElement;
        expect(submit.disabled).toBe(true); // nothing changed yet
        expect(
            within(dialog).getByText(/Change the balance or the fee rate first/)
        ).toBeTruthy();
        const rate = within(dialog).getAllByRole("textbox")[0];
        fireEvent.change(rate, {target: {value: "0.5"}});
        expect(submit.disabled).toBe(false);
        fireEvent.click(submit);
        await waitFor(() => expect(actions.update).toHaveBeenCalledTimes(1));
        expect(actions.update).toHaveBeenCalledWith({
            owner: "1.2.100",
            fundId: "1.20.5",
            deltaAmount: undefined,
            newFeeRate: 5000
        });
    });

    it("tops up from the balance, never above what the account has", async () => {
        fireEvent.click(await openMine());
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(
            within(dialog).getByRole("button", {name: "Add funds"})
        );
        await within(dialog).findByText(/Available: 1.50000 BTS/);
        const amount = within(dialog).getAllByRole("textbox")[0];
        fireEvent.change(amount, {target: {value: "1.50001"}});
        expect(
            within(dialog).getByText(/More than your available balance/)
        ).toBeTruthy();
        fireEvent.change(amount, {target: {value: "1.5"}});
        fireEvent.click(
            within(dialog).getByRole("button", {name: "Update fund"})
        );
        await waitFor(() => expect(actions.update).toHaveBeenCalledTimes(1));
        expect(actions.update.mock.calls[0][0].deltaAmount).toEqual({
            assetId: "1.3.0",
            amount: "150000"
        });
    });

    it("deletes after confirmation and says what comes back", async () => {
        await openMine();
        fireEvent.click(screen.getByRole("button", {name: "Delete"}));
        const dialog = await screen.findByRole("dialog");
        expect(
            within(dialog).getByText(
                /1,000.00000 BTS is returned to your account/
            )
        ).toBeTruthy();
        fireEvent.click(
            within(dialog).getByRole("button", {name: "Delete fund"})
        );
        await waitFor(() => expect(actions.delete).toHaveBeenCalledTimes(1));
        expect(actions.delete).toHaveBeenCalledWith({
            owner: "1.2.100",
            fundId: "1.20.5"
        });
    });

    it("does nothing when the dialog is cancelled", async () => {
        await openMine();
        fireEvent.click(screen.getByRole("button", {name: "Delete"}));
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", {name: "Cancel"}));
        await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
        expect(actions.delete).not.toHaveBeenCalled();
    });
});

describe("SameT locale strings", () => {
    // counterpart interpolates with sprintf, which throws on a stray "%" - one
    // bad string would take the whole page down, so every key is rendered.
    it("every samet.* string translates with realistic parameters", () => {
        const params = {
            id: "1.20.5",
            amount: "1.00000 BTS",
            error: "boom",
            count: 2,
            assets: 1,
            precision: 5,
            value: "0.03%"
        };
        Object.keys((localeEn as any).samet).forEach(key => {
            const text = (counterpart as any).translate(`samet.${key}`, params);
            expect(text).not.toMatch(/missing translation/i);
            expect(text).not.toMatch(/%\(/);
        });
    });
});
