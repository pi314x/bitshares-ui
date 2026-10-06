import * as React from "react";
import {act, fireEvent} from "@testing-library/react";
import {Notification} from "../../design-system/Notification";

// `Notification` is an imperative API, not a rendered component - it
// lazily mounts its own stack into `document.body` on first call (a
// container it keeps for the lifetime of the module/test file, so
// re-querying `document.body` works the same way across tests as it
// would across real app calls), so these tests query `document.body`
// directly instead of using RTL's `render`. Every test either clicks its
// own close button or lets a short explicit `duration` elapse under fake
// timers, so no entry is ever left over for the next test - the
// container itself is never torn down between tests, only emptied.
describe("design-system/Notification", () => {
    it("shows a success message and dismisses it on close click", () => {
        act(() => {
            Notification.success({message: "Saved", duration: 0});
        });
        expect(document.body.textContent).toContain("Saved");

        const closeButton = document.body.querySelector(
            "button[aria-label='Close']"
        ) as HTMLButtonElement;
        act(() => {
            fireEvent.click(closeButton);
        });
        expect(document.body.textContent).not.toContain("Saved");
    });

    it("shows an error message", () => {
        act(() => {
            Notification.error({message: "Something broke", duration: 0});
        });
        expect(document.body.textContent).toContain("Something broke");

        const closeButton = document.body.querySelector(
            "button[aria-label='Close']"
        ) as HTMLButtonElement;
        act(() => {
            fireEvent.click(closeButton);
        });
    });

    it("shows a warning message", () => {
        act(() => {
            Notification.warning({message: "Heads up", duration: 0});
        });
        expect(document.body.textContent).toContain("Heads up");

        const closeButton = document.body.querySelector(
            "button[aria-label='Close']"
        ) as HTMLButtonElement;
        act(() => {
            fireEvent.click(closeButton);
        });
    });

    it("shows an info message", () => {
        act(() => {
            Notification.info({message: "FYI", duration: 0});
        });
        expect(document.body.textContent).toContain("FYI");

        const closeButton = document.body.querySelector(
            "button[aria-label='Close']"
        ) as HTMLButtonElement;
        act(() => {
            fireEvent.click(closeButton);
        });
    });

    it("shows description content below the message, and a custom icon in place of the default one", () => {
        act(() => {
            Notification.info({
                message: "Price alert",
                description: "BTS/USD crossed 0.05",
                icon: <svg data-testid="custom-icon" />,
                duration: 0
            });
        });
        expect(document.body.textContent).toContain("Price alert");
        expect(document.body.textContent).toContain(
            "BTS/USD crossed 0.05"
        );
        expect(
            document.body.querySelector("[data-testid='custom-icon']")
        ).toBeTruthy();

        const closeButton = document.body.querySelector(
            "button[aria-label='Close']"
        ) as HTMLButtonElement;
        act(() => {
            fireEvent.click(closeButton);
        });
    });

    it("auto-dismisses after the given duration", () => {
        jest.useFakeTimers();
        act(() => {
            Notification.success({message: "Auto-dismiss me", duration: 1});
        });
        expect(document.body.textContent).toContain("Auto-dismiss me");

        act(() => {
            jest.advanceTimersByTime(1000);
        });
        expect(document.body.textContent).not.toContain("Auto-dismiss me");
        jest.useRealTimers();
    });

    it("stacks multiple notifications at once", () => {
        act(() => {
            Notification.success({message: "First", duration: 0});
            Notification.error({message: "Second", duration: 0});
        });
        expect(document.body.textContent).toContain("First");
        expect(document.body.textContent).toContain("Second");

        document
            .querySelectorAll("button[aria-label='Close']")
            .forEach((button) => {
                act(() => {
                    fireEvent.click(button);
                });
            });
    });

    it("applies Notification.config's duration as the new default", () => {
        jest.useFakeTimers();
        Notification.config({duration: 2});
        act(() => {
            Notification.success({message: "Configured duration"});
        });
        expect(document.body.textContent).toContain("Configured duration");

        act(() => {
            jest.advanceTimersByTime(1999);
        });
        expect(document.body.textContent).toContain("Configured duration");

        act(() => {
            jest.advanceTimersByTime(1);
        });
        expect(document.body.textContent).not.toContain("Configured duration");

        Notification.config({duration: 4.5});
        jest.useRealTimers();
    });
});
