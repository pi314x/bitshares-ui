import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {MemoryRouter, useLocation} from "react-router-dom";
import counterpart from "counterpart";
import localeEn from "../../assets/locales/locale-en.json";
import NotificationBell from "../../components/Notifications/NotificationBell";
import RouteOpener from "../../next/RouteOpener";
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

    it("opens the page of the transaction an entry is about, and closes the panel", () => {
        recordNotification(
            "success",
            "Pool swap",
            "Swapped 1 BTS for 3 USD",
            Date.now(),
            "/block/7000/3"
        );
        recordNotification("info", "Nothing to open", "");
        const Where = () => (
            <span data-testid="where">{useLocation().pathname}</span>
        );
        const {getByRole, getByText, getByTestId, queryByText} = render(
            <MemoryRouter initialEntries={["/"]}>
                <RouteOpener />
                <NotificationBell />
                <Where />
            </MemoryRouter>
        );
        fireEvent.click(getByRole("button", {name: /Notifications/}));
        // only the entry that has a page is a link
        expect(getAllLinks()).toHaveLength(1);
        fireEvent.click(getByText("Swapped 1 BTS for 3 USD"));
        expect(getByTestId("where").textContent).toBe("/block/7000/3");
        expect(queryByText("Swapped 1 BTS for 3 USD")).toBeNull();
        expect(getByRole("button", {name: "Notifications"})).toBeTruthy();
    });

    it("works without a router: an entry with a page is then only text", () => {
        recordNotification("info", "Hello", "", Date.now(), "/block/1/0");
        const {getByRole, getByText} = render(<NotificationBell />);
        fireEvent.click(getByRole("button", {name: /Notifications/}));
        expect(() => fireEvent.click(getByText("Hello"))).not.toThrow();
    });
});

const getAllLinks = () =>
    Array.from(document.querySelectorAll('li[role="link"]'));
