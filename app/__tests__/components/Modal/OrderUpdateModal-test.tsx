import * as React from "react";
import {render, fireEvent, act, screen} from "@testing-library/react";
import counterpart from "counterpart";
import {fromJS, List} from "immutable";
import localeEn from "../../../assets/locales/locale-en.json";

const mockUpdate = jest.fn();
jest.mock("../../../actions/OrderUpdateActions", () => ({
    __esModule: true,
    default: {update: (...a: any[]) => mockUpdate(...a)}
}));

const mockOrder = fromJS({
    id: "1.7.9",
    seller: "1.2.100",
    for_sale: "1000000",
    sell_price: {
        base: {amount: "1000000", asset_id: "1.3.0"},
        quote: {amount: "50000", asset_id: "1.3.121"}
    }
});
const mockAssets = List([
    fromJS({id: "1.3.0", symbol: "BTS", precision: 5}),
    fromJS({id: "1.3.121", symbol: "USD", precision: 4})
]);
jest.mock("bitsharesjs", () => {
    const actual = jest.requireActual("bitsharesjs");
    return {
        ...actual,
        FetchChain: (what: string) =>
            Promise.resolve(what === "getObject" ? mockOrder : mockAssets)
    };
});

import OrderUpdateModal from "../../../components/Modal/OrderUpdateModal";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    mockUpdate.mockReset();
    mockUpdate.mockResolvedValue(undefined);
});

// (this jsdom has no MutationObserver, so no waitFor: poll under act)
const until = async (check: () => boolean) => {
    for (let i = 0; i < 100 && !check(); i++) {
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 10));
        });
    }
    expect(check()).toBe(true);
};

const open = async () => {
    const onDone = jest.fn();
    render(
        <OrderUpdateModal orderId="1.7.9" onCancel={() => {}} onDone={onDone} />
    );
    await until(() => screen.queryAllByRole("textbox").length === 2);
    return onDone;
};

const submitButton = () =>
    screen.getByRole("button", {name: "Update order"}) as HTMLButtonElement;

describe("OrderUpdateModal", () => {
    it("shows the order and offers its amount and price", async () => {
        await open();
        const [amount, price] = screen.getAllByRole(
            "textbox"
        ) as HTMLInputElement[];
        expect(amount.value).toBe("10");
        expect(price.value).toBe("0.5");
        expect(document.body.textContent).toContain("Update order #9");
        expect(document.body.textContent).toContain("Selling 10 BTS for USD");
    });

    it("cannot be sent while nothing is changed", async () => {
        await open();
        expect(submitButton().disabled).toBe(true);
    });

    it("sends the change of amount for a new amount", async () => {
        const onDone = await open();
        const [amount] = screen.getAllByRole("textbox") as HTMLInputElement[];
        fireEvent.change(amount, {target: {value: "12"}});
        await until(() => submitButton().disabled === false);
        fireEvent.click(submitButton());
        await until(() => mockUpdate.mock.calls.length === 1);
        const op = mockUpdate.mock.calls[0][0];
        expect(op.seller).toBe("1.2.100");
        expect(op.order).toBe("1.7.9");
        expect(op.delta_amount_to_sell).toEqual({
            amount: 200000,
            asset_id: "1.3.0"
        });
        expect(op.new_price).toBeUndefined();
        await until(() => onDone.mock.calls.length > 0);
    });

    it("sends a new price only when the price was edited", async () => {
        await open();
        const [, price] = screen.getAllByRole("textbox") as HTMLInputElement[];
        fireEvent.change(price, {target: {value: "0.75"}});
        await until(() => submitButton().disabled === false);
        fireEvent.click(submitButton());
        await until(() => mockUpdate.mock.calls.length === 1);
        const op = mockUpdate.mock.calls[0][0];
        expect(op.new_price.base).toEqual({
            amount: 1000000,
            asset_id: "1.3.0"
        });
        expect(op.new_price.quote).toEqual({
            amount: 75000,
            asset_id: "1.3.121"
        });
        expect(op.delta_amount_to_sell).toBeUndefined();
    });

    it("shows the reason when the transaction fails", async () => {
        mockUpdate.mockRejectedValue(new Error("Cannot update limit order"));
        await open();
        const [amount] = screen.getAllByRole("textbox") as HTMLInputElement[];
        fireEvent.change(amount, {target: {value: "5"}});
        await until(() => submitButton().disabled === false);
        fireEvent.click(submitButton());
        await until(() =>
            (document.body.textContent || "").includes(
                "Cannot update limit order"
            )
        );
    });
});
