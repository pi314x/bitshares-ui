import * as React from "react";
import {render} from "@testing-library/react";
import {MemoryRouter} from "react-router-dom";
import {
    DESKTOP_MODAL_PATHS,
    DesktopModalContext,
    ModalOrPage,
    isDesktopModalPath
} from "../../next/desktopModal";

describe("isDesktopModalPath", () => {
    it("is true for the small pages and what is under them", () => {
        DESKTOP_MODAL_PATHS.forEach(path =>
            expect(isDesktopModalPath(path)).toBe(true)
        );
        expect(isDesktopModalPath("/borrow/BTS")).toBe(true);
    });

    // The Payments menu opens pages, not popups: Send, Deposit and Withdraw are pages on a desktop as on a phone
    // (the popups of the other screens, such as the portfolio's Send, are the dialogs themselves, not these routes).
    it("does not include Send, Deposit, Withdraw and Instant trade: they are pages on a desktop as on a phone", () => {
        [
            "/send",
            "/deposit",
            "/withdraw",
            "/send/x",
            "/instant-trade",
            "/instant-trade/BTS_USD"
        ].forEach(path => expect(isDesktopModalPath(path)).toBe(false));
    });

    it("does not include Timed transfer: it is a page on a desktop as on a phone", () => {
        expect(isDesktopModalPath("/timed-transfer")).toBe(false);
    });

    it("is false for every other page, and for a path that only starts alike", () => {
        [
            "/",
            "/portfolio",
            "/market/BTS_USD",
            "/deposit-withdraw"
        ].forEach(path => expect(isDesktopModalPath(path)).toBe(false));
    });
});

describe("ModalOrPage", () => {
    it("is the page itself where the route is not shown as a dialog", () => {
        const {container} = render(
            <MemoryRouter>
                <ModalOrPage title="Deposit">
                    <p>the form</p>
                </ModalOrPage>
            </MemoryRouter>
        );
        expect(container.textContent).toBe("the form");
        expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    it("is a dialog with the title where it is", () => {
        render(
            <MemoryRouter>
                <DesktopModalContext.Provider value={true}>
                    <ModalOrPage title="Deposit">
                        <p>the form</p>
                    </ModalOrPage>
                </DesktopModalContext.Provider>
            </MemoryRouter>
        );
        const text = document.body.textContent || "";
        expect(text).toContain("Deposit");
        expect(text).toContain("the form");
    });
});
