import {installResizeGuard} from "../../lib/common/resizeGuard";

describe("installResizeGuard", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("marks the page as resizing during a resize and clears it after", () => {
        const stop = installResizeGuard(window, 150);
        const root = document.documentElement;
        expect(root.classList.contains("is-resizing")).toBe(false);
        window.dispatchEvent(new Event("resize"));
        expect(root.classList.contains("is-resizing")).toBe(true);
        jest.advanceTimersByTime(100);
        window.dispatchEvent(new Event("resize")); // restarts the wait
        jest.advanceTimersByTime(100);
        expect(root.classList.contains("is-resizing")).toBe(true);
        jest.advanceTimersByTime(60);
        expect(root.classList.contains("is-resizing")).toBe(false);
        stop();
    });

    it("cleans up", () => {
        const stop = installResizeGuard(window, 150);
        window.dispatchEvent(new Event("resize"));
        stop();
        expect(document.documentElement.classList.contains("is-resizing")).toBe(
            false
        );
    });
});
