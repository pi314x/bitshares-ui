import * as React from "react";
import {act, render} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

let mockState: any;
jest.mock("../../next/hooks/useBalanceHistory", () => ({
    useBalanceHistory: () => mockState
}));
jest.mock("bitsharesjs", () => ({
    ChainTypes: {
        operations: {
            transfer: 0,
            limit_order_create: 1,
            limit_order_cancel: 2,
            fill_order: 4,
            liquidity_pool_exchange: 63
        }
    }
}));
jest.mock("../../actions/SametFundActions", () => ({
    __esModule: true,
    default: {
        getAssets: (ids: string[]) =>
            Promise.resolve(
                ids.reduce((all: any, id) => {
                    all[id] = {
                        id,
                        symbol:
                            id === "1.3.5"
                                ? "USD"
                                : id === "1.3.6"
                                ? "EUR"
                                : "XYZ",
                        precision: 2
                    };
                    return all;
                }, {})
            )
    }
}));

import DayRecap from "../../components/Dashboard/Desk/DayRecap";
import {DAY_SECONDS} from "../../lib/common/dayRecap";

const ME = "1.2.10";
const NOW = Math.floor(Date.now() / 1000);
const entry = (n: number, block: number, code: number, op: any) => ({
    id: `1.11.${n}`,
    op: [code, op],
    block_num: block
});
const history = (over: any = {}) => ({
    entries: [],
    times: {},
    complete: false,
    capped: false,
    source: null,
    loading: false,
    cached: false,
    error: null,
    ...over
});
const settle = () =>
    act(async () => {
        await new Promise(resolve => setTimeout(resolve, 20));
    });

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

describe("the Last 24 hours card", () => {
    it("says nothing happened when the whole day is loaded and empty", async () => {
        mockState = history({complete: true});
        const {container} = render(<DayRecap accountId={ME} />);
        await settle();
        expect(container.textContent).toContain(
            "Nothing happened in the last 24 hours."
        );
    });

    it("sums up the day in a few lines, with the assets named", async () => {
        mockState = history({
            entries: [
                entry(5, 100, 4, {
                    account_id: ME,
                    order_id: "1.7.1",
                    pays: {amount: "1000", asset_id: "1.3.5"},
                    receives: {amount: "250000", asset_id: "1.3.0"}
                }),
                entry(4, 100, 0, {
                    from: "1.2.99",
                    to: ME,
                    amount: {amount: "5000", asset_id: "1.3.6"},
                    fee: {amount: "100", asset_id: "1.3.0"}
                }),
                entry(3, 99, 1, {
                    seller: ME,
                    fee: {amount: "20", asset_id: "1.3.0"}
                }),
                entry(2, 99, 2, {
                    fee_paying_account: ME,
                    order: "1.7.2",
                    fee: {amount: "0", asset_id: "1.3.0"}
                }),
                entry(1, 99, 63, {
                    account: ME,
                    pool: "1.19.1",
                    fee: {amount: "30", asset_id: "1.3.0"}
                })
            ],
            times: {
                100: NOW - 3600,
                99: NOW - 7200,
                90: NOW - DAY_SECONDS - 100
            },
            complete: true
        });
        const {container} = render(<DayRecap accountId={ME} />);
        await settle();
        const text = container.textContent || "";
        expect(text).toContain("Operations: 5");
        // what was gained and what was lost, with signs (the fill sold 10.00 USD for 2.50000 BTS, 50.00 EUR came in,
        // and the network fees of what the account started went out)
        expect(text).toContain("Tokens gained or lost:");
        expect(text).toContain("+50.00 EUR");
        expect(text).toContain("-10.00 USD");
        expect(text).toContain("Received: 1 transfers - 50.00 EUR");
        expect(text).toContain(
            "Order fills: 1 - sold 10.00 USD, got 2.50000 BTS"
        );
        expect(text).toContain("Orders: 1 placed, 1 cancelled");
        expect(text).toContain("Pools: 1 swaps, 0 liquidity changes");
        // the fees the account paid (the transfer it received cost it nothing)
        expect(text).toContain("Network fees paid: 0.00050 BTS");
        expect(text).not.toContain("Only the newest");
    });

    it("names at most three assets in a line and counts the rest", async () => {
        const transfer = (n: number, asset: string, amount: string) =>
            entry(n, 100, 0, {
                from: "1.2.99",
                to: ME,
                amount: {amount, asset_id: asset}
            });
        mockState = history({
            entries: [
                transfer(4, "1.3.7", "10"),
                transfer(3, "1.3.6", "20"),
                transfer(2, "1.3.5", "30"),
                transfer(1, "1.3.8", "40")
            ],
            times: {100: NOW - 60},
            complete: true
        });
        const {container} = render(<DayRecap accountId={ME} />);
        await settle();
        expect(container.textContent).toContain("and 1 more");
    });

    it("says the window may hold more when the history loaded does not reach back a day, and that it is still reading", async () => {
        mockState = history({
            entries: [
                entry(1, 100, 1, {
                    seller: ME,
                    fee: {amount: "20", asset_id: "1.3.0"}
                })
            ],
            times: {100: NOW - 60}
        });
        const view = render(<DayRecap accountId={ME} />);
        await settle();
        expect(view.container.textContent).toContain(
            "Only the newest 1 operations are loaded so far"
        );
        view.unmount();
        mockState = history({
            entries: [
                entry(1, 100, 1, {
                    seller: ME,
                    fee: {amount: "20", asset_id: "1.3.0"}
                })
            ],
            times: {100: NOW - 60},
            loading: true
        });
        const again = render(<DayRecap accountId={ME} />);
        await settle();
        expect(again.container.textContent).toContain(
            "Reading the older operations"
        );
        expect(again.container.textContent).not.toContain("Only the newest");
    });
});
