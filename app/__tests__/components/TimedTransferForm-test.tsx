import * as React from "react";
import {render, fireEvent, act} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

const mockGetBalances = jest.fn();
const mockGetAssets = jest.fn();
const mockGetAccountByName = jest.fn();
const mockCreate = jest.fn();

jest.mock("../../actions/SametFundActions", () => ({
    __esModule: true,
    default: {
        getBalances: (...a: any[]) => mockGetBalances(...a),
        getAssets: (...a: any[]) => mockGetAssets(...a),
        getAccountByName: (...a: any[]) => mockGetAccountByName(...a)
    }
}));
jest.mock("../../actions/TimedTransferActions", () => ({
    __esModule: true,
    default: {create: (...a: any[]) => mockCreate(...a)}
}));

import TimedTransferForm from "../../components/Account/TimedTransferForm";

// This jsdom has no MutationObserver, so testing-library's waitFor is out:
// poll inside act() until the assertion holds.
async function waitFor(check: () => void, options: {timeout?: number} = {}) {
    const deadline = Date.now() + (options.timeout || 1500);
    for (;;) {
        try {
            check();
            return;
        } catch (e) {
            if (Date.now() > deadline) throw e;
            await act(async () => {
                await new Promise(resolve => setTimeout(resolve, 25));
            });
        }
    }
}

const creator = {id: "1.2.100", name: "alice"};

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    jest.clearAllMocks();
    mockGetBalances.mockResolvedValue([{asset_id: "1.3.0", amount: "1000000"}]);
    mockGetAssets.mockResolvedValue({
        "1.3.0": {id: "1.3.0", symbol: "BTS", precision: 5}
    });
    mockGetAccountByName.mockImplementation((name: string) =>
        Promise.resolve(name === "bob" ? {id: "1.2.200", name: "bob"} : null)
    );
    mockCreate.mockResolvedValue({});
});

const submitButton = (container: HTMLElement) =>
    Array.from(container.ownerDocument.querySelectorAll("button")).find(b =>
        /Create timed transfer/.test(b.textContent || "")
    ) as HTMLButtonElement;

describe("TimedTransferForm", () => {
    it("stays disabled until recipient, asset, amount and release are valid, then sends the exact arguments", async () => {
        const onDone = jest.fn();
        const {container, getByPlaceholderText, getByText} = render(
            <TimedTransferForm
                creator={creator}
                onCancel={() => {}}
                onDone={onDone}
            />
        );
        await waitFor(() =>
            expect(mockGetBalances).toHaveBeenCalledWith("1.2.100")
        );
        expect(submitButton(container).disabled).toBe(true);

        fireEvent.change(getByPlaceholderText("Account name"), {
            target: {value: "bob"}
        });
        await waitFor(
            () => expect(mockGetAccountByName).toHaveBeenCalledWith("bob"),
            {timeout: 2000}
        );

        fireEvent.click(getByText("Choose an asset"));
        // (an asset is listed with what is held of it)
        await waitFor(() => getByText("BTS - 10.00000"));
        fireEvent.click(getByText("BTS - 10.00000"));

        const amount = container.ownerDocument.querySelector(
            'input[inputmode="decimal"]'
        ) as HTMLInputElement;
        fireEvent.change(amount, {target: {value: "2.5"}});

        const release = container.ownerDocument.querySelector(
            'input[type="datetime-local"]'
        ) as HTMLInputElement;
        const target = new Date(Date.now() + 3 * 86400 * 1000);
        const pad = (n: number) => String(n).padStart(2, "0");
        const value = `${target.getFullYear()}-${pad(
            target.getMonth() + 1
        )}-${pad(target.getDate())}T${pad(target.getHours())}:${pad(
            target.getMinutes()
        )}`;
        fireEvent.change(release, {target: {value}});

        await waitFor(() =>
            expect(submitButton(container).disabled).toBe(false)
        );
        await act(async () => {
            fireEvent.click(submitButton(container));
        });
        await waitFor(() => expect(mockCreate).toHaveBeenCalledTimes(1));
        const args = mockCreate.mock.calls[0][0];
        expect(args).toMatchObject({
            creator: "1.2.100",
            owner: "1.2.200",
            assetId: "1.3.0",
            amount: "250000" // 2.5 BTS at precision 5
        });
        expect(args.releaseSec - args.nowSec).toBeGreaterThan(2 * 86400);
        await waitFor(() => expect(onDone).toHaveBeenCalled());
    });

    it("says so when the recipient does not exist and never submits", async () => {
        const {container, getByPlaceholderText, getByText} = render(
            <TimedTransferForm
                creator={creator}
                onCancel={() => {}}
                onDone={() => {}}
            />
        );
        fireEvent.change(getByPlaceholderText("Account name"), {
            target: {value: "nobody"}
        });
        await waitFor(() => getByText("No account with that name"), {
            timeout: 2000
        });
        expect(submitButton(container).disabled).toBe(true);
        expect(mockCreate).not.toHaveBeenCalled();
    });

    it("refuses to send to yourself", async () => {
        mockGetAccountByName.mockResolvedValue({id: "1.2.100", name: "alice"});
        const {getByPlaceholderText, getByText} = render(
            <TimedTransferForm
                creator={creator}
                onCancel={() => {}}
                onDone={() => {}}
            />
        );
        fireEvent.change(getByPlaceholderText("Account name"), {
            target: {value: "alice"}
        });
        await waitFor(() => getByText("Choose another account than your own"), {
            timeout: 2000
        });
    });
});

describe("TimedTransferForm as a page", () => {
    const fill = async (view: ReturnType<typeof render>) => {
        await waitFor(() =>
            expect(mockGetBalances).toHaveBeenCalledWith("1.2.100")
        );
        fireEvent.change(view.getByPlaceholderText("Account name"), {
            target: {value: "bob"}
        });
        await waitFor(
            () =>
                expect(view.container.textContent).toContain("Found: 1.2.200"),
            {timeout: 2000}
        );
        fireEvent.click(view.getByText("Choose an asset"));
        await waitFor(() => view.getByText("BTS - 10.00000"));
        fireEvent.click(view.getByText("BTS - 10.00000"));
    };
    const summary = (view: ReturnType<typeof render>) =>
        view.container.querySelector("aside") as HTMLElement;
    const buttonOf = (view: ReturnType<typeof render>, name: string) =>
        Array.from(view.container.querySelectorAll("button")).find(
            b => (b.textContent || "").trim() === name
        ) as HTMLButtonElement;

    it("is a page: three numbered steps, the summary beside them, and no dialog", () => {
        const view = render(
            <TimedTransferForm
                creator={creator}
                onCancel={() => {}}
                onDone={() => {}}
            />
        );
        expect(view.container.querySelector("h1")?.textContent).toBe(
            "Timed transfer"
        );
        const steps = Array.from(view.container.querySelectorAll("h2")).map(
            h => h.textContent
        );
        expect(steps).toEqual([
            "Who gets it",
            "What and how much",
            "When it can be claimed",
            "Summary",
            "How it works"
        ]);
        expect(summary(view)).not.toBeNull();
        expect(document.querySelector("[role=dialog]")).toBeNull();
    });

    it("says what will happen in the summary as the form is filled in, with how far away the date is", async () => {
        const view = render(
            <TimedTransferForm
                creator={creator}
                onCancel={() => {}}
                onDone={() => {}}
            />
        );
        // at the start: no amount and no recipient (dashes), and the date it begins with - a week from now
        expect(summary(view).textContent).toContain("You send-");
        expect(summary(view).textContent).toContain("To-");
        expect(summary(view).textContent).toMatch(/in [678] days/);
        await fill(view);
        fireEvent.change(
            view.container.querySelector(
                'input[inputmode="decimal"]'
            ) as HTMLInputElement,
            {
                target: {value: "2.5"}
            }
        );
        const text = summary(view).textContent || "";
        expect(text).toContain("2.50000 BTS");
        expect(text).toContain("bob");
        expect(text).toContain("1.2.200");
        // the date starts a week from now: said in words
        expect(text).toMatch(/in 7 days|in 6 days|in 8 days/);
    });

    it("says what is missing under the button that cannot be pressed yet, one thing at a time", async () => {
        const view = render(
            <TimedTransferForm
                creator={creator}
                onCancel={() => {}}
                onDone={() => {}}
            />
        );
        await waitFor(() => expect(mockGetBalances).toHaveBeenCalled());
        expect(summary(view).textContent).toContain("Choose who gets it.");
        fireEvent.change(view.getByPlaceholderText("Account name"), {
            target: {value: "bob"}
        });
        await waitFor(
            () =>
                expect(view.container.textContent).toContain("Found: 1.2.200"),
            {timeout: 2000}
        );
        expect(summary(view).textContent).toContain("Choose an asset.");
        fireEvent.click(view.getByText("Choose an asset"));
        await waitFor(() => view.getByText("BTS - 10.00000"));
        fireEvent.click(view.getByText("BTS - 10.00000"));
        expect(summary(view).textContent).toContain(
            "Enter an amount within your balance."
        );
        expect(buttonOf(view, "Create timed transfer").disabled).toBe(true);
    });

    it("fills the amount with a share of the balance: 50%, and Max is all of it", async () => {
        const view = render(
            <TimedTransferForm
                creator={creator}
                onCancel={() => {}}
                onDone={() => {}}
            />
        );
        await fill(view);
        const amount = view.container.querySelector(
            'input[inputmode="decimal"]'
        ) as HTMLInputElement;
        fireEvent.click(buttonOf(view, "50%"));
        expect(amount.value).toBe("5.00000");
        fireEvent.click(buttonOf(view, "Max"));
        expect(amount.value).toBe("10.00000");
        // all of it is a valid amount
        expect(summary(view).textContent).toContain("10.00000 BTS");
    });

    it("sets the date from the picks: 1 month is a month from now", async () => {
        const view = render(
            <TimedTransferForm
                creator={creator}
                onCancel={() => {}}
                onDone={() => {}}
            />
        );
        await waitFor(() => expect(mockGetBalances).toHaveBeenCalled());
        const release = view.container.querySelector(
            'input[type="datetime-local"]'
        ) as HTMLInputElement;
        const before = release.value;
        fireEvent.click(buttonOf(view, "1 month"));
        expect(release.value).not.toBe(before);
        const days =
            (new Date(release.value).getTime() - Date.now()) / 86400000;
        expect(days).toBeGreaterThan(28);
        expect(days).toBeLessThan(31);
        fireEvent.click(buttonOf(view, "1 year"));
        expect(
            (new Date(release.value).getTime() - Date.now()) / 86400000
        ).toBeGreaterThan(360);
    });

    it("cancels by the secondary button, and shows a failure of the transfer in the summary", async () => {
        const onCancel = jest.fn();
        mockCreate.mockRejectedValueOnce(new Error("node said no"));
        const view = render(
            <TimedTransferForm
                creator={creator}
                onCancel={onCancel}
                onDone={() => {}}
            />
        );
        await fill(view);
        fireEvent.click(buttonOf(view, "Max"));
        await waitFor(() =>
            expect(buttonOf(view, "Create timed transfer").disabled).toBe(false)
        );
        await act(async () => {
            fireEvent.click(buttonOf(view, "Create timed transfer"));
        });
        await waitFor(() =>
            expect(summary(view).textContent).toContain("node said no")
        );
        fireEvent.click(buttonOf(view, "Cancel"));
        expect(onCancel).toHaveBeenCalledTimes(1);
    });
});
