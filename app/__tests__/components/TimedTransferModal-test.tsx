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

import TimedTransferModal from "../../components/Account/TimedTransferModal";

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

describe("TimedTransferModal", () => {
    it("stays disabled until recipient, asset, amount and release are valid, then sends the exact arguments", async () => {
        const onDone = jest.fn();
        const {container, getByPlaceholderText, getByText} = render(
            <TimedTransferModal
                visible
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
        await waitFor(() => getByText("BTS"));
        fireEvent.click(getByText("BTS"));

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
            <TimedTransferModal
                visible
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
            <TimedTransferModal
                visible
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
