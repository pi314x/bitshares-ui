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

    it("applies style and onClick to its own wrapper, not the children", () => {
        const onClick = jest.fn();
        const {getByText} = render(
            <Tooltip
                title="Helpful text"
                style={{marginRight: 0}}
                onClick={onClick}
            >
                <span>Trigger</span>
            </Tooltip>
        );
        const wrapper = getByText("Trigger").parentElement as HTMLElement;
        expect(wrapper.style.marginRight).toBe("0px");
        fireEvent.click(wrapper);
        expect(onClick).toHaveBeenCalled();
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

    it("draws the bubble in the page body, so a clipping ancestor cannot cut it, and keeps it on screen", () => {
        // the trigger sits at the very left of the screen (a list's warning icon on a phone)
        const original = HTMLElement.prototype.getBoundingClientRect;
        HTMLElement.prototype.getBoundingClientRect = function() {
            return {
                left: 4,
                right: 24,
                top: 300,
                bottom: 320,
                width: 20,
                height: 20,
                x: 4,
                y: 300,
                toJSON: () => ({})
            } as DOMRect;
        };
        const widthProp = Object.getOwnPropertyDescriptor(
            HTMLElement.prototype,
            "offsetWidth"
        );
        Object.defineProperty(HTMLElement.prototype, "offsetWidth", {
            configurable: true,
            get: () => 200
        });
        try {
            const {container, getByText, getByRole} = render(
                <div style={{overflow: "hidden"}}>
                    <Tooltip title="Helpful text" mouseEnterDelay={0}>
                        <button>Trigger</button>
                    </Tooltip>
                </div>
            );
            fireEvent.mouseEnter(getByText("Trigger"));
            act(() => {
                jest.advanceTimersByTime(0);
            });
            const bubble = getByRole("tooltip");
            // not inside the clipping box
            expect(container.contains(bubble)).toBe(false);
            expect(bubble.parentElement).toBe(document.body);
            // fixed, and its left edge inside the screen (not centred on a trigger 4px from it)
            expect(bubble.style.position).toBe("fixed");
            expect(parseFloat(bubble.style.left)).toBeGreaterThanOrEqual(8);
            expect(bubble.style.visibility).toBe("visible");
        } finally {
            HTMLElement.prototype.getBoundingClientRect = original;
            if (widthProp) {
                Object.defineProperty(
                    HTMLElement.prototype,
                    "offsetWidth",
                    widthProp
                );
            }
        }
    });
});
