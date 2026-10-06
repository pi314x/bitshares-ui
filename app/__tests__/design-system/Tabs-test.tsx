import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {Tabs} from "../../design-system/Tabs";

describe("design-system/Tabs", () => {
    it("shows the first pane's content by default, uncontrolled", () => {
        const {getByText, queryByText} = render(
            <Tabs>
                <Tabs.TabPane key="one" tab="One">
                    Content one
                </Tabs.TabPane>
                <Tabs.TabPane key="two" tab="Two">
                    Content two
                </Tabs.TabPane>
            </Tabs>
        );
        expect(getByText("Content one")).toBeTruthy();
        expect(queryByText("Content two")).toBeNull();
    });

    it("switches panes on tab click and calls onChange with the key", () => {
        const onChange = jest.fn();
        const {getByText, queryByText} = render(
            <Tabs onChange={onChange}>
                <Tabs.TabPane key="one" tab="One">
                    Content one
                </Tabs.TabPane>
                <Tabs.TabPane key="two" tab="Two">
                    Content two
                </Tabs.TabPane>
            </Tabs>
        );
        fireEvent.click(getByText("Two"));
        expect(onChange).toHaveBeenCalledWith("two");
        expect(getByText("Content two")).toBeTruthy();
        expect(queryByText("Content one")).toBeNull();
    });

    it("respects defaultActiveKey for the initial uncontrolled pane", () => {
        const {getByText} = render(
            <Tabs defaultActiveKey="two">
                <Tabs.TabPane key="one" tab="One">
                    Content one
                </Tabs.TabPane>
                <Tabs.TabPane key="two" tab="Two">
                    Content two
                </Tabs.TabPane>
            </Tabs>
        );
        expect(getByText("Content two")).toBeTruthy();
    });

    it("stays controlled when activeKey is passed, ignoring its own click until the prop changes", () => {
        const {getByText, rerender} = render(
            <Tabs activeKey="one" onChange={() => {}}>
                <Tabs.TabPane key="one" tab="One">
                    Content one
                </Tabs.TabPane>
                <Tabs.TabPane key="two" tab="Two">
                    Content two
                </Tabs.TabPane>
            </Tabs>
        );
        fireEvent.click(getByText("Two"));
        expect(getByText("Content one")).toBeTruthy();

        rerender(
            <Tabs activeKey="two" onChange={() => {}}>
                <Tabs.TabPane key="one" tab="One">
                    Content one
                </Tabs.TabPane>
                <Tabs.TabPane key="two" tab="Two">
                    Content two
                </Tabs.TabPane>
            </Tabs>
        );
        expect(getByText("Content two")).toBeTruthy();
    });

    it("supports destructuring TabPane off Tabs directly", () => {
        const {TabPane} = Tabs;
        const {getByText} = render(
            <Tabs>
                <TabPane key="only" tab="Only">
                    Only content
                </TabPane>
            </Tabs>
        );
        expect(getByText("Only content")).toBeTruthy();
    });
});
