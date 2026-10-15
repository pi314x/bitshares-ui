import * as React from "react";
import {render, fireEvent, act} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import Immutable from "immutable";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

const mockExchange = jest.fn();
const mockLimitOrders = jest.fn();

jest.mock("api/ApplicationApi", () => ({
    __esModule: true,
    default: {liquidityPoolExchange: (...a: any[]) => mockExchange(...a)}
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
});
