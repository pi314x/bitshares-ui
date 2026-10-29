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
        expect(isDesktopModalPath("/instant-trade/BTS_USD")).toBe(true);
    });

    // Send opened as a page of its own, and the page it was left from showed its dialog behind
    // Deposit's: Send is a dialog over the page the user came from, like Deposit and Withdraw.
    it("includes Send, Timed transfer, Deposit and Withdraw", () => {
        ["/send", "/timed-transfer", "/deposit", "/withdraw"].forEach(path =>
            expect(isDesktopModalPath(path)).toBe(true)
        );
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
