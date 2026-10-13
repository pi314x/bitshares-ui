import * as React from "react";
import {render, act} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

// lightweight-charts draws on a canvas, which this jsdom has not got
const mockSetData = jest.fn();
jest.mock("lightweight-charts", () => ({
    __esModule: true,
    AreaSeries: {},
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
jest.mock("../../actions/BalanceHistoryActions", () => ({
    __esModule: true,
    default: {
        getBalances: (...a: any[]) => mockGetBalances(...a),
        getAssets: (...a: any[]) => mockGetAssets(...a),
        getHistory: (...a: any[]) => mockGetHistory(...a),
        getBlockTimes: (...a: any[]) => mockGetBlockTimes(...a)
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
        expect(text).toContain("Built from the last 2 operations");
        expect(text).toContain("1 operation(s) could not be read");
        // the series ends at the real balance
        const points =
            mockSetData.mock.calls[mockSetData.mock.calls.length - 1][0];
        expect(points[points.length - 1].value).toBeCloseTo(1.5, 5);
        expect(mockGetHistory).toHaveBeenCalledWith(ME, null);
    });

    it("draws nothing for an account without balances", async () => {
        mockGetBalances.mockResolvedValue([]);
        const {container} = render(<BalanceHistoryChart accountId={ME} />);
        await flush();
        expect(container.textContent).toBe("");
        expect(mockGetHistory).not.toHaveBeenCalled();
    });
});
