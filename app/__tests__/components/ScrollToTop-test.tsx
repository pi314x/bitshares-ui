// Every page opens at its top: the window is set to 0,0 when the page that is shown changes (and when the app first
// shows one), not when the same page renders again, nor for an address that points at a place in the page.
import * as React from "react";
import {render} from "@testing-library/react";
import ScrollToTop from "../../components/Utility/ScrollToTop";

let scrollTo: jest.SpyInstance;

beforeEach(() => {
    // (this jsdom has no scrollTo to spy on)
    (window as any).scrollTo = () => {};
    scrollTo = jest.spyOn(window as any, "scrollTo");
});

afterEach(() => {
    scrollTo.mockRestore();
});

describe("ScrollToTop", () => {
    it("sets the top when the first page is shown, and again for every other page", () => {
        const view = render(<ScrollToTop pathname="/dashboard" />);
        expect(scrollTo).toHaveBeenCalledTimes(1);
        expect(scrollTo).toHaveBeenLastCalledWith(0, 0);
        view.rerender(<ScrollToTop pathname="/market/BTS_USD" />);
        expect(scrollTo).toHaveBeenCalledTimes(2);
        view.rerender(<ScrollToTop pathname="/account/x/orders" />);
        expect(scrollTo).toHaveBeenCalledTimes(3);
    });

    it("leaves the position alone while the same page renders again", () => {
        const view = render(<ScrollToTop pathname="/dashboard" />);
        scrollTo.mockClear();
        view.rerender(<ScrollToTop pathname="/dashboard" />);
        view.rerender(<ScrollToTop pathname="/dashboard" hash="" />);
        expect(scrollTo).not.toHaveBeenCalled();
    });

    it("goes to the top before the page is painted (a layout effect), so the page never shows from the middle", () => {
        // a layout effect of the page that follows runs after the scroll; a passive effect would run after it
        const order: string[] = [];
        scrollTo.mockImplementation(() => order.push("scroll"));
        function Probe() {
            React.useLayoutEffect(() => {
                order.push("page layout effect");
            });
            React.useEffect(() => {
                order.push("page effect");
            });
            return null;
        }
        render(
            <>
                <ScrollToTop pathname="/a" />
                <Probe />
            </>
        );
        expect(order).toEqual(["scroll", "page layout effect", "page effect"]);
    });

    it("does not scroll for an address that points at a place in the page", () => {
        const view = render(<ScrollToTop pathname="/help" hash="#shorting" />);
        view.rerender(<ScrollToTop pathname="/help/dex" hash="#fees" />);
        expect(scrollTo).not.toHaveBeenCalled();
        // the next page without a place starts at the top again
        view.rerender(<ScrollToTop pathname="/dashboard" />);
        expect(scrollTo).toHaveBeenCalledTimes(1);
    });

    it("keeps the browser from bringing the old position back on a reload or on back", () => {
        // (a browser has this; this jsdom does not)
        Object.defineProperty(window.history, "scrollRestoration", {
            value: "auto",
            writable: true,
            configurable: true
        });
        render(<ScrollToTop pathname="/dashboard" />);
        expect((window.history as any).scrollRestoration).toBe("manual");
        delete (window.history as any).scrollRestoration;
    });

    it("does not fail where the window cannot scroll", () => {
        (window as any).scrollTo = undefined;
        expect(() => render(<ScrollToTop pathname="/x" />)).not.toThrow();
    });
});
