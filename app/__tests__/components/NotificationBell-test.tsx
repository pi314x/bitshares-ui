import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";
import NotificationBell from "../../components/Notifications/NotificationBell";
import {
    clearNotifications,
    getNotifications,
    recordNotification,
    reloadNotifications,
    unseenCount
} from "../../lib/common/notificationHistory";

beforeAll(() => {
    (counterpart as any).registerTranslations("en", localeEn);
    (counterpart as any).setLocale("en");
});

beforeEach(() => {
    window.localStorage.clear();
    clearNotifications();
    reloadNotifications();
});

describe("NotificationBell", () => {
    it("shows how many are unseen, lists them on open, and marks them seen on close", () => {
        recordNotification("success", "Trade done", "Sold 5 BTS");
        recordNotification("error", "Failed", "");
        const {getByRole, getByText, queryByText} = render(
            <NotificationBell />
        );
        const bell = getByRole("button", {name: /2 new/});
        expect(bell.textContent).toContain("2");
        expect(queryByText("Trade done")).toBeNull();

        fireEvent.click(bell);
        expect(getByText("Trade done")).toBeTruthy();
        expect(getByText("Sold 5 BTS")).toBeTruthy();
        expect(getByText("Failed")).toBeTruthy();

        // closing marks them as seen
        fireEvent.click(getByRole("button", {name: /Notifications/}));
        expect(unseenCount()).toBe(0);
        expect(getByRole("button", {name: "Notifications"}).textContent).toBe(
            ""
        );
    });

    it("clears the history", () => {
        recordNotification("info", "One", "");
        const {getByRole, getByText} = render(<NotificationBell />);
        fireEvent.click(getByRole("button", {name: /Notifications/}));
        fireEvent.click(getByText("Clear all"));
        expect(getNotifications()).toHaveLength(0);
        expect(getByText(/Nothing yet/)).toBeTruthy();
    });
});
