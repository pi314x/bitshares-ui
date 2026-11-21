import {toastFromNotification} from "../../lib/common/toastFromNotification";

const element = {type: "div", props: {children: "Transaction confirmed"}};

describe("toastFromNotification", () => {
    it("shows the message", () => {
        expect(
            toastFromNotification({level: "success", message: "Done"})
        ).toEqual({
            level: "success",
            message: "Done",
            description: undefined,
            duration: 10
        });
    });

    it("puts the title first and the message under it", () => {
        const toast = toastFromNotification({
            level: "warning",
            title: "Order",
            message: "placed"
        });
        expect(toast.message).toBe("Order");
        expect(toast.description).toBe("placed");
    });

    // the confirmation of a transaction sends only a React element as `children`: the conversion
    // dropped it, a toast and an entry under the bell with nothing in them
    it("shows the element a sender gives as children when there is no message", () => {
        const toast = toastFromNotification({
            level: "success",
            children: element,
            autoDismiss: 3
        });
        expect(toast.message).toBe(element);
        expect(toast.description).toBeUndefined();
        expect(toast.duration).toBe(3);
    });

    it("prefers a message to children", () => {
        expect(
            toastFromNotification({message: "Message", children: element})
                .message
        ).toBe("Message");
    });

    it("turns the HTML of a legacy message into text, and an unknown level into info", () => {
        const toast = toastFromNotification(
            {level: "bogus", message: "<b>Bold</b>"},
            html => html.replace(/<[^>]*>/g, "")
        );
        expect(toast.message).toBe("Bold");
        expect(toast.level).toBe("info");
    });
});
