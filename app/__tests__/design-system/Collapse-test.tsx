import * as React from "react";
import {render, fireEvent} from "@testing-library/react";
import {Collapse} from "../../design-system/Collapse";

describe("design-system/Collapse", () => {
    it("starts with every panel collapsed, uncontrolled", () => {
        const {queryByText} = render(
            <Collapse>
                <Collapse.Panel key="one" header="One">
                    Content one
                </Collapse.Panel>
                <Collapse.Panel key="two" header="Two">
                    Content two
                </Collapse.Panel>
            </Collapse>
        );
        expect(queryByText("Content one")).toBeNull();
        expect(queryByText("Content two")).toBeNull();
    });

    it("expands a panel on header click, and allows more than one open at once", () => {
        const {getByText} = render(
            <Collapse>
                <Collapse.Panel key="one" header="One">
                    Content one
                </Collapse.Panel>
                <Collapse.Panel key="two" header="Two">
                    Content two
                </Collapse.Panel>
            </Collapse>
        );
        fireEvent.click(getByText("One"));
        expect(getByText("Content one")).toBeTruthy();
        fireEvent.click(getByText("Two"));
        expect(getByText("Content one")).toBeTruthy();
        expect(getByText("Content two")).toBeTruthy();
    });

    it("collapses an already-open panel on a second click", () => {
        const {getByText, queryByText} = render(
            <Collapse>
                <Collapse.Panel key="one" header="One">
                    Content one
                </Collapse.Panel>
            </Collapse>
        );
        fireEvent.click(getByText("One"));
        expect(getByText("Content one")).toBeTruthy();
        fireEvent.click(getByText("One"));
        expect(queryByText("Content one")).toBeNull();
    });

    it("stays controlled when activeKey is passed, calling onChange instead of toggling itself", () => {
        const onChange = jest.fn();
        const {getByText, queryByText, rerender} = render(
            <Collapse activeKey={[]} onChange={onChange}>
                <Collapse.Panel key="one" header="One">
                    Content one
                </Collapse.Panel>
            </Collapse>
        );
        fireEvent.click(getByText("One"));
        expect(onChange).toHaveBeenCalledWith(["one"]);
        expect(queryByText("Content one")).toBeNull();

        rerender(
            <Collapse activeKey={["one"]} onChange={onChange}>
                <Collapse.Panel key="one" header="One">
                    Content one
                </Collapse.Panel>
            </Collapse>
        );
        expect(getByText("Content one")).toBeTruthy();
    });

    it("renders extra content next to the header without collapsing it", () => {
        const {getByText} = render(
            <Collapse>
                <Collapse.Panel key="one" header="One" extra="Extra">
                    Content one
                </Collapse.Panel>
            </Collapse>
        );
        expect(getByText("Extra")).toBeTruthy();
    });

    it("hides the expand arrow when showArrow is false", () => {
        const {container} = render(
            <Collapse>
                <Collapse.Panel key="one" header="One" showArrow={false}>
                    Content one
                </Collapse.Panel>
            </Collapse>
        );
        expect(container.querySelector("[aria-hidden]")).toBeNull();
    });

    it("falls back to position-based keys when panels have no explicit key", () => {
        const {getByText, queryByText} = render(
            <Collapse>
                <Collapse.Panel header="One">Content one</Collapse.Panel>
                <Collapse.Panel header="Two">Content two</Collapse.Panel>
            </Collapse>
        );
        fireEvent.click(getByText("One"));
        expect(getByText("Content one")).toBeTruthy();
        expect(queryByText("Content two")).toBeNull();
    });

    it("supports destructuring Panel off Collapse directly", () => {
        const {Panel} = Collapse;
        const {getByText} = render(
            <Collapse>
                <Panel key="only" header="Only">
                    Only content
                </Panel>
            </Collapse>
        );
        fireEvent.click(getByText("Only"));
        expect(getByText("Only content")).toBeTruthy();
    });
});
