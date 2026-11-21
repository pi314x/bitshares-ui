import * as React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {PhoneTradeLayout} from "../../components/Exchange/PhoneTradeLayout";

const layout = (activeView: string, activeOwn: string) =>
    renderToStaticMarkup(
        <PhoneTradeLayout
            views={[
                {key: "chart", label: "Price Chart", content: <i>CHART</i>},
                {key: "book", label: "Order Book", content: <i>BOOK</i>}
            ]}
            activeView={activeView}
            onView={() => undefined}
            formTitle="Order Form"
            form={<i>FORM</i>}
            own={[
                {
                    key: "orders",
                    label: "My open orders",
                    content: <i>ORDERS</i>
                },
                {key: "trades", label: "My trades", content: <i>TRADES</i>}
            ]}
            activeOwn={activeOwn}
            onOwn={() => undefined}
        />
    );

describe("PhoneTradeLayout", () => {
    it("shows one market view, the order form and one own list", () => {
        const html = layout("chart", "orders");
        expect(html).toContain("CHART");
        expect(html).not.toContain("BOOK");
        expect(html).toContain("FORM");
        expect(html).toContain("ORDERS");
        expect(html).not.toContain("TRADES");
        expect(html).toContain("Order Form");
    });

    it("shows the view that is chosen", () => {
        const html = layout("book", "trades");
        expect(html).toContain("BOOK");
        expect(html).not.toContain("CHART");
        expect(html).toContain("TRADES");
        expect(html).not.toContain("ORDERS");
    });

    it("falls back to the first entry for a key that is not offered", () => {
        // e.g. the settlement list disappears when the market has no settle orders
        const html = layout("gone", "gone");
        expect(html).toContain("CHART");
        expect(html).toContain("ORDERS");
    });
});
