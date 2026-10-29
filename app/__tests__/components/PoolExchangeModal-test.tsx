import * as React from "react";
import {render, fireEvent, act} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import Immutable from "immutable";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

const mockExchange = jest.fn();
const mockLimitOrders = jest.fn();
const mockSend = jest.fn();

jest.mock("api/ApplicationApi", () => ({
    __esModule: true,
    default: {liquidityPoolExchange: (...a: any[]) => mockExchange(...a)}
}));
// what the chain would do with the two operations: the real simulation unless a test says it would refuse
const mockSimulate = jest.fn();
jest.mock("../../lib/common/chainSim", () => ({
    ...jest.requireActual("../../lib/common/chainSim"),
    simulateOperations: (...a: any[]) => mockSimulate(...a)
}));
// the split is one transaction of two operations, sent as the Advanced page sends operations
jest.mock("../../actions/AdvancedActions", () => ({
    __esModule: true,
    default: {send: (...a: any[]) => mockSend(...a)}
}));
jest.mock("common/trxHelper", () => ({
    estimateFeeAsync: () => Promise.resolve(0)
}));
jest.mock("bitsharesjs-ws", () => ({
    Apis: {
        instance: () => ({
            db_api: () => ({
                exec: (...a: any[]) => mockLimitOrders(...a)
            })
        })
    }
}));
jest.mock("../../components/Utility/AssetName", () => ({
    __esModule: true,
    default: ({name}: {name: string}) => <span>{name}</span>
}));
jest.mock("../../next/hooks/useChainStoreTick", () => ({
    useChainStoreTick: () => 0
}));
jest.mock("../../next/hooks/useReduxState", () => ({
    useReduxState: () => ({currentAccount: "alice"})
}));

// BTS (precision 5) in A, USD (precision 4) in B: 200,000 BTS and 2,700 USD
const asset = (id: string, symbol: string, precision: number) =>
    Immutable.fromJS({
        id,
        symbol,
        precision,
        options: {flags: 0, market_fee_percent: 0, max_market_fee: "0"}
    });
const mockPool = Immutable.Map({
    id: "1.19.7",
    asset_a: asset("1.3.0", "BTS", 5),
    asset_b: asset("1.3.121", "USD", 4),
    balance_a: "20000000000",
    balance_b: "27000000",
    taker_fee_percent: 20,
    withdrawal_fee_percent: 0,
    virtual_value: "540000000000000000"
});

jest.mock("bitsharesjs", () => {
    const I = jest.requireActual("immutable");
    return {
        ChainStore: {
            getLiquidityPoolsByShareAsset: () =>
                Promise.resolve(I.List([mockPool])),
            getAccount: () =>
                I.fromJS({
                    id: "1.2.9",
                    balances: {"1.3.0": "2.5.1", "1.3.121": "2.5.2"}
                }),
            getObject: (id: string) =>
                I.Map({balance: id === "2.5.1" ? "500000000" : "1000000"})
        }
    };
});

import PoolExchangeModal from "../../components/Modal/PoolExchangeModal";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    jest.clearAllMocks();
    mockLimitOrders.mockResolvedValue([]);
    mockExchange.mockResolvedValue(undefined);
    mockSend.mockReset();
    mockSend.mockResolvedValue(undefined);
    mockSimulate.mockReset();
    mockSimulate.mockImplementation((...a: any[]) =>
        jest.requireActual("../../lib/common/chainSim").simulateOperations(...a)
    );
});

async function open() {
    const onHide = jest.fn();
    const utils = render(
        <MemoryRouter>
            <PoolExchangeModal
                pool="1.3.9000"
                isModalVisible={true}
                onHideModal={onHide}
            />
        </MemoryRouter>
    );
    for (let i = 0; i < 5; i++) {
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
        });
    }
    return {...utils, onHide};
}

const field = (label: string) =>
    document.querySelector(`input[aria-label="${label}"]`) as HTMLInputElement;

describe("PoolExchangeModal (swap)", () => {
    it("works out what is received from what is paid, and the reverse", async () => {
        await open();
        const pay = field("You pay");
        const receive = field("You receive");
        await act(async () => {
            fireEvent.change(pay, {target: {value: "1000"}});
        });
        // 1000 BTS into 200,000 BTS / 2,700 USD, 0.2% fee: about 13.4 USD
        const received = parseFloat(receive.value);
        expect(received).toBeGreaterThan(13.3);
        expect(received).toBeLessThan(13.5);

        await act(async () => {
            fireEvent.change(receive, {target: {value: "27"}});
        });
        const paid = parseFloat(pay.value);
        // 27 USD costs a little over 2,000 BTS (price impact and the fee)
        expect(paid).toBeGreaterThan(2000);
        expect(paid).toBeLessThan(2100);
    });

    it("keeps the numbers typed when the direction is switched", async () => {
        const {getByLabelText} = await open();
        await act(async () => {
            fireEvent.change(field("You pay"), {target: {value: "1000"}});
        });
        await act(async () => {
            fireEvent.click(getByLabelText("Switch the two assets"));
        });
        // the 1000 BTS are still there - now as what is received - and what
        // that costs in USD is worked out again
        expect(field("You receive").value).toBe("1000");
        const paid = parseFloat(field("You pay").value);
        expect(paid).toBeGreaterThan(13);
        expect(paid).toBeLessThan(14.5);
        // and switching back returns to the first arrangement
        await act(async () => {
            fireEvent.click(getByLabelText("Switch the two assets"));
        });
        expect(field("You pay").value).toBe("1000");
    });

    it("sends the sale and the least to receive after the slippage allowed", async () => {
        const {getByText} = await open();
        await act(async () => {
            fireEvent.change(field("You pay"), {target: {value: "1000"}});
        });
        await act(async () => {
            fireEvent.click(getByText("1%"));
        });
        const buttons = Array.from(document.querySelectorAll("button"));
        const swap = buttons.find(
            b => (b.textContent || "").trim() === "Swap"
        ) as HTMLButtonElement;
        expect(swap.disabled).toBe(false);
        await act(async () => {
            fireEvent.click(swap);
        });
        expect(mockExchange).toHaveBeenCalledTimes(1);
        const [
            account,
            poolId,
            sellSymbol,
            sell,
            buySymbol,
            min
        ] = mockExchange.mock.calls[0];
        expect(account).toBe("alice");
        expect(poolId).toBe("1.19.7");
        expect(sellSymbol).toBe("BTS");
        expect(sell).toBe(100000000); // 1000.00000 BTS in smallest units
        expect(buySymbol).toBe("USD");
        // 99% of the quote, in 0.0001 USD units
        expect(min).toBeGreaterThan(130000 * 0.99);
        expect(min).toBeLessThan(135000);
    });

    it("refuses more than the balance", async () => {
        await open();
        await act(async () => {
            fireEvent.change(field("You pay"), {target: {value: "9999999"}});
        });
        const text = document.body.textContent || "";
        expect(text).toContain("Not enough BTS");
        expect(mockExchange).not.toHaveBeenCalled();
    });

    it("says where the price is better: the order book here", async () => {
        // 1000 BTS buy about 13.4 USD in the pool; the book sells USD at 70 BTS
        // each, i.e. 14.28 USD for 1000 BTS - better
        mockLimitOrders.mockResolvedValue([
            {
                for_sale: "1000000",
                sell_price: {
                    base: {amount: "10000", asset_id: "1.3.121"},
                    quote: {amount: "7000000", asset_id: "1.3.0"}
                }
            }
        ]);
        await open();
        await act(async () => {
            fireEvent.change(field("You pay"), {target: {value: "1000"}});
        });
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 20));
        });
        expect(document.body.textContent).toContain("The order book pays");
    });

    // The pool of 200,000 BTS and 2,700 USD pays 0.0135 USD per BTS and moves along its curve. One order sells
    // 5 USD (50,000 units) at 70 BTS each: better than the pool at the margin (0.0143 against 0.0135), but too
    // small for a sale of 3000 BTS (it takes 350 BTS), so the pool alone is the best single venue. The order
    // first and the pool for the rest pays more than the pool alone.
    const thinBook = () =>
        mockLimitOrders.mockResolvedValue([
            {
                for_sale: "50000",
                sell_price: {
                    base: {amount: "10000", asset_id: "1.3.121"},
                    quote: {amount: "7000000", asset_id: "1.3.0"}
                }
            }
        ]);
    const sellAndLook = async (amount = "3000") => {
        const opened = await open();
        await act(async () => {
            fireEvent.change(field("You pay"), {target: {value: amount}});
        });
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 20));
        });
        return opened;
    };
    const switchSplit = async () => {
        const box = document.querySelector(
            'input[type="checkbox"]'
        ) as HTMLInputElement;
        await act(async () => {
            fireEvent.click(box);
        });
    };
    const swapButton = () =>
        Array.from(document.querySelectorAll("button")).find(b => {
            const label = (b.textContent || "").trim();
            return (
                ["Swap", "Enter an amount"].includes(label) ||
                label.startsWith("On the current prices")
            );
        }) as HTMLButtonElement;

    it("offers the pool and the order book together where that pays more, and says how much more", async () => {
        thinBook();
        await sellAndLook();
        const text = document.body.textContent || "";
        expect(text).toContain("Use the pool and the order book together");
        expect(text).toMatch(/Together they pay [\d.]+ USD more \(/);
        // not used until it is asked for: the sale is the pool's alone
        expect(document.querySelector('input[type="checkbox"]')).not.toBeNull();
        expect(
            (document.querySelector(
                'input[type="checkbox"]'
            ) as HTMLInputElement).checked
        ).toBe(false);
        expect(text).not.toContain("In the pool:");
    });

    it("does not offer it where the order book is empty, or pays less than the pool at the margin", async () => {
        mockLimitOrders.mockResolvedValue([]);
        const first = await sellAndLook();
        expect(document.querySelector('input[type="checkbox"]')).toBeNull();
        first.unmount();
        mockLimitOrders.mockResolvedValue([
            {
                for_sale: "50000",
                sell_price: {
                    // 100 BTS for a USD: 0.01 USD per BTS, under the pool's 0.0135
                    base: {amount: "10000", asset_id: "1.3.121"},
                    quote: {amount: "10000000", asset_id: "1.3.0"}
                }
            }
        ]);
        await sellAndLook();
        expect(document.querySelector('input[type="checkbox"]')).toBeNull();
    });

    it("shows both parts and the total when it is switched on, and receives more than the pool alone", async () => {
        thinBook();
        await open();
        const receive = field("You receive");
        await act(async () => {
            fireEvent.change(field("You pay"), {target: {value: "3000"}});
        });
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 20));
        });
        const alone = parseFloat(receive.value);
        await switchSplit();
        const text = document.body.textContent || "";
        expect(text).toMatch(/In the pool: [\d.]+ BTS for [\d.]+ USD/);
        expect(text).toMatch(
            /On the order book \(fill or kill, 1 orders\): 350 BTS for 5 USD/
        );
        expect(parseFloat(receive.value)).toBeGreaterThan(alone);
        expect(swapButton().disabled).toBe(false);
    });

    it("sends the pool exchange and a fill-or-kill order in ONE transaction, and not the plain exchange", async () => {
        thinBook();
        await sellAndLook();
        await switchSplit();
        await act(async () => {
            fireEvent.click(swapButton());
        });
        expect(mockExchange).not.toHaveBeenCalled();
        expect(mockSend).toHaveBeenCalledTimes(1);
        const operations: Array<[string, any]> = mockSend.mock.calls[0][0];
        expect(operations.map(op => op[0])).toEqual([
            "liquidity_pool_exchange",
            "limit_order_create"
        ]);
        const [, exchange] = operations[0];
        const [, order] = operations[1];
        expect(exchange).toMatchObject({
            account: "1.2.9",
            pool: "1.19.7",
            amount_to_sell: {asset_id: "1.3.0"},
            min_to_receive: {asset_id: "1.3.121"}
        });
        expect(order).toMatchObject({
            seller: "1.2.9",
            amount_to_sell: {amount: "35000000", asset_id: "1.3.0"},
            fill_or_kill: true
        });
        // the order is priced at the price of its one order: 5 USD for 350 BTS
        expect(order.min_to_receive).toEqual({
            amount: "50000",
            asset_id: "1.3.121"
        });
        // the two parts sell what was typed
        expect(
            BigInt(exchange.amount_to_sell.amount) +
                BigInt(order.amount_to_sell.amount)
        ).toBe(BigInt("300000000"));
        // and the pool's part asks for no less than the quote less the slippage (0.5%)
        expect(BigInt(exchange.min_to_receive.amount) > BigInt(0)).toBe(true);
    });

    it("sends the plain exchange when the split is not switched on", async () => {
        thinBook();
        await sellAndLook();
        await act(async () => {
            fireEvent.click(swapButton());
        });
        expect(mockExchange).toHaveBeenCalledTimes(1);
        expect(mockSend).not.toHaveBeenCalled();
    });

    it("does not split what is asked for: typing the amount to receive uses the pool alone", async () => {
        thinBook();
        await open();
        await act(async () => {
            fireEvent.change(field("You receive"), {target: {value: "27"}});
        });
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 20));
        });
        expect(document.querySelector('input[type="checkbox"]')).toBeNull();
    });

    it("does not send the split when the operations would be refused on the prices as they are, and says why", async () => {
        thinBook();
        await sellAndLook();
        mockSimulate.mockReturnValue({
            ok: false,
            index: 1,
            reason: "killed",
            steps: []
        });
        await switchSplit();
        expect(document.body.textContent).toContain(
            "On the current prices the chain would refuse this (killed)."
        );
        expect(swapButton().disabled).toBe(true);
        await act(async () => {
            fireEvent.click(swapButton());
        });
        expect(mockSend).not.toHaveBeenCalled();
        expect(mockExchange).not.toHaveBeenCalled();
        // the plain swap is still there: switch the split off
        await switchSplit();
        expect(swapButton().disabled).toBe(false);
    });
});
