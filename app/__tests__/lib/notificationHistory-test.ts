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

    // The confirmation of a transaction sent only `children`; the entry under the bell was a check
    // mark and a time with nothing between.
    it("does not keep an entry that says nothing", () => {
        recordNotification("success", "", "");
        recordNotification("success", "   ", "  ");
        expect(getNotifications()).toHaveLength(0);
        recordNotification("success", "", "only a description");
        expect(getNotifications()).toHaveLength(1);
    });

    it("drops the empty entries an earlier version kept", () => {
        const entry = (id: number, title: string, description = "") => ({
            id,
            at: id,
            kind: "success",
            title,
            description,
            seen: false
        });
        window.localStorage.setItem(
            "__graphene__notificationHistory",
            JSON.stringify([
                entry(3, "Trade done", "Sold 1 BTS"),
                entry(2, ""),
                entry(1, " ")
            ])
        );
        reloadNotifications();
        expect(getNotifications().map(i => i.title)).toEqual(["Trade done"]);
    });

    it("keeps the page an entry leads to, and only if it is a route of the app", () => {
        const kept = recordNotification("info", "A", "", 1, "/block/5/2");
        expect(kept.to).toBe("/block/5/2");
        // a web address, a protocol-relative one and a script are not routes
        expect(
            recordNotification("info", "B", "", 1, "https://evil.example/x").to
        ).toBeUndefined();
        expect(
            recordNotification("info", "C", "", 1, "//evil.example/x").to
        ).toBeUndefined();
        expect(
            recordNotification("info", "D", "", 1, "javascript:alert(1)").to
        ).toBeUndefined();
        expect(recordNotification("info", "E", "").to).toBeUndefined();
        // and what was stored is checked again when it is read back
        window.localStorage.setItem(
            "__graphene__notificationHistory",
            JSON.stringify([
                {
                    id: 1,
                    at: 1,
                    kind: "info",
                    title: "F",
                    description: "",
                    seen: true,
                    to: "https://evil.example"
                },
                {
                    id: 2,
                    at: 1,
                    kind: "info",
                    title: "G",
                    description: "",
                    seen: true,
                    to: "/block/9"
                }
            ])
        );
        reloadNotifications();
        const byTitle = (title: string) =>
            getNotifications().find(i => i.title === title)!;
        expect(byTitle("F").to).toBeUndefined();
        expect(byTitle("G").to).toBe("/block/9");
    });
});
