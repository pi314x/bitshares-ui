// The tile of the Exchange header's price ticker. It used to set its state in an effect that ran after every render, which
// rendered again for ever until React gave up after 50 rounds ("Maximum update depth exceeded", 200 times when a market
// opens) - and, since each round started over from the price it had just seen, the green or red pulse of a changed price
// was gone at once.
import * as React from "react";
import {render, act} from "@testing-library/react";
import PriceStatWithLabel from "../../components/Exchange/PriceStatWithLabel";

jest.mock("react-tooltip", () => ({
    __esModule: true,
    default: {rebuild: jest.fn()}
}));
jest.mock("../../components/Utility/AssetName", () => ({
    __esModule: true,
    default: (props: any) => <span>{props.name}</span>
}));

const base = {get: (key: string) => (key === "symbol" ? "BTS" : null)};
const tile = (price: number, over: any = {}) => (
    <ul>
        <PriceStatWithLabel
            base={base as any}
            quote={base as any}
            price={price}
            ready={true}
            market="BTS_USD"
            {...over}
        />
    </ul>
);
const li = (container: HTMLElement) =>
    container.querySelector("li") as HTMLElement;

describe("PriceStatWithLabel", () => {
    let error: jest.SpyInstance;
    beforeEach(() => {
        error = jest
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
    });
    afterEach(() => error.mockRestore());
    const loops = () =>
        error.mock.calls.filter(call =>
            /Maximum update depth/.test(String(call[0]))
        );

    it("renders without looping, on the first price and on the next", () => {
        const {rerender, container} = render(tile(1));
        rerender(tile(2));
        rerender(tile(3));
        expect(loops()).toHaveLength(0);
        expect(li(container)).toBeTruthy();
    });

    it("pulses green for a price that went up, and red for one that went down, and keeps it until the next price", () => {
        const {rerender, container} = render(tile(10));
        expect(li(container).className).not.toMatch(/pulsate/);
        rerender(tile(11));
        expect(li(container).className).toMatch(/pulsate green/);
        // (a render that brings no new price - the quote changed - keeps what it showed)
        rerender(tile(11, {quote: {get: () => "X"}}));
        expect(li(container).className).toMatch(/pulsate green/);
        rerender(tile(9));
        expect(li(container).className).toMatch(/pulsate red/);
    });

    it("does not pulse for the price of another market", () => {
        const {rerender, container} = render(tile(10));
        // (the first price that changes tells the tile which market it shows)
        rerender(tile(11));
        rerender(tile(500, {market: "BTS_EUR"}));
        expect(li(container).className).not.toMatch(/pulsate/);
    });

    it("does not pulse when the price is not ready", () => {
        const {rerender, container} = render(tile(10, {ready: false}));
        rerender(tile(12, {ready: false}));
        expect(li(container).className).not.toMatch(/pulsate/);
        act(() => undefined);
    });
});
