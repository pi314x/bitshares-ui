import * as React from "react";
import {render, fireEvent, act} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import Immutable from "immutable";
import counterpart from "counterpart";
import {ChainStore} from "bitsharesjs";
import localeEn from "../../assets/locales/locale-en.json";
import {reduxStore} from "../../store/reduxStore";
import {patchState} from "../../store/slices/accountSlice";

const mockPaperWallet = jest.fn();
jest.mock("common/paperWallet", () => ({
    createPaperWalletAsPDF: (account: any) => mockPaperWallet(account)
}));
// the icon sprite loader pulls in hundreds of SVG files
jest.mock("../../assets/icons/icons-loader.js", () => ({}));

import ShowcaseGrid, {TILES} from "../../components/Showcases/ShowcaseGrid";

const account = Immutable.fromJS({id: "1.2.100", name: "alice"});

function setAccount(name: string | null) {
    act(() => {
        reduxStore.dispatch(
            patchState({currentAccount: name, passwordAccount: null} as any)
        );
    });
}

function renderGrid() {
    return render(
        <MemoryRouter>
            <ShowcaseGrid />
        </MemoryRouter>
    );
}

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

afterEach(() => {
    jest.restoreAllMocks();
    mockPaperWallet.mockClear();
    setAccount(null);
});

describe("Spotlight", () => {
    it("does not repeat what the left menu already links to", () => {
        const ids = TILES.map(tile => tile.id);
        [
            "instant_trade",
            "prediction_market",
            "timed_transfer",
            "voting"
        ].forEach(id => expect(ids).not.toContain(id));
    });

    it("shows every tile, grouped by purpose, with the locale's titles", () => {
        setAccount("alice");
        jest.spyOn(ChainStore as any, "getAccount").mockReturnValue(account);
        const {getByText, getAllByRole} = renderGrid();
        expect(TILES).toHaveLength(6);
        ["Trade and borrow", "Payments", "Your account"].forEach(heading =>
            expect(getByText(heading)).toBeTruthy()
        );
        expect(getAllByRole("heading", {level: 2})).toHaveLength(3);
        TILES.forEach(tile =>
            expect(
                getByText(
                    localeEn.showcases[
                        tile.locale as keyof typeof localeEn.showcases
                    ]
                        ? (localeEn.showcases as any)[tile.locale].title
                        : ""
                )
            ).toBeTruthy()
        );
    });

    it("links each tile to its page when an account is available", () => {
        setAccount("alice");
        jest.spyOn(ChainStore as any, "getAccount").mockReturnValue(account);
        const {getByTestId} = renderGrid();
        const href = (id: string) =>
            getByTestId(`tile-${id}`).getAttribute("href");
        expect(href("borrow")).toBe("/borrow");
        expect(href("barter")).toBe("/barter");
        expect(href("merchant_protocol")).toBe("/invoice/request");
        expect(href("direct_debit")).toBe("/direct-debit");
        expect(href("htlc")).toBe("/htlc");
    });

    it("says why a tile is unavailable instead of hiding it in a tooltip", () => {
        setAccount(null);
        const {getByTestId, getAllByText, getByText} = renderGrid();
        expect(getByText("Log in to use these features.")).toBeTruthy();
        const tile = getByTestId("tile-borrow");
        expect(tile.getAttribute("aria-disabled")).toBe("true");
        expect(tile.getAttribute("href")).toBeNull();
        expect(getAllByText("Log in").length).toBe(TILES.length);
    });

    it("treats an account the chain has not delivered yet as no account, then enables the tiles", () => {
        setAccount("alice");
        const get = jest
            .spyOn(ChainStore as any, "getAccount")
            .mockReturnValue(undefined);
        const {getByTestId} = renderGrid();
        expect(getByTestId("tile-barter").getAttribute("aria-disabled")).toBe(
            "true"
        );
        get.mockReturnValue(account);
        act(() => {
            (ChainStore as any).subscribers.forEach((callback: () => void) =>
                callback()
            );
        });
        expect(getByTestId("tile-barter").getAttribute("href")).toBe("/barter");
    });

    it("prints the paper wallet through the unchanged helper", () => {
        setAccount("alice");
        jest.spyOn(ChainStore as any, "getAccount").mockReturnValue(account);
        const {getByTestId} = renderGrid();
        const tile = getByTestId("tile-paper_wallet");
        expect(tile.tagName).toBe("BUTTON");
        fireEvent.click(tile);
        expect(mockPaperWallet).toHaveBeenCalledWith(account);
    });
});
