import * as React from "react";
import {render, act} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

// lightweight-charts draws on a canvas, which this jsdom has not got
const mockSetData = jest.fn();
jest.mock("lightweight-charts", () => ({
    __esModule: true,
    AreaSeries: {},
    LineSeries: {},
    ColorType: {Solid: "solid"},
    createChart: () => ({
        addSeries: () => ({setData: mockSetData, applyOptions: () => {}}),
        timeScale: () => ({fitContent: () => {}}),
        remove: () => {}
    })
}));

const mockGetBalances = jest.fn();
const mockGetAssets = jest.fn();
const mockGetHistory = jest.fn();
const mockGetBlockTimes = jest.fn();
const mockGetLocked = jest.fn();
jest.mock("../../actions/BalanceHistoryActions", () => ({
    __esModule: true,
    default: {
        getBalances: (...a: any[]) => mockGetBalances(...a),
        getAssets: (...a: any[]) => mockGetAssets(...a),
        getHistory: (...a: any[]) => mockGetHistory(...a),
        getHistoryPage: (...a: any[]) =>
            Promise.resolve(mockGetHistory(...a)).then(rows => ({
                rows,
                source: null
            })),
        getBlockTimes: (...a: any[]) => mockGetBlockTimes(...a),
        getLockedInOrders: (...a: any[]) => mockGetLocked(...a)
    },
    olderStart: () => null
}));

import BalanceHistoryChart from "../../components/Account/BalanceHistoryChart";

const ME = "1.2.10";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    jest.clearAllMocks();
    mockGetBalances.mockResolvedValue([
        {asset_id: "1.3.0", amount: "150000"},
        {asset_id: "1.3.121", amount: "5000"}
    ]);
    mockGetAssets.mockResolvedValue({
        "1.3.0": {id: "1.3.0", symbol: "BTS", precision: 5},
        "1.3.121": {id: "1.3.121", symbol: "USD", precision: 4}
    });
    mockGetHistory.mockResolvedValue([
        {
            id: "1.11.2",
            block_num: 20,
            op: [
                0,
                {
                    from: "1.2.99",
                    to: ME,
                    amount: {amount: "100000", asset_id: "1.3.0"},
                    fee: {amount: "0", asset_id: "1.3.0"}
                }
            ]
        },
        {
            id: "1.11.1",
            block_num: 10,
            op: [
                99,
                {
                    account: ME,
                    amount: {amount: "5", asset_id: "1.3.0"},
                    fee: {amount: "0", asset_id: "1.3.0"}
                }
            ]
        }
    ]);
    mockGetBlockTimes.mockResolvedValue({10: 1000, 20: 2000});
    mockGetLocked.mockResolvedValue({"1.3.0": "25000"});
});

const flush = async () => {
    for (let i = 0; i < 6; i++) {
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
        });
    }
};

describe("BalanceHistoryChart", () => {
    it("shows the balance now, draws the line, and says what it could not read", async () => {
        const {container} = render(<BalanceHistoryChart accountId={ME} />);
        await flush();
        const text = container.textContent || "";
        expect(text).toContain("Balance over time");
        expect(text).toContain("1.50000 BTS");
        // fewer than a full page came back: that is all there is
        expect(text).toContain("whole history (2 operations)");
        expect(text).toContain("1 operation(s) could not be read");
        // the wallet, what is in open orders and both together, as figures
        const figures = Array.from(
            container.querySelectorAll("button")
        ).map(b => (b.textContent || "").replace(/\s+/g, " ").trim());
        expect(figures).toEqual(
            expect.arrayContaining([
                "Wallet1.50000 BTS",
                "Open orders0.25000 BTS",
                "Total1.75000 BTS"
            ])
        );
        // two lines end where the chain says: the balance (1.5) and the whole
        // holding with what is locked in open orders (1.5 + 0.25)
        const lastValues = mockSetData.mock.calls
            .map(([points]) => points[points.length - 1])
            .filter(Boolean)
            .map(p => p.value);
        expect(lastValues.some(v => Math.abs(v - 1.5) < 1e-5)).toBe(true);
        expect(lastValues.some(v => Math.abs(v - 1.75) < 1e-5)).toBe(true);
        expect(mockGetHistory).toHaveBeenCalledWith(ME, null);
    });

    it("lets the user choose which lines are drawn, and keeps the choice", async () => {
        window.localStorage.removeItem("__graphene__balanceChartSeries");
        const {container} = render(<BalanceHistoryChart accountId={ME} />);
        await flush();
        const figure = (label: string) =>
            Array.from(container.querySelectorAll("button")).find(b =>
                (b.textContent || "").startsWith(label)
            ) as HTMLButtonElement;
        // wallet and total on, open orders off, to begin with
        expect(figure("Wallet").getAttribute("aria-pressed")).toBe("true");
        expect(figure("Open orders").getAttribute("aria-pressed")).toBe(
            "false"
        );
        await act(async () => {
            figure("Open orders").click();
        });
        expect(figure("Open orders").getAttribute("aria-pressed")).toBe("true");
        expect(
            JSON.parse(
                window.localStorage.getItem(
                    "__graphene__balanceChartSeries"
                ) as string
            ).orders
        ).toBe(true);
    });

    it("draws nothing for an account without balances", async () => {
        mockGetBalances.mockResolvedValue([]);
        const {container} = render(<BalanceHistoryChart accountId={ME} />);
        await flush();
        expect(container.textContent).toBe("");
        expect(mockGetHistory).not.toHaveBeenCalled();
    });
});
