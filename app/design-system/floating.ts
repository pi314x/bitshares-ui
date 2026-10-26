// Where a tooltip or popover goes. Both used to be placed with CSS inside their trigger's
// parent, so any `overflow: hidden` ancestor cut them (on a phone the bubble of a warning icon
// at the left of a list was clipped by the panel, and its words were half gone). They are now
// drawn in the page's body at a fixed position worked out here from where the trigger is on the
// screen: on the preferred side when it fits, else the opposite one, always inside the screen.
import * as React from "react";

export type FloatingPlacement =
    | "top"
    | "bottom"
    | "left"
    | "right"
    | "topLeft"
    | "topRight";

export interface Rect {
    left: number;
    top: number;
    right: number;
    bottom: number;
}

export interface Size {
    width: number;
    height: number;
}

/** the space kept between a bubble and the trigger, and between a bubble and the screen's edge */
export const GAP = 8;
export const MARGIN = 8;

const clamp = (value: number, low: number, high: number) =>
    Math.min(Math.max(value, low), Math.max(low, high));

/**
 * The top-left corner of a bubble of `size` for `trigger` on a screen of `view`, in screen
 * coordinates. A side with no room gives way to the opposite one when that has room; the
 * result never leaves the screen (a bubble wider than the screen is the caller's to narrow).
 */
export function placeFloating(
    trigger: Rect,
    size: Size,
    placement: FloatingPlacement,
    view: Size
): {left: number; top: number} {
    const centerX = (trigger.left + trigger.right) / 2;
    const centerY = (trigger.top + trigger.bottom) / 2;
    let side: "top" | "bottom" | "left" | "right" =
        placement === "topLeft" || placement === "topRight" ? "top" : placement;

    // flip to the other side when the preferred one has no room and the other has
    const above = trigger.top - GAP - size.height;
    const below = trigger.bottom + GAP;
    const before = trigger.left - GAP - size.width;
    const after = trigger.right + GAP;
    if (
        side === "top" &&
        above < MARGIN &&
        below + size.height <= view.height - MARGIN
    ) {
        side = "bottom";
    } else if (
        side === "bottom" &&
        below + size.height > view.height - MARGIN &&
        above >= MARGIN
    ) {
        side = "top";
    } else if (
        side === "left" &&
        before < MARGIN &&
        after + size.width <= view.width - MARGIN
    ) {
        side = "right";
    } else if (
        side === "right" &&
        after + size.width > view.width - MARGIN &&
        before >= MARGIN
    ) {
        side = "left";
    }

    let left: number;
    let top: number;
    if (side === "top" || side === "bottom") {
        top = side === "top" ? above : below;
        left =
            placement === "topLeft"
                ? trigger.left
                : placement === "topRight"
                ? trigger.right - size.width
                : centerX - size.width / 2;
    } else {
        left = side === "left" ? before : after;
        top = centerY - size.height / 2;
    }
    return {
        left: clamp(left, MARGIN, view.width - size.width - MARGIN),
        top: clamp(top, MARGIN, view.height - size.height - MARGIN)
    };
}

/**
 * The refs and the style of a bubble drawn at a fixed place next to its trigger while
 * `visible`. The bubble is hidden until it has been measured and placed (one layout pass,
 * before anything is painted), and is placed again when the page scrolls or resizes.
 */
export function useFloating(visible: boolean, placement: FloatingPlacement) {
    const triggerRef = React.useRef<HTMLSpanElement>(null);
    const bubbleRef = React.useRef<HTMLSpanElement>(null);
    const [position, setPosition] = React.useState<{
        left: number;
        top: number;
    } | null>(null);

    React.useLayoutEffect(() => {
        if (!visible) {
            setPosition(null);
            return;
        }
        const update = () => {
            const trigger = triggerRef.current;
            const bubble = bubbleRef.current;
            if (!trigger || !bubble) return;
            const box = trigger.getBoundingClientRect();
            setPosition(
                placeFloating(
                    box,
                    {width: bubble.offsetWidth, height: bubble.offsetHeight},
                    placement,
                    {
                        width: document.documentElement.clientWidth,
                        height: document.documentElement.clientHeight
                    }
                )
            );
        };
        update();
        // any scrolling box moves the trigger: capture, not just the window
        window.addEventListener("scroll", update, true);
        window.addEventListener("resize", update);
        return () => {
            window.removeEventListener("scroll", update, true);
            window.removeEventListener("resize", update);
        };
    }, [visible, placement]);

    const style: React.CSSProperties = {
        position: "fixed",
        left: position ? position.left : 0,
        top: position ? position.top : 0,
        visibility: position ? "visible" : "hidden"
    };
    return {triggerRef, bubbleRef, style};
}
