import * as React from "react";
import {act, cleanup, fireEvent, render} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

jest.mock("branding", () => ({
    getDefaultMarket: () => "BTS_CNY",
    getMyMarketsBases: () => ["CNY", "BTC"],
    getMyMarketsQuotes: () => ["BTS", "USD"]
}));

// the account of the page: one that is looked up, or (state "missing") none
let mockAccount: any = {
    name: "me",
    account: {state: "ok", value: {id: "1.2.77"}}
};
jest.mock("../../components/Advanced/fields", () => ({
    useCurrentAccount: () => mockAccount,
    idOf: (lookup: any) => (lookup.state === "ok" ? lookup.value.id : null)
}));

const mockLoadHeld = jest.fn();
const mockReview = jest.fn();
jest.mock("../../lib/chain/strategyChain", () => ({
    loadHeldAssets: (...a: any[]) => mockLoadHeld(...a),
    reviewOrders: (...a: any[]) => mockReview(...a)
}));

const mockEnsureUnlocked = jest.fn();
const mockCancelUnlock = jest.fn();
const mockSendNow = jest.fn();
jest.mock("../../actions/AdvancedActions", () => ({
    __esModule: true,
    default: {
        ensureUnlocked: (...a: any[]) => mockEnsureUnlocked(...a),
        cancelUnlock: (...a: any[]) => mockCancelUnlock(...a),
        sendNow: (...a: any[]) => mockSendNow(...a)
    }
}));
jest.mock("../../design-system/Notification", () => ({
    Notification: {success: jest.fn(), error: jest.fn()}
}));

const mockLoadCandles = jest.fn();
const mockLoadLastPrice = jest.fn();
const mockLookupAsset = jest.fn();
jest.mock("../../lib/chain/marketCandles", () => ({
    loadCandles: (...a: any[]) => mockLoadCandles(...a),
    loadLastPrice: (...a: any[]) => mockLoadLastPrice(...a),
    lookupAsset: (...a: any[]) => mockLookupAsset(...a)
}));

import StrategiesPage from "../../components/Strategies/StrategiesPage";
import {KEY, readStrategies} from "../../lib/common/strategyStore";

const BTS = {id: "1.3.0", symbol: "BTS", precision: 5};
const CNY = {id: "1.3.113", symbol: "CNY", precision: 4};
const USD = {id: "1.3.121", symbol: "USD", precision: 4};

const HOUR = 3600 * 1000;

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    mockAccount = {name: "me", account: {state: "ok", value: {id: "1.2.77"}}};
    mockLoadHeld.mockReset();
    mockLoadHeld.mockResolvedValue([]);
    mockReview.mockReset();
    mockEnsureUnlocked.mockReset();
    mockEnsureUnlocked.mockResolvedValue(undefined);
    mockCancelUnlock.mockReset();
    mockSendNow.mockReset();
    mockSendNow.mockResolvedValue(undefined);
    window.localStorage.clear();
    mockLoadCandles.mockReset();
    mockLoadLastPrice.mockReset();
    mockLookupAsset.mockReset();
    mockLookupAsset.mockImplementation(
        async (symbol: string) =>
            (({BTS, CNY, USD} as any)[symbol.toUpperCase()] || null)
    );
    mockLoadLastPrice.mockResolvedValue(0.2);
    mockLoadCandles.mockResolvedValue([]);
});

const settle = () =>
    act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
    });

const card = (container: HTMLElement, title: string) =>
    Array.from(container.querySelectorAll("section")).find(
        e => e.querySelector("h3")?.textContent === title
    ) as HTMLElement;

const button = (root: HTMLElement, text: string) =>
    Array.from(root.querySelectorAll("button")).find(
        b => (b.textContent || "").trim() === text
    ) as HTMLButtonElement;

const input = (root: HTMLElement, label: string) =>
    root.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;

const type = async (el: HTMLInputElement, value: string) => {
    await act(async () => {
        fireEvent.change(el, {target: {value}});
    });
};

// the drop-down of a labelled field; chooses `symbol` in it (typing it into the search box when it is not in the list)
const pick = async (container: HTMLElement, label: string, symbol: string) => {
    const field = Array.from(container.querySelectorAll("span")).find(
        e => e.textContent === label
    )!.parentElement as HTMLElement;
    await act(async () => {
        fireEvent.click(
            field.querySelector('[aria-haspopup="listbox"]') as HTMLElement
        );
    });
    const options = () =>
        Array.from(
            document.querySelectorAll('[role="option"]')
        ) as HTMLElement[];
    let option = options().find(o => (o.textContent || "").trim() === symbol);
    if (!option) {
        const search = document.querySelector(
            '[role="listbox"] input'
        ) as HTMLInputElement;
        await act(async () => {
            fireEvent.change(search, {target: {value: symbol}});
        });
        option = options().find(
            o => (o.textContent || "").trim() === `Use ${symbol}`
        );
    }
    await act(async () => {
        fireEvent.click(option as HTMLElement);
    });
    await settle();
};
const choices = async (container: HTMLElement, label: string) => {
    const field = Array.from(container.querySelectorAll("span")).find(
        e => e.textContent === label
    )!.parentElement as HTMLElement;
    await act(async () => {
        fireEvent.click(
            field.querySelector('[aria-haspopup="listbox"]') as HTMLElement
        );
    });
    const names = Array.from(
        document.querySelectorAll('[role="option"]')
    ).map(o => (o.textContent || "").trim());
    await act(async () => {
        fireEvent.click(
            field.querySelector('[aria-haspopup="listbox"]') as HTMLElement
        );
    });
    return names;
};

const tab = (container: HTMLElement, name: string) =>
    Array.from(container.querySelectorAll('[role="tab"]')).find(
        b => (b.textContent || "").trim() === name
    ) as HTMLElement;

const open = async () => {
    const view = render(<StrategiesPage />);
    await settle();
    return view;
};
const openPage = open;

// candles that swing between 0.18 and 0.22 around 0.2, an hour each
const swing = (n: number, start = Date.now() - n * HOUR) =>
    Array.from({length: n}, (_v, i) =>
        i % 2 === 0
            ? {
                  t: start + i * HOUR,
                  open: 0.2,
                  high: 0.205,
                  low: 0.18,
                  close: 0.185
              }
            : {
                  t: start + i * HOUR,
                  open: 0.185,
                  high: 0.22,
                  low: 0.185,
                  close: 0.2
              }
    );

describe("the strategies page", () => {
    it("loads the default market when it opens and says its price", async () => {
        const {container} = await open();
        expect(mockLookupAsset).toHaveBeenCalledWith("BTS");
        expect(mockLookupAsset).toHaveBeenCalledWith("CNY");
        expect(mockLoadLastPrice).toHaveBeenCalledWith(BTS, CNY);
        expect(container.textContent).toContain("Price now: 0.2 CNY per BTS");
        // a grid 10% either side of the price is suggested
        const strategy = card(container, "Strategy");
        expect(input(strategy, "Lowest price").value).toBe("0.18");
        expect(input(strategy, "Highest price").value).toBe("0.22");
    });

    it("says so when an asset is not there, the assets are the same, or the market has no trades", async () => {
        const {container} = await open();
        await pick(container, "Asset to trade", "NOPE");
        expect(container.textContent).toContain("Asset not found: NOPE");
        await pick(container, "Asset to trade", "USD");
        await pick(container, "Priced in", "USD");
        expect(container.textContent).toContain("Choose two different assets");
        mockLoadLastPrice.mockResolvedValue(null);
        await pick(container, "Priced in", "CNY");
        expect(container.textContent).toContain(
            "No trades found in this market"
        );
    });

    describe("the asset drop-downs", () => {
        it("list the assets the account holds first, then those of the usual markets, each once", async () => {
            mockLoadHeld.mockResolvedValue([
                {id: "1.3.5589", symbol: "XBTSX.USDT", precision: 6},
                {id: "1.3.0", symbol: "BTS", precision: 5}
            ]);
            const {container} = await open();
            expect(mockLoadHeld).toHaveBeenCalledWith("1.2.77");
            expect(await choices(container, "Priced in")).toEqual([
                // (the one chosen is in the list as well)
                "CNY",
                "XBTSX.USDT",
                "BTS",
                "BTC",
                "USD"
            ]);
        });

        it("load the market when an asset is chosen, with a grid made for its price", async () => {
            mockLoadLastPrice.mockResolvedValue(2);
            const {container} = await open();
            mockLookupAsset.mockClear();
            await pick(container, "Priced in", "USD");
            expect(mockLookupAsset).toHaveBeenCalledWith("BTS");
            expect(mockLookupAsset).toHaveBeenCalledWith("USD");
            expect(container.textContent).toContain("Price now: 2 USD per BTS");
            expect(
                input(card(container, "Strategy"), "Lowest price").value
            ).toBe("1.8");
        });

        it("offer a symbol that is typed and not in the list", async () => {
            mockLookupAsset.mockImplementation(async (symbol: string) => ({
                id: "1.3.9",
                symbol: symbol.toUpperCase(),
                precision: 4
            }));
            const {container} = await open();
            await pick(container, "Priced in", "HONEST.MONEY");
            expect(mockLookupAsset).toHaveBeenCalledWith("HONEST.MONEY");
        });

        it("are only the usual ones when the account holds nothing or cannot be read", async () => {
            mockLoadHeld.mockRejectedValue(new Error("node down"));
            const {container} = await open();
            expect(await choices(container, "Asset to trade")).toEqual([
                "BTS",
                "CNY",
                "BTC",
                "USD"
            ]);
        });
    });

    describe("the calculation", () => {
        it("works out a grid: the steps, the orders, what a round earns, and the fees alone", async () => {
            const {container} = await open();
            const calc = card(container, "What it would earn");
            expect(calc.textContent).toContain("9 steps of");
            expect(calc.textContent).toContain("5 buy orders under the price");
            expect(calc.textContent).toContain(
                "If every step is bought and sold once"
            );
            // fees of 0.1%: both ways about 0.2% of a step
            expect(calc.textContent).toContain("the fees alone take 0.20%");
            expect(calc.textContent).not.toContain("are smaller than the fees");
        });

        it("warns of steps smaller than the fees", async () => {
            const {container} = await open();
            const strategy = card(container, "Strategy");
            await type(input(strategy, "Lowest price"), "0.199");
            await type(input(strategy, "Highest price"), "0.201");
            expect(card(container, "What it would earn").textContent).toContain(
                "9 steps are smaller than the fees"
            );
        });

        it("says what is wrong with a field, and calculates nothing then", async () => {
            const {container} = await open();
            const strategy = card(container, "Strategy");
            await type(input(strategy, "Highest price"), "0.1");
            expect(strategy.textContent).toContain(
                "The highest price must be over the lowest"
            );
            const calc = card(container, "What it would earn");
            expect(calc.textContent).toContain(
                "The highest price must be over"
            );
            expect(calc.textContent).not.toContain(
                "buy orders under the price"
            );
            expect(
                button(card(container, "Test on past prices"), "Run test")
                    .disabled
            ).toBe(true);
            expect(
                button(card(container, "Save the strategy"), "Save strategy")
                    .disabled
            ).toBe(true);
        });

        it("works out a market maker's round trip and a day, from the estimate typed", async () => {
            const {container} = await open();
            await act(async () => {
                fireEvent.click(tab(container, "Market maker"));
            });
            const calc = card(container, "What it would earn");
            // spread 2%, fees 0.1% each way: a bid and an ask both filled earn about 1.8%
            expect(calc.textContent).toContain("A bid and an ask both filled");
            expect(calc.textContent).toContain("A spread under 0.20%");
            await type(input(calc, "Round trips a day (your estimate)"), "10");
            expect(calc.textContent).toMatch(
                /CNY a day: [\d.]+% of the funds a day/
            );
        });

        it("works out a dollar-cost average", async () => {
            const {container} = await open();
            await act(async () => {
                fireEvent.click(tab(container, "Dollar-cost average"));
            });
            const calc = card(container, "What it would earn");
            expect(calc.textContent).toContain("30 buys: 1,500 CNY spent");
            expect(calc.textContent).toContain(
                "the price has to end 0.20% over the average cost"
            );
            await type(input(calc, "Number of buys"), "10");
            expect(calc.textContent).toContain("10 buys: 500 CNY spent");
        });
    });

    describe("the test on past prices", () => {
        it("runs the strategy over the candles of the period chosen and shows the result", async () => {
            mockLoadCandles.mockResolvedValue(swing(48));
            const {container} = await open();
            const test = card(container, "Test on past prices");
            await act(async () => {
                fireEvent.click(button(test, "Run test"));
            });
            await settle();
            // 7 days of hourly candles by default
            const [
                trade,
                priced,
                seconds,
                from,
                to
            ] = mockLoadCandles.mock.calls[0];
            expect(trade).toEqual(BTS);
            expect(priced).toEqual(CNY);
            expect(seconds).toBe(3600);
            expect(to - from).toBeCloseTo(7 * 24 * HOUR, -4);
            expect(test.textContent).toContain("48 candles");
            expect(test.textContent).toContain("Pairs completed");
            expect(test.textContent).toContain("Earned by the pairs");
            expect(test.textContent).toContain("Holding instead");
            expect(test.querySelector("svg")).not.toBeNull();
            expect(test.textContent).toContain("Latest trades");
            expect(test.textContent).toMatch(/Bought [\d.]+ BTS at/);
            expect(test.textContent).toMatch(/Sold [\d.]+ BTS at/);
        });

        it("asks for the period that is chosen: a day is five-minute candles", async () => {
            mockLoadCandles.mockResolvedValue(swing(10));
            const {container} = await open();
            const test = card(container, "Test on past prices");
            await act(async () => {
                fireEvent.click(tab(test, "Last day"));
            });
            await act(async () => {
                fireEvent.click(button(test, "Run test"));
            });
            await settle();
            expect(mockLoadCandles.mock.calls[0][2]).toBe(300);
        });

        it("reads the prices once for the same market and period, while they are fresh", async () => {
            mockLoadCandles.mockResolvedValue(swing(10));
            const {container} = await open();
            const test = card(container, "Test on past prices");
            await act(async () => {
                fireEvent.click(button(test, "Run test"));
            });
            await settle();
            await type(input(card(container, "Strategy"), "Lines"), "6");
            await act(async () => {
                fireEvent.click(button(test, "Run test"));
            });
            await settle();
            expect(mockLoadCandles).toHaveBeenCalledTimes(1);
        });

        it("says when the market had no candles, when no order was reached, and when the prices cannot be read", async () => {
            const {container} = await open();
            const test = card(container, "Test on past prices");
            await act(async () => {
                fireEvent.click(button(test, "Run test"));
            });
            await settle();
            expect(test.textContent).toContain(
                "The market had no trades in that time."
            );
            mockLoadCandles.mockResolvedValue([
                {
                    t: Date.now() - HOUR,
                    open: 0.2,
                    high: 0.2,
                    low: 0.2,
                    close: 0.2
                }
            ]);
            await act(async () => {
                fireEvent.click(tab(test, "Last 30 days"));
            });
            await act(async () => {
                fireEvent.click(button(test, "Run test"));
            });
            await settle();
            expect(test.textContent).toContain("nothing was filled");
            mockLoadCandles.mockRejectedValue(new Error("node down"));
            await act(async () => {
                fireEvent.click(tab(test, "Last day"));
            });
            await act(async () => {
                fireEvent.click(button(test, "Run test"));
            });
            await settle();
            expect(test.textContent).toContain("node down");
        });
    });

    describe("real orders", () => {
        const placeCard = (container: HTMLElement) =>
            card(container, "Place real orders");
        const reviewButton = (container: HTMLElement) =>
            button(placeCard(container), "Review the orders");
        const runTest = async (container: HTMLElement) => {
            await act(async () => {
                fireEvent.click(
                    button(card(container, "Test on past prices"), "Run test")
                );
            });
            await settle();
        };
        // candles that go down to the grid's low and up to its high again, for a few rounds: pairs complete
        const profitable = () => mockLoadCandles.mockResolvedValue(swing(48));
        // a market that only falls: the grid buys all the way down and ends under water
        const falling = () =>
            mockLoadCandles.mockResolvedValue(
                Array.from({length: 24}, (_v, i) => {
                    const open = 0.2 * (1 - i * 0.03);
                    return {
                        t: Date.now() - (24 - i) * HOUR,
                        open,
                        high: open,
                        low: open * 0.97,
                        close: open * 0.97
                    };
                })
            );
        const order = (side: "buy" | "sell") =>
            side === "sell"
                ? {
                      side,
                      price: 0.22,
                      sell: {asset: BTS.id, amount: BigInt(100000)},
                      receive: {asset: CNY.id, amount: BigInt(2200)}
                  }
                : {
                      side,
                      price: 0.18,
                      sell: {asset: CNY.id, amount: BigInt(1800)},
                      receive: {asset: BTS.id, amount: BigInt(100000)}
                  };
        const reviewOk = (over: any = {}) => ({
            ok: true,
            review: {
                plan: {
                    orders: [order("sell"), order("buy")],
                    skipped: [],
                    spends: {trade: BigInt(100000), priced: BigInt(1800)}
                },
                operations: [
                    ["limit_order_create", {seller: "1.2.77", n: 1}],
                    ["limit_order_create", {seller: "1.2.77", n: 2}]
                ],
                fee: BigInt(96520),
                shortOfCore: false,
                price: 0.2,
                expiration: new Date(Date.UTC(2026, 11, 4, 10)),
                ...over
            }
        });
        const dialogButton = (text: string) =>
            Array.from(document.querySelectorAll("button")).find(
                b => (b.textContent || "").trim() === text
            ) as HTMLButtonElement;
        const open = async () => {
            profitable();
            const view = await openPage();
            await runTest(view.container);
            return view;
        };

        it("wants a test first, and then a test that ended in a profit", async () => {
            const {container} = await openPage();
            expect(placeCard(container).textContent).toContain(
                "Run a test on past prices first"
            );
            expect(reviewButton(container).disabled).toBe(true);
            falling();
            await runTest(container);
            expect(placeCard(container).textContent).toContain(
                "did not end in a profit"
            );
            expect(reviewButton(container).disabled).toBe(true);
            // the same settings on a market that went round and round (another period: the prices read are kept for the same one)
            profitable();
            await act(async () => {
                fireEvent.click(
                    tab(card(container, "Test on past prices"), "Last 30 days")
                );
            });
            await runTest(container);
            expect(placeCard(container).textContent).toContain(
                "The test earned"
            );
            expect(reviewButton(container).disabled).toBe(false);
        });

        it("says when the settings changed since the test, and lets the next test open it again", async () => {
            const {container} = await open();
            expect(reviewButton(container).disabled).toBe(false);
            await type(input(card(container, "Strategy"), "Lines"), "8");
            expect(placeCard(container).textContent).toContain(
                "The settings changed since the test"
            );
            expect(reviewButton(container).disabled).toBe(true);
            await runTest(container);
            expect(reviewButton(container).disabled).toBe(false);
        });

        it("is shut when another market is chosen", async () => {
            const {container} = await open();
            await pick(container, "Priced in", "USD");
            expect(placeCard(container).textContent).toContain(
                "Run a test on past prices first"
            );
            expect(reviewButton(container).disabled).toBe(true);
        });

        it("wants an account", async () => {
            mockAccount = {name: null, account: {state: "missing"}};
            const {container} = await open();
            expect(placeCard(container).textContent).toContain(
                "Choose or log in to an account"
            );
            expect(reviewButton(container).disabled).toBe(true);
        });

        it("wants no more lines than one placement holds", async () => {
            const {container} = await open();
            await type(input(card(container, "Strategy"), "Lines"), "60");
            await runTest(container);
            expect(placeCard(container).textContent).toContain(
                "at most 50 orders"
            );
            expect(reviewButton(container).disabled).toBe(true);
        });

        it("shows every order, what is put into them, the fee and the warning, and signs nothing until Sign and send", async () => {
            mockReview.mockResolvedValue(reviewOk());
            const {container} = await open();
            await act(async () => {
                fireEvent.click(reviewButton(container));
            });
            await settle();
            // it was made from the price of now and the account's id
            expect(mockLoadLastPrice).toHaveBeenLastCalledWith(BTS, CNY);
            const args = mockReview.mock.calls[0][0];
            expect(args.accountId).toBe("1.2.77");
            expect(args.price).toBe(0.2);
            expect(args.trade).toEqual(BTS);
            const dialog = document.body.textContent as string;
            expect(dialog).toContain("Place the orders");
            expect(dialog).toContain("me places 2 orders in BTS / CNY");
            expect(dialog).toContain(
                "Sell 1 BTS for at least 0.22 CNY (price 0.22 or better)"
            );
            expect(dialog).toContain(
                "Buy 1 BTS, paying at most 0.18 CNY (price 0.18 or better)"
            );
            expect(dialog).toContain("Network fee: 0.9652 BTS for 2 orders");
            expect(dialog).toContain("placed once");
            expect(mockSendNow).not.toHaveBeenCalled();
            expect(mockEnsureUnlocked).not.toHaveBeenCalled();
        });

        it("unlocks, then sends the operations as they were shown, and says so", async () => {
            const result = reviewOk();
            mockReview.mockResolvedValue(result);
            const {container} = await open();
            await act(async () => {
                fireEvent.click(reviewButton(container));
            });
            await settle();
            await act(async () => {
                fireEvent.click(dialogButton("Sign and send"));
            });
            await settle();
            expect(mockEnsureUnlocked).toHaveBeenCalledWith("me");
            expect(mockSendNow).toHaveBeenCalledTimes(1);
            expect(mockSendNow.mock.calls[0][0]).toBe(result.review.operations);
            // (unlock first, then the send)
            expect(mockEnsureUnlocked.mock.invocationCallOrder[0]).toBeLessThan(
                mockSendNow.mock.invocationCallOrder[0]
            );
            expect(placeCard(container).textContent).toContain("Sent 2 orders");
            expect(document.body.textContent).not.toContain("Place the orders");
        });

        it("does not say the orders were sent when the send failed, and keeps the dialog open to try again", async () => {
            mockReview.mockResolvedValue(reviewOk());
            mockSendNow.mockRejectedValue(
                new Error("Assert Exception: balance")
            );
            const {container} = await open();
            await act(async () => {
                fireEvent.click(reviewButton(container));
            });
            await settle();
            await act(async () => {
                fireEvent.click(dialogButton("Sign and send"));
            });
            await settle();
            expect(document.body.textContent).toContain("Place the orders");
            expect(document.body.textContent).toContain("balance");
            expect(placeCard(container).textContent).not.toContain("Sent 2");
        });

        it("sends nothing when the unlock is refused", async () => {
            mockReview.mockResolvedValue(reviewOk());
            mockEnsureUnlocked.mockRejectedValue(new Error("cancelled"));
            const {container} = await open();
            await act(async () => {
                fireEvent.click(reviewButton(container));
            });
            await settle();
            await act(async () => {
                fireEvent.click(dialogButton("Sign and send"));
            });
            await settle();
            expect(mockSendNow).not.toHaveBeenCalled();
            expect(placeCard(container).textContent).not.toContain("Sent 2");
        });

        it("closes the password prompt, and sends nothing, when the dialog is closed while it asks", async () => {
            mockReview.mockResolvedValue(reviewOk());
            let unlock: () => void = () => undefined;
            mockEnsureUnlocked.mockImplementation(
                () => new Promise<void>(resolve => (unlock = resolve))
            );
            const {container} = await open();
            await act(async () => {
                fireEvent.click(reviewButton(container));
            });
            await settle();
            await act(async () => {
                fireEvent.click(dialogButton("Sign and send"));
            });
            // the dialog is closed (Cancel is disabled while it signs: the page leaves)
            await act(async () => {
                fireEvent.click(tab(container, "Market maker"));
            });
            cleanup();
            expect(mockCancelUnlock).toHaveBeenCalled();
            await act(async () => {
                unlock();
                await new Promise(resolve => setTimeout(resolve, 20));
            });
            expect(mockSendNow).not.toHaveBeenCalled();
        });

        it("will not sign when the account cannot pay the network fee", async () => {
            mockReview.mockResolvedValue(reviewOk({shortOfCore: true}));
            const {container} = await open();
            await act(async () => {
                fireEvent.click(reviewButton(container));
            });
            await settle();
            expect(document.body.textContent).toContain(
                "does not hold enough BTS for the network fee"
            );
            expect(dialogButton("Sign and send").disabled).toBe(true);
        });

        it("says what was left out for want of funds", async () => {
            mockReview.mockResolvedValue(
                reviewOk({
                    plan: {
                        orders: [order("buy")],
                        skipped: [
                            {side: "sell", price: 0.22, reason: "funds"},
                            {side: "sell", price: 0.24, reason: "funds"},
                            {side: "buy", price: 0.1, reason: "tiny"}
                        ],
                        spends: {trade: BigInt(0), priced: BigInt(1800)}
                    }
                })
            );
            const {container} = await open();
            await act(async () => {
                fireEvent.click(reviewButton(container));
            });
            await settle();
            expect(document.body.textContent).toContain(
                "2 orders are left out for lack of funds"
            );
            expect(document.body.textContent).toContain(
                "1 orders are left out: they come to less than one unit"
            );
        });

        it("says why nothing can be placed, and opens no dialog", async () => {
            mockReview.mockResolvedValue({ok: false, error: "no_orders"});
            const {container} = await open();
            await act(async () => {
                fireEvent.click(reviewButton(container));
            });
            await settle();
            expect(placeCard(container).textContent).toContain(
                "does not hold enough BTS and CNY"
            );
            expect(document.body.textContent).not.toContain("Place the orders");
            mockReview.mockRejectedValue(new Error("node down"));
            await act(async () => {
                fireEvent.click(reviewButton(container));
            });
            await settle();
            expect(placeCard(container).textContent).toContain(
                "Could not read from the chain: node down"
            );
            mockLoadLastPrice.mockResolvedValue(null);
            await act(async () => {
                fireEvent.click(reviewButton(container));
            });
            await settle();
            expect(placeCard(container).textContent).toContain(
                "The price of the market could not be read"
            );
        });
    });

    describe("saved strategies", () => {
        const saveOne = async (container: HTMLElement) => {
            const save = card(container, "Save the strategy");
            await type(input(save, "Name (optional)"), "My grid");
            await act(async () => {
                fireEvent.click(button(save, "Save strategy"));
            });
        };

        it("keeps a strategy in this browser and lists it, not started", async () => {
            const {container} = await open();
            await saveOne(container);
            expect(container.textContent).toContain(
                "Saved. Start it under My strategies."
            );
            const kept = readStrategies();
            expect(kept).toHaveLength(1);
            expect(kept[0].name).toBe("My grid");
            expect(kept[0].trade).toEqual(BTS);
            expect(kept[0].spec.kind).toBe("grid");
            const row = container.querySelector(
                "[data-strategy]"
            ) as HTMLElement;
            expect(row.textContent).toContain("My grid");
            expect(row.textContent).toContain("Grid · BTS/CNY");
            expect(row.textContent).toContain("Not started");
            // it is there after the page is opened again
            const again = await open();
            expect(again.container.textContent).toContain("My grid");
        });

        it("names a strategy that has no name from its market and kind", async () => {
            const {container} = await open();
            await act(async () => {
                fireEvent.click(
                    button(
                        card(container, "Save the strategy"),
                        "Save strategy"
                    )
                );
            });
            expect(readStrategies()[0].name).toBe("BTS/CNY Grid");
        });

        it("starts it on paper at the price of now, and stops it", async () => {
            const {container} = await open();
            await saveOne(container);
            mockLoadLastPrice.mockResolvedValue(0.2);
            const row = () =>
                container.querySelector("[data-strategy]") as HTMLElement;
            await act(async () => {
                fireEvent.click(button(row(), "Start on paper"));
            });
            await settle();
            expect(row().textContent).toContain("Running on paper since");
            expect(button(row(), "Stop")).toBeTruthy();
            expect(readStrategies()[0].run!.running).toBe(true);
            expect(readStrategies()[0].run!.state.start).toBe(0.2);
            await act(async () => {
                fireEvent.click(button(row(), "Stop"));
            });
            expect(row().textContent).toContain("Stopped");
            expect(readStrategies()[0].run!.running).toBe(false);
            expect(button(row(), "Start again")).toBeTruthy();
        });

        it("says so when it cannot start for want of a price", async () => {
            const {container} = await open();
            await saveOne(container);
            mockLoadLastPrice.mockResolvedValue(null);
            const row = container.querySelector(
                "[data-strategy]"
            ) as HTMLElement;
            await act(async () => {
                fireEvent.click(button(row, "Start on paper"));
            });
            await settle();
            expect(row.textContent).toContain("No trades found in this market");
            expect(readStrategies()[0].run).toBeUndefined();
        });

        it("edits a strategy back into the form, and deletes it", async () => {
            const {container} = await open();
            const strategy = card(container, "Strategy");
            await type(input(strategy, "Lines"), "7");
            await saveOne(container);
            await type(input(strategy, "Lines"), "12");
            const row = () =>
                container.querySelector("[data-strategy]") as HTMLElement;
            await act(async () => {
                fireEvent.click(button(row(), "Edit"));
            });
            await settle();
            expect(input(strategy, "Lines").value).toBe("7");
            await act(async () => {
                fireEvent.click(button(row(), "Delete"));
            });
            expect(container.querySelector("[data-strategy]")).toBeNull();
            expect(container.textContent).toContain("No strategy saved yet.");
            expect(readStrategies()).toEqual([]);
        });

        it("stops at the limit and says so", async () => {
            const {container} = await open();
            for (let i = 0; i < 21; i++) await saveOne(container);
            expect(readStrategies()).toHaveLength(20);
            expect(container.textContent).toContain(
                "You can keep 20 strategies"
            );
        });
    });

    describe("a paper run", () => {
        // a strategy that was started in the past, kept as it was
        const kept = async (startedAgo: number) => {
            const {container, unmount} = await open();
            await act(async () => {
                fireEvent.click(
                    button(
                        card(container, "Save the strategy"),
                        "Save strategy"
                    )
                );
            });
            await act(async () => {
                fireEvent.click(
                    button(
                        container.querySelector(
                            "[data-strategy]"
                        ) as HTMLElement,
                        "Start on paper"
                    )
                );
            });
            await settle();
            unmount();
            const raw = JSON.parse(window.localStorage.getItem(KEY) as string);
            const t0 = Date.now() - startedAgo;
            raw[0].run.startedAt = t0;
            raw[0].run.lastT = Math.floor(t0 / 300000) * 300000;
            window.localStorage.setItem(KEY, JSON.stringify(raw));
            return raw[0].run.lastT as number;
        };

        it("goes on where it was when the page opens: the candles that closed meanwhile are processed", async () => {
            const lastT = await kept(3 * HOUR);
            mockLoadCandles.mockImplementation(
                async (_t: any, _p: any, _s: number, from: number) => {
                    // 5-minute candles swinging through the grid, after the one it began in
                    return Array.from({length: 20}, (_v, i) => ({
                        t: lastT + (i + 1) * 300000,
                        open: i % 2 ? 0.185 : 0.2,
                        high: i % 2 ? 0.21 : 0.2,
                        low: i % 2 ? 0.185 : 0.18,
                        close: i % 2 ? 0.2 : 0.185
                    })).filter(c => c.t >= from);
                }
            );
            const {container} = await open();
            await settle();
            expect(mockLoadCandles).toHaveBeenCalled();
            // it asked from where it had got to, in 5-minute candles
            expect(mockLoadCandles.mock.calls[0][2]).toBe(300);
            expect(mockLoadCandles.mock.calls[0][3]).toBe(lastT + 1);
            const run = readStrategies()[0].run!;
            expect(run.events.length).toBeGreaterThan(0);
            expect(run.lastT).toBeGreaterThan(lastT);
            const row = container.querySelector(
                "[data-strategy]"
            ) as HTMLElement;
            expect(row.textContent).toContain("Running on paper since");
            expect(row.textContent).toContain("Fills");
            expect(row.textContent).toMatch(/Bought [\d.]+ BTS at/);
        });

        it("says when it could not read the prices, and keeps running", async () => {
            await kept(HOUR);
            mockLoadCandles.mockRejectedValue(new Error("no node"));
            const {container} = await open();
            const row = container.querySelector(
                "[data-strategy]"
            ) as HTMLElement;
            expect(row.textContent).toContain(
                "Could not read the prices: no node"
            );
            expect(readStrategies()[0].run!.running).toBe(true);
        });

        it("stops a run that was not moved for over 30 days, and does not ask for 30 days of candles", async () => {
            await kept(31 * 24 * HOUR);
            const {container} = await open();
            const row = container.querySelector(
                "[data-strategy]"
            ) as HTMLElement;
            expect(row.textContent).toContain("Not run for over 30 days");
            expect(readStrategies()[0].run!.running).toBe(false);
            expect(mockLoadCandles).not.toHaveBeenCalled();
        });

        it("does not read prices for a run that is stopped", async () => {
            await kept(HOUR);
            const raw = JSON.parse(window.localStorage.getItem(KEY) as string);
            raw[0].run.running = false;
            window.localStorage.setItem(KEY, JSON.stringify(raw));
            await open();
            expect(mockLoadCandles).not.toHaveBeenCalled();
        });
    });
});
