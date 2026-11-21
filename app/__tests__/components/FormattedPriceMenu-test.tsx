import * as React from "react";
import {act, fireEvent, render} from "@testing-library/react";
import {MemoryRouter, useLocation} from "react-router-dom";
import counterpart from "counterpart";
import {IntlProvider} from "react-intl";
import {Map as ImmutableMap} from "immutable";
import localeEn from "../../assets/locales/locale-en.json";

// the assets are given as the page has them (the wrapper that fetches them is not what this is about)
jest.mock("../../components/Utility/AssetWrapper", () => ({
    __esModule: true,
    default: (Component: any) => Component
}));
jest.mock("../../components/Utility/AssetName", () => ({
    __esModule: true,
    default: (props: any) =>
        jest.requireActual("react").createElement("span", null, props.name)
}));
const mockChangeDirection = jest.fn();
jest.mock("actions/SettingsActions", () => ({
    __esModule: true,
    default: {changeMarketDirection: (...a: any[]) => mockChangeDirection(...a)}
}));
const mockSwitchMarket = jest.fn();
jest.mock("actions/MarketsActions", () => ({
    __esModule: true,
    default: {switchMarket: () => mockSwitchMarket()}
}));
jest.mock("../../next/hooks/useReduxState", () => ({
    useReduxState: () => ({
        marketDirections: jest.requireActual("immutable").Map()
    })
}));

import FormattedPrice from "../../components/Utility/FormattedPrice";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

const asset = (id: string, symbol: string, precision: number) =>
    ImmutableMap({id, symbol, precision});

const Where = () => <span data-testid="where">{useLocation().pathname}</span>;

const mount = () =>
    render(
        <IntlProvider locale="en">
            <MemoryRouter initialEntries={["/"]}>
                <FormattedPrice
                    base_asset={asset("1.3.0", "BTS", 5)}
                    quote_asset={asset("1.3.5", "BITEUR", 4)}
                    base_amount={118619961}
                    quote_amount={10000}
                />
                <Where />
            </MemoryRouter>
        </IntlProvider>
    );

describe("the menu a price opens on its pair", () => {
    beforeEach(() => jest.clearAllMocks());

    it("is a small menu of three rows, drawn on the page's body, not a strip across the screen", () => {
        const {container, getByTestId} = mount();
        expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
        fireEvent.click(container.querySelector(".currency") as HTMLElement);
        const menu = document.body.querySelector(
            '[role="tooltip"]'
        ) as HTMLElement;
        expect(menu).not.toBeNull();
        // drawn by the design system's popover, outside the line the price is in
        expect(container.contains(menu)).toBe(false);
        const rows = Array.from(menu.querySelectorAll("button, a")).map(row =>
            (row.textContent || "").trim()
        );
        expect(rows).toEqual([
            "Invert the price",
            "Go to market",
            "Quick trade"
        ]);
        expect(getByTestId("where").textContent).toBe("/");
    });

    it("inverts the price and closes", () => {
        const {container} = mount();
        fireEvent.click(container.querySelector(".currency") as HTMLElement);
        const invert = Array.from(
            document.body.querySelectorAll("button")
        ).find(b => (b.textContent || "").includes("Invert")) as HTMLElement;
        fireEvent.click(invert);
        expect(mockChangeDirection).toHaveBeenCalledTimes(1);
        expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
    });

    it("goes to the market, or to Quick trade with the pair chosen, and closes", () => {
        const first = mount();
        fireEvent.click(
            first.container.querySelector(".currency") as HTMLElement
        );
        const toMarket = Array.from(
            document.body.querySelectorAll("button")
        ).find(b =>
            (b.textContent || "").includes("Go to market")
        ) as HTMLElement;
        act(() => {
            fireEvent.click(toMarket);
        });
        expect(first.getByTestId("where").textContent).toBe(
            "/market/BITEUR_BTS"
        );
        expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
        first.unmount();

        const second = mount();
        fireEvent.click(
            second.container.querySelector(".currency") as HTMLElement
        );
        const quick = Array.from(document.body.querySelectorAll("a")).find(a =>
            (a.textContent || "").includes("Quick trade")
        ) as HTMLElement;
        act(() => {
            fireEvent.click(quick);
        });
        expect(second.getByTestId("where").textContent).toBe("/instant-trade");
        expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
    });

    it("closes on a click outside it", () => {
        const {container} = mount();
        fireEvent.click(container.querySelector(".currency") as HTMLElement);
        expect(document.body.querySelector('[role="tooltip"]')).not.toBeNull();
        fireEvent.mouseDown(document.body);
        expect(document.body.querySelector('[role="tooltip"]')).toBeNull();
    });
});
