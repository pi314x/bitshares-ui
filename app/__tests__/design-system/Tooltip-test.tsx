import * as React from "react";
import {render, fireEvent, act} from "@testing-library/react";
import {Tooltip} from "../../design-system/Tooltip";

describe("design-system/Tooltip", () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("renders its children, with no bubble visible initially", () => {
        const {getByText, queryByRole} = render(
            <Tooltip title="Helpful text">
                <button>Trigger</button>
            </Tooltip>
        );
        expect(getByText("Trigger")).toBeTruthy();
        expect(queryByRole("tooltip")).toBeNull();
    });

    it("shows the bubble after the hover delay on mouse enter", () => {
        const {getByText, queryByRole} = render(
            <Tooltip title="Helpful text" mouseEnterDelay={0.5}>
                <button>Trigger</button>
            </Tooltip>
        );
        fireEvent.mouseEnter(getByText("Trigger"));
        expect(queryByRole("tooltip")).toBeNull();

        act(() => {
            jest.advanceTimersByTime(500);
        });
        expect(getByText("Helpful text")).toBeTruthy();
    });

    it("hides the bubble on mouse leave, cancelling a pending show", () => {
        const {getByText, queryByRole} = render(
            <Tooltip title="Helpful text" mouseEnterDelay={0.5}>
                <button>Trigger</button>
            </Tooltip>
        );
        fireEvent.mouseEnter(getByText("Trigger"));
        fireEvent.mouseLeave(getByText("Trigger"));

        act(() => {
            jest.advanceTimersByTime(500);
        });
        expect(queryByRole("tooltip")).toBeNull();
    });

    it("shows on focus and hides on blur, for keyboard users", () => {
        const {getByText, queryByRole} = render(
            <Tooltip title="Helpful text" mouseEnterDelay={0}>
                <button>Trigger</button>
            </Tooltip>
        );
        fireEvent.focus(getByText("Trigger"));
        act(() => {
            jest.advanceTimersByTime(0);
        });
        expect(queryByRole("tooltip")).toBeTruthy();

        fireEvent.blur(getByText("Trigger"));
        expect(queryByRole("tooltip")).toBeNull();
    });
});
