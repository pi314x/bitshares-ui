import * as React from "react";
import {render, act, fireEvent} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

// lightweight-charts draws on a canvas, which this jsdom has not got
const mockSetData = jest.fn();
const mockSetLogical = jest.fn();
const mockChartOptions: any[] = [];
const mockSeriesOptions: any[] = [];
jest.mock("lightweight-charts", () => ({
    __esModule: true,
    AreaSeries: {},
    LineSeries: {},
    LineType: {Simple: 0, WithSteps: 1, Curved: 2},
    ColorType: {Solid: "solid"},
    createChart: (_host: any, options: any) => {
        mockChartOptions.push(options);
        // the view as the chart reports it: bars 0 and 1 (times 1000 and 2000)
        const timeScale = {
            fitContent: () => {},
            getVisibleRange: () => ({from: 1000, to: 2000}),
            timeToIndex: (time: number) => (time <= 1000 ? 0 : 1),
            setVisibleLogicalRange: (range: any) => mockSetLogical(range)
        };
        return {
            addSeries: (_type: any, options: any) => {
                mockSeriesOptions.push(options);
                return {setData: mockSetData, applyOptions: () => {}};
            },
            timeScale: () => timeScale,
            remove: () => {}
        };
    }
}));

const mockGetBalances = jest.fn();
const mockGetAssets = jest.fn();
const mockGetHistory = jest.fn();
const mockGetBlockTimes = jest.fn();
const mockGetLocked = jest.fn();
jest.mock("../../actions/BalanceHistoryActions", () => ({
    __esModule: true,
    default: {
        chainKey: () => "test",
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
    }
}));

import BalanceHistoryChart from "../../components/Account/BalanceHistoryChart";
import {balanceHistory} from "../../lib/chain/balanceHistoryLoader";
import {bumpAccountEpoch} from "../../lib/common/accountEpoch";

const ME = "1.2.10";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(async () => {
    jest.clearAllMocks();
    mockChartOptions.length = 0;
    mockSeriesOptions.length = 0;
    // the history store outlives a screen: each test starts with an empty one
    await balanceHistory.reset();
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
    it("keeps the value axis from going under zero, on every line, with no margin of its own that would", async () => {
        render(<BalanceHistoryChart accountId={ME} />);
        await flush();
        expect(mockChartOptions[0].rightPriceScale.scaleMargins).toEqual({
            top: 0,
            bottom: 0
        });
        // wallet, open orders, total
        expect(mockSeriesOptions).toHaveLength(3);
        mockSeriesOptions.forEach(options => {
            const range = options.autoscaleInfoProvider(() => ({
                priceRange: {minValue: -3, maxValue: 10}
            }));
            expect(range.priceRange.minValue).toBe(0);
            expect(range.priceRange.maxValue).toBeGreaterThan(10);
            // (nothing drawn yet: nothing to range)
            expect(options.autoscaleInfoProvider(() => null)).toBeNull();
        });
    });

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

    // The line is worked out backwards from the balance now through the account's operations: a deposit that is in
    // the balance but not in the operations lifted the whole line by its amount, until the screen was opened again.
    it("draws a deposit where it happened: the operations are read again with the balance", async () => {
        render(<BalanceHistoryChart accountId={ME} />);
        await flush();
        const deposit = {
            id: "1.11.3",
            block_num: 30,
            op: [
                0,
                {
                    from: "1.2.77",
                    to: ME,
                    amount: {amount: "100000", asset_id: "1.3.0"},
                    fee: {amount: "0", asset_id: "1.3.0"}
                }
            ]
        };
        const older = await mockGetHistory();
        mockGetBalances.mockResolvedValue([
            {asset_id: "1.3.0", amount: "250000"},
            {asset_id: "1.3.121", amount: "5000"}
        ]);
        mockGetHistory.mockResolvedValue([deposit, ...older]);
        mockGetBlockTimes.mockResolvedValue({10: 1000, 20: 2000, 30: 3000});
        mockSetData.mockClear();
        act(() => bumpAccountEpoch("activity"));
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 600));
        });
        // the last draw: wallet, open orders, total
        const wallet = mockSetData.mock.calls.slice(-3)[0][0];
        const at = (time: number) =>
            wallet.find((p: {time: number}) => p.time === time);
        expect(at(2000).value).toBeCloseTo(1.5, 5); // before the deposit
        expect(at(3000).value).toBeCloseTo(2.5, 5); // with it
        expect(wallet[wallet.length - 1].value).toBeCloseTo(2.5, 5);
    });

    it("does not ask for the operations again when the account only had a look (no operation behind it)", async () => {
        render(<BalanceHistoryChart accountId={ME} />);
        await flush();
        mockGetHistory.mockClear();
        mockGetBalances.mockClear();
        act(() => bumpAccountEpoch("interval"));
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 600));
        });
        expect(mockGetBalances).toHaveBeenCalled();
        expect(mockGetHistory).not.toHaveBeenCalled();
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

    it("moves the view to a new period in steps, from where it is to where it ends", async () => {
        window.localStorage.removeItem("__graphene__balanceChartRange");
        // one operation a few days ago, one a minute ago
        const now = Math.floor(Date.now() / 1000);
        mockGetBlockTimes.mockResolvedValue({10: now - 200000, 20: now - 60});
        const {container} = render(<BalanceHistoryChart accountId={ME} />);
        await flush();
        const bars = mockSetData.mock.calls.slice(-1)[0][0].length;
        // the history arriving after the first point is a widening of its own:
        // let that settle before looking at the move to a new period
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 800));
        });
        expect(mockSetLogical).toHaveBeenCalled();
        mockSetLogical.mockClear();

        const day = Array.from(container.querySelectorAll("button")).find(
            b => (b.textContent || "").trim() === "1D"
        ) as HTMLButtonElement;
        await act(async () => {
            day.click();
        });
        // (the effect that moves the view runs once the click has rendered)
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 800));
        });
        const spans = mockSetLogical.mock.calls.map(([r]) => r);
        // starts where the view was (bars 0 and 1, half a bar either side) ...
        expect(spans[0]).toEqual({from: -0.5, to: 1.5});
        // ... gets there in more than one step ...
        expect(spans.length).toBeGreaterThan(3);
        // ... and ends on the bars of the day: the right edge on the last bar
        // (half a bar beyond), the left edge further in than where it began
        const end = spans[spans.length - 1];
        expect(end.to).toBeCloseTo(bars - 0.5, 6);
        expect(end.from).toBeGreaterThan(-0.5);
        // the right edge never goes back
        for (let i = 1; i < spans.length; i++) {
            expect(spans[i].to).toBeGreaterThanOrEqual(spans[i - 1].to - 1e-9);
        }
    });

    it("draws no line for an account without balances, and does not load its history", async () => {
        mockGetBalances.mockResolvedValue([]);
        const {container} = render(<BalanceHistoryChart accountId={ME} />);
        await flush();
        expect(container.textContent).toBe(
            "Balance over timeNo balances to chart yet."
        );
        expect(mockGetHistory).not.toHaveBeenCalled();
    });
});

describe("BalanceHistoryChart currency drop-down", () => {
    const optionNames = () =>
        Array.from(document.body.querySelectorAll('[role="option"]')).map(o =>
            (o.textContent || "").trim()
        );

    it("sits in the card's head, and narrows the assets while typing", async () => {
        const {container} = render(<BalanceHistoryChart accountId={ME} />);
        await flush();
        const head = container.querySelector("section > div") as HTMLElement;
        const trigger = head.querySelector(
            '[aria-haspopup="listbox"]'
        ) as HTMLElement;
        // beside the title, not down in the footer
        expect(trigger).not.toBeNull();
        expect(head.textContent).toContain("Balance over time");

        fireEvent.click(trigger);
        expect(optionNames()).toEqual(["BTS", "USD"]);

        const search = document.body.querySelector(
            '[role="listbox"] input'
        ) as HTMLInputElement;
        fireEvent.change(search, {target: {value: "us"}});
        expect(optionNames()).toEqual(["USD"]);

        fireEvent.change(search, {target: {value: "zzz"}});
        expect(optionNames()).toEqual([]);
        expect(document.body.textContent).toContain("No asset matches.");

        fireEvent.change(search, {target: {value: "us"}});
        fireEvent.click(
            document.body.querySelector('[role="option"]') as HTMLElement
        );
        await flush();
        expect(container.textContent).toContain("0.5000 USD");
    });

    it("is on the page while the balances load, and says so for an account with none", async () => {
        let answer: (rows: any[]) => void = () => {};
        mockGetBalances.mockReturnValue(
            new Promise<any[]>(resolve => {
                answer = resolve;
            })
        );
        const {container} = render(<BalanceHistoryChart accountId={ME} />);
        // not an empty place where the chart belongs
        expect(container.textContent).toContain("Balance over time");
        expect(container.textContent).toContain("Loading...");
        await act(async () => {
            answer([]);
        });
        await flush();
        expect(container.textContent).toContain("Balance over time");
        expect(container.textContent).toContain("No balances to chart yet.");
    });

    it("asks for the balances again when the first ask fails", async () => {
        jest.useFakeTimers();
        try {
            mockGetBalances.mockRejectedValueOnce(new Error("connection lost"));
            const {container} = render(<BalanceHistoryChart accountId={ME} />);
            await act(async () => {
                await Promise.resolve();
            });
            // no error shown yet: it is tried again first
            expect(container.textContent).not.toContain("connection lost");
            expect(mockGetBalances).toHaveBeenCalledTimes(1);
            await act(async () => {
                jest.advanceTimersByTime(3100);
                await Promise.resolve();
            });
            jest.useRealTimers();
            await flush();
            expect(mockGetBalances).toHaveBeenCalledTimes(2);
            expect(container.textContent).toContain("1.50000 BTS");
        } finally {
            jest.useRealTimers();
        }
    });
});
