import {
    MAX_ITEMS,
    clearNotifications,
    getNotifications,
    htmlToText,
    markAllSeen,
    nodeToText,
    recordNotification,
    reloadNotifications,
    unseenCount
} from "../../lib/common/notificationHistory";

describe("notification history", () => {
    beforeEach(() => {
        window.localStorage.clear();
        clearNotifications();
        reloadNotifications();
    });

    it("keeps newest first, unseen, and says how many are unseen", () => {
        recordNotification("success", "Order placed", "BUY 5 BTS", 1000);
        recordNotification("error", "Failed", "", 2000);
        const list = getNotifications();
        expect(list.map(i => i.title)).toEqual(["Failed", "Order placed"]);
        expect(unseenCount()).toBe(2);
        markAllSeen();
        expect(unseenCount()).toBe(0);
        expect(getNotifications().every(i => i.seen)).toBe(true);
    });

    it("is kept in this browser", () => {
        recordNotification("info", "Hello", "world", 5);
        reloadNotifications();
        expect(getNotifications()).toHaveLength(1);
        expect(getNotifications()[0]).toMatchObject({
            title: "Hello",
            description: "world",
            kind: "info",
            seen: false
        });
        clearNotifications();
        reloadNotifications();
        expect(getNotifications()).toHaveLength(0);
    });

    it("keeps at most MAX_ITEMS", () => {
        for (let i = 0; i < MAX_ITEMS + 10; i++) {
            recordNotification("info", `n${i}`);
        }
        expect(getNotifications()).toHaveLength(MAX_ITEMS);
        expect(getNotifications()[0].title).toBe(`n${MAX_ITEMS + 9}`);
    });

    it("survives a corrupt store", () => {
        window.localStorage.setItem("__graphene__notificationHistory", "{nope");
        reloadNotifications();
        expect(getNotifications()).toEqual([]);
    });
});

describe("text of a message", () => {
    it("reads strings, numbers and nested children", () => {
        const node = {
            props: {
                children: ["Sold ", 5, " ", {props: {children: "BTS"}}]
            }
        };
        expect(nodeToText(node)).toBe("Sold 5 BTS");
        expect(nodeToText(null)).toBe("");
    });

    it("turns the legacy HTML into text", () => {
        expect(htmlToText("Paid <b>5</b> to <a href='x'>alice</a>")).toBe(
            "Paid 5 to alice"
        );
        expect(htmlToText("plain")).toBe("plain");
    });
});
