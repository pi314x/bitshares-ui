import * as React from "react";
import {render, fireEvent, act} from "@testing-library/react";
import {Validation} from "../../../services/Validation/Validation";
import {runRules} from "../../../components/Exchange/ScaledOrderTab";

// `checkFeeAssets()` resolves on a microtask (an empty-balances mock
// `Promise.all([])`) after mount - flushed explicitly so its state
// update lands inside `act()` instead of warning after each test body
// finishes.
async function flushMicrotasks() {
    await act(async () => {
        await Promise.resolve();
    });
}

describe("components/Exchange/ScaledOrderTab runRules", () => {
    it("returns null (valid) when every rule passes", () => {
        const rules = [
            Validation.Rules.required(),
            Validation.Rules.number(),
            Validation.Rules.min({min: 0, higherThan: true} as any)
        ];
        expect(runRules("5", rules)).toBeNull();
    });

    it("returns the required rule's message for an empty value", () => {
        const rules = [Validation.Rules.required()];
        expect(runRules("", rules)).toBe(Validation.Rules.required().message);
        expect(runRules(undefined, rules)).toBe(
            Validation.Rules.required().message
        );
    });

    it("returns the number rule's message for a non-numeric value", () => {
        const rules = [Validation.Rules.number()];
        expect(runRules("abc", rules)).toBe(Validation.Rules.number().message);
    });

    it("returns the min rule's message when the value is not higher than min", () => {
        const rules = [
            Validation.Rules.min({min: 10, higherThan: true} as any)
        ];
        expect(runRules("10", rules)).toBe(
            Validation.Rules.min({min: 10, higherThan: true} as any).message
        );
        expect(runRules("11", rules)).toBeNull();
    });

    it("stops at the first failing rule (validateFirst semantics)", () => {
        const requiredRule = Validation.Rules.required();
        const numberRule = Validation.Rules.number();
        // Empty value fails `required` - `number`'s message must never surface.
        expect(runRules("", [requiredRule, numberRule])).toBe(
            requiredRule.message
        );
    });

    it("enforces a balance rule (the one check isFormValid doesn't replicate)", () => {
        const rules = [
            Validation.Rules.balance({balance: 5, symbol: "BTS"})
        ];
        expect(runRules("10", rules)).toBe(
            Validation.Rules.balance({balance: 5, symbol: "BTS"}).message
        );
        expect(runRules("3", rules)).toBeNull();
    });
});

// Full render coverage, mocking only the chain-coupled leaves
// (AssetName/AssetNameWrapper, PriceText, ChainStore, asset_utils,
// trxHelper) - everything else (Validation, the design-system
// components, the Math service, and ScaledOrderTab/ScaledOrderFormInner
// themselves) is real, so the actual order-preparation math below runs
// unmocked, exactly as it would in the app.
jest.mock("../../../components/Utility/AssetName", () => ({
    __esModule: true,
    default: ({name}: {name: string}) => <span>{name}</span>
}));
jest.mock("../../../components/Utility/PriceText", () => ({
    __esModule: true,
    default: () => null
}));
jest.mock("bitsharesjs", () => ({
    ...jest.requireActual("bitsharesjs"),
    ChainStore: {
        getAsset: (idOrSymbol: string) =>
            idOrSymbol === "1.3.0" || idOrSymbol === "BTS"
                ? {
                      get: (k: string) =>
                          k === "symbol" ? "BTS" : "1.3.0"
                  }
                : null,
        getObject: () => null
    }
}));
jest.mock("../../../lib/common/asset_utils", () => ({
    __esModule: true,
    default: {
        getFlagBooleans: () => ({charge_market_fee: false})
    }
}));
jest.mock("../../../lib/common/trxHelper", () => ({
    checkFeeStatusAsync: () => Promise.resolve(null)
}));

import ScaledOrderTab from "../../../components/Exchange/ScaledOrderTab";

function makeAsset(id: string, symbol: string, precision = 5) {
    return {
        get: (key: string) => {
            if (key === "id" || key === "asset_id") return id;
            if (key === "symbol") return symbol;
            if (key === "precision") return precision;
            return undefined;
        },
        getIn: (path: string[]) => {
            const joined = path.join(".");
            if (joined === "options.market_fee_percent") return 0;
            if (joined === "options.max_market_fee") return 0;
            if (joined === "options.flags") return 0;
            return undefined;
        },
        has: () => false
    };
}

function makeAccount() {
    return {
        get: (key: string) => {
            if (key === "id") return "1.2.1";
            if (key === "balances") {
                return {
                    get: () => undefined,
                    forEach: () => {}
                };
            }
            return undefined;
        }
    };
}

function renderTab(overrides: Partial<React.ComponentProps<typeof ScaledOrderTab>> = {}) {
    const baseAsset = makeAsset("1.3.0", "BTS");
    const quoteAsset = makeAsset("1.3.100", "USD");
    const createScaledOrder = jest.fn();

    const expirations = {
        "1hour": {title: "1 Hour", get: () => "2024-01-01T00:00:00"}
    };

    const utils = render(
        <ScaledOrderTab
            expirationType="1hour"
            expirations={expirations}
            expirationCustomTime="Specific"
            onExpirationTypeChange={() => {}}
            onExpirationCustomChange={() => {}}
            currentPrice={0}
            lastClickedPrice={null}
            currentAccount={makeAccount()}
            createScaledOrder={createScaledOrder}
            type="bid"
            quoteAsset={quoteAsset}
            baseAsset={baseAsset}
            {...overrides}
        />
    );

    return {...utils, createScaledOrder};
}

function getSubmitButton(container: HTMLElement): HTMLButtonElement {
    // The submit Buy/Sell button is the last <button> in document order -
    // the fee-currency Select's own trigger (also a <button>) renders
    // earlier, inside the form.
    const buttons = container.querySelectorAll("button");
    return buttons[buttons.length - 1] as HTMLButtonElement;
}

function fillScaledOrderForm(
    container: HTMLElement,
    {
        priceLower,
        priceUpper,
        amount,
        orderCount
    }: {priceLower: string; priceUpper: string; amount: string; orderCount: string}
) {
    const priceAndAmountInputs = Array.from(
        container.querySelectorAll('input[placeholder="0.0"]:not([disabled])')
    ) as HTMLInputElement[];
    const orderCountInput = container.querySelector(
        'input[placeholder="0"]'
    ) as HTMLInputElement;

    fireEvent.change(priceAndAmountInputs[0], {target: {value: priceLower}});
    fireEvent.change(priceAndAmountInputs[1], {target: {value: priceUpper}});
    fireEvent.change(priceAndAmountInputs[2], {target: {value: amount}});
    fireEvent.change(orderCountInput, {target: {value: orderCount}});
}

describe("components/Exchange/ScaledOrderTab", () => {
    it("disables the submit button until price/amount/orderCount are all valid", async () => {
        const {container} = renderTab();
        await flushMicrotasks();
        const submitButton = getSubmitButton(container);
        expect(submitButton.disabled).toBe(true);

        fillScaledOrderForm(container, {
            priceLower: "1",
            priceUpper: "2",
            amount: "10",
            orderCount: "3"
        });
        await flushMicrotasks();
        expect(submitButton.disabled).toBe(false);
    });

    it("computes and submits the correct scaled orders on submit", async () => {
        const {container, createScaledOrder} = renderTab();
        await flushMicrotasks();

        fillScaledOrderForm(container, {
            priceLower: "1",
            priceUpper: "2",
            amount: "9",
            orderCount: "3"
        });
        // orderCount changing re-triggers checkFeeAssets() - flush its
        // microtask too before asserting/clicking.
        await flushMicrotasks();

        const submitButton = getSubmitButton(container);
        expect(submitButton.disabled).toBe(false);
        fireEvent.click(submitButton);

        expect(createScaledOrder).toHaveBeenCalledTimes(1);
        const [orders] = createScaledOrder.mock.calls[0];
        expect(orders).toHaveLength(3);

        // amountPerOrder = 9 / 3 = 3; step = (2 - 1) / (3 - 1) = 0.5
        // prices: 1, 1.5, 2 - "bid" (BUY quote with base): sell base
        // (for_sale), receive quote (to_receive), scaled by price per order.
        const expectedPrices = [1, 1.5, 2];
        orders.forEach((order: any, i: number) => {
            const scaledAmount = Number(
                (3 * expectedPrices[i]).toPrecision(5)
            );
            expect(order.for_sale.amount).toBeCloseTo(
                scaledAmount * Math.pow(10, 5),
                5
            );
            expect(order.to_receive.asset_id).toBe("1.3.100");
            expect(order.for_sale.asset_id).toBe("1.3.0");
        });
    });

    it("sets priceLower from an external lastClickedPrice prop change", async () => {
        const {container, rerender} = renderTab({lastClickedPrice: null});
        await flushMicrotasks();

        rerender(
            <ScaledOrderTab
                expirationType="1hour"
                expirations={{
                    "1hour": {title: "1 Hour", get: () => "2024-01-01T00:00:00"}
                }}
                expirationCustomTime="Specific"
                onExpirationTypeChange={() => {}}
                onExpirationCustomChange={() => {}}
                currentPrice={0}
                lastClickedPrice={"1.25"}
                currentAccount={makeAccount()}
                createScaledOrder={() => {}}
                type="bid"
                quoteAsset={makeAsset("1.3.100", "USD")}
                baseAsset={makeAsset("1.3.0", "BTS")}
            />
        );

        const priceLowerInput = container.querySelector(
            'input[placeholder="0.0"]:not([disabled])'
        ) as HTMLInputElement;
        expect(priceLowerInput.value).toBe("1.25");
    });
});
