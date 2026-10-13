import {browserNotificationsSupported} from "../../components/BrowserNotifications/BrowserNotifications";

describe("browserNotificationsSupported", () => {
    it("is true where Notification.requestPermission exists", () => {
        expect(
            browserNotificationsSupported({
                Notification: {requestPermission: () => {}}
            })
        ).toBe(true);
    });

    it("is false on iOS Safari, which has no window.Notification", () => {
        expect(browserNotificationsSupported({})).toBe(false);
        expect(browserNotificationsSupported({Notification: undefined})).toBe(
            false
        );
        expect(browserNotificationsSupported({Notification: {}})).toBe(false);
    });

    it("does not throw when reading it throws", () => {
        const win = {};
        Object.defineProperty(win, "Notification", {
            get() {
                throw new Error("blocked");
            },
            enumerable: true
        });
        expect(browserNotificationsSupported(win)).toBe(false);
    });
});
