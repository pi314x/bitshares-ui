import * as React from "react";
import {render, fireEvent, act} from "@testing-library/react";
import {Popover} from "../../design-system/Popover";

describe("design-system/Popover", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("shows content on hover after mouseEnterDelay and hides on mouse leave", () => {
        const {getByText, queryByText} = render(
            <Popover content="Details" mouseEnterDelay={0.5}>
                <span>Trigger</span>
            </Popover>
        );
        expect(queryByText("Details")).toBeNull();

        fireEvent.mouseEnter(getByText("Trigger"));
        act(() => {
            jest.advanceTimersByTime(499);
        });
        expect(queryByText("Details")).toBeNull();

        act(() => {
            jest.advanceTimersByTime(1);
        });
        expect(getByText("Details")).toBeTruthy();

        fireEvent.mouseLeave(getByText("Trigger"));
        expect(queryByText("Details")).toBeNull();
    });

    it("shows an optional title header alongside content", () => {
        const {getByText} = render(
            <Popover content="Body" title="Heading" mouseEnterDelay={0}>
                <span>Trigger</span>
            </Popover>
        );
        fireEvent.mouseEnter(getByText("Trigger"));
        act(() => {
            jest.advanceTimersByTime(0);
        });
        expect(getByText("Heading")).toBeTruthy();
        expect(getByText("Body")).toBeTruthy();
    });

    it("toggles open/closed on click when trigger is click, ignoring hover", () => {
        const {getByText, queryByText} = render(
            <Popover content="Details" trigger="click">
                <span>Trigger</span>
            </Popover>
        );
        fireEvent.mouseEnter(getByText("Trigger"));
        act(() => {
            jest.advanceTimersByTime(1000);
        });
        expect(queryByText("Details")).toBeNull();

        fireEvent.click(getByText("Trigger"));
        expect(getByText("Details")).toBeTruthy();

        fireEvent.click(getByText("Trigger"));
        expect(queryByText("Details")).toBeNull();
    });

    it("calls onVisibleChange on open and close, uncontrolled", () => {
        const onVisibleChange = jest.fn();
        const {getByText} = render(
            <Popover
                content="Details"
                trigger="click"
                onVisibleChange={onVisibleChange}
            >
                <span>Trigger</span>
            </Popover>
        );
        fireEvent.click(getByText("Trigger"));
        expect(onVisibleChange).toHaveBeenLastCalledWith(true);
        expect(getByText("Details")).toBeTruthy();

        fireEvent.click(getByText("Trigger"));
        expect(onVisibleChange).toHaveBeenLastCalledWith(false);
    });

    it("stays controlled by the visible prop, ignoring its own click toggle", () => {
        const onVisibleChange = jest.fn();
        const {getByText, queryByText} = render(
            <Popover
                content="Details"
                trigger="click"
                visible={true}
                onVisibleChange={onVisibleChange}
            >
                <span>Trigger</span>
            </Popover>
        );
        expect(getByText("Details")).toBeTruthy();

        fireEvent.click(getByText("Trigger"));
        // Controlled: a click still fires the callback, but the popover
        // stays open until the caller passes visible={false} itself.
        expect(onVisibleChange).toHaveBeenLastCalledWith(false);
        expect(queryByText("Details")).toBeTruthy();
    });

    it("closes a click-triggered popover on an outside click", () => {
        const {getByText, queryByText} = render(
            <div>
                <Popover content="Details" trigger="click">
                    <span>Trigger</span>
                </Popover>
                <div>Outside</div>
            </div>
        );
        fireEvent.click(getByText("Trigger"));
        expect(getByText("Details")).toBeTruthy();

        fireEvent.mouseDown(getByText("Outside"));
        expect(queryByText("Details")).toBeNull();
    });
});
