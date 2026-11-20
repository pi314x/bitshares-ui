// The market picker lists the assets that were picked last (at most five, the newest first) while the search box is
// empty; each can be taken out of the list with its x.
import * as React from "react";
import {act, fireEvent, render} from "@testing-library/react";
import {MemoryRouter, useLocation} from "react-router-dom";
import {Map} from "immutable";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";

jest.mock("actions/AssetActions", () => ({
    __esModule: true,
    default: {getAssetList: {defer: jest.fn()}}
}));
jest.mock("../../components/Utility/AssetName", () => ({
    __esModule: true,
    default: (props: any) =>
        jest.requireActual("react").createElement("span", null, props.name)
}));

import MarketPicker from "../../components/Exchange/MarketPicker";
import {
    addRecentPick,
    getRecentPicks,
    reloadRecentPicks
} from "../../lib/common/recentMarketPicks";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    window.localStorage.clear();
    reloadRecentPicks();
});

const Where = () => <span data-testid="where">{useLocation().pathname}</span>;

const quote = Map({id: "1.3.100", symbol: "XBTSX.USDT"});
const base = Map({id: "1.3.0", symbol: "BTS"});

function mount(props: any = {}) {
    const hideModal = jest.fn();
    const toggle = jest.fn();
    const view = render(
        <MemoryRouter initialEntries={["/market/XBTSX.USDT_BTS"]}>
            <MarketPicker
                visible
                showModal={jest.fn()}
                hideModal={hideModal}
                modalId="marketPicker"
                quoteAsset={quote}
                baseAsset={base}
                marketPickerAsset="XBTSX.USDT"
                onToggleMarketPicker={toggle}
                {...props}
            />
            <Where />
        </MemoryRouter>
    );
    return {view, hideModal, toggle};
}

const rows = () =>
    Array.from(document.body.querySelectorAll(".results li")).map(li =>
        (li.textContent || "").replace("×", "").trim()
    );
const symbols = () => getRecentPicks().map(p => p.symbol);
const where = () =>
    (document.body.querySelector("[data-testid='where']") as HTMLElement)
        .textContent;
const removeButton = (n: number) =>
    document.body.querySelectorAll(
        "button[aria-label='Remove from the recent list']"
    )[n] as HTMLElement;

describe("the recent list of the market picker", () => {
    it("is not there while nothing was picked", () => {
        mount();
        expect(document.body.textContent).not.toContain("Recent");
        expect(rows()).toEqual([]);
    });

    it("lists the assets picked, the newest first, under a title, with the owner", () => {
        addRecentPick("USD", "committee-account");
        addRecentPick("CNY", "init0");
        addRecentPick("EUR");
        mount();
        expect(document.body.textContent).toContain("Recent");
        expect(rows()).toEqual(["EUR", "CNYinit0", "USDcommittee-account"]);
    });

    it("leaves out the assets that are in this market already", () => {
        addRecentPick("BTS");
        addRecentPick("USD");
        addRecentPick("XBTSX.USDT");
        mount();
        expect(rows()).toEqual(["USD"]);
        // (they are still remembered)
        expect(symbols()).toEqual(["XBTSX.USDT", "USD", "BTS"]);
    });

    it("opens the market with the asset in the place of the one that is replaced, and closes the picker", () => {
        addRecentPick("USD");
        const {view, hideModal, toggle} = mount();
        // the quote is replaced: USD against the base
        fireEvent.click(view.getByText("USD"));
        expect(where()).toBe("/market/USD_BTS");
        expect(hideModal).toHaveBeenCalled();
        expect(toggle).toHaveBeenCalledWith(null);
    });

    it("replaces the base when that is what the picker was opened for", () => {
        addRecentPick("USD");
        const {view} = mount({marketPickerAsset: "BTS"});
        fireEvent.click(view.getByText("USD"));
        expect(where()).toBe("/market/XBTSX.USDT_USD");
    });

    it("moves the asset that is picked again to the front", () => {
        addRecentPick("USD");
        addRecentPick("CNY");
        addRecentPick("EUR");
        const {view} = mount();
        fireEvent.click(view.getByText("USD"));
        expect(symbols()).toEqual(["USD", "EUR", "CNY"]);
    });

    it("keeps the owner of an asset that is picked again from the list", () => {
        addRecentPick("USD", "committee-account");
        addRecentPick("CNY");
        const {view} = mount();
        fireEvent.click(view.getByText("USD"));
        expect(getRecentPicks()[0]).toEqual({
            symbol: "USD",
            issuer: "committee-account"
        });
    });

    it("takes an asset out with its x, and only that one, without opening the market", () => {
        addRecentPick("USD");
        addRecentPick("CNY");
        addRecentPick("EUR");
        mount();
        fireEvent.click(removeButton(1));
        expect(rows()).toEqual(["EUR", "USD"]);
        expect(symbols()).toEqual(["EUR", "USD"]);
        expect(where()).toBe("/market/XBTSX.USDT_BTS");
        // kept: it is gone after a reload of what is stored
        act(() => reloadRecentPicks());
        expect(symbols()).toEqual(["EUR", "USD"]);
    });

    it("does not open the market when Enter is pressed on the x", () => {
        addRecentPick("USD");
        mount();
        fireEvent.keyPress(removeButton(0), {key: "Enter", charCode: 13});
        expect(where()).toBe("/market/XBTSX.USDT_BTS");
        expect(symbols()).toEqual(["USD"]);
    });

    it("opens the market on Enter in a row, and moves it to the front", () => {
        addRecentPick("USD");
        addRecentPick("EUR");
        mount();
        const row = document.body.querySelectorAll(".results li")[1];
        fireEvent.keyPress(row, {key: "Enter", charCode: 13});
        expect(where()).toBe("/market/USD_BTS");
        expect(symbols()).toEqual(["USD", "EUR"]);
    });

    it("is gone while something is typed, and is empty again after the last x", () => {
        addRecentPick("USD");
        mount();
        const input = document.body.querySelector("input") as HTMLInputElement;
        fireEvent.change(input, {target: {value: "us"}});
        expect(document.body.textContent).not.toContain("Recent");
        fireEvent.change(input, {target: {value: ""}});
        expect(rows()).toEqual(["USD"]);
        fireEvent.click(removeButton(0));
        expect(rows()).toEqual([]);
        expect(document.body.textContent).not.toContain("Recent");
    });
});
