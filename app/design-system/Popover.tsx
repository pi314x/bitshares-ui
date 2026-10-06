import * as React from "react";
import styles from "./Popover.module.scss";
import {useClickOutside} from "../next/hooks/useClickOutside";

export type PopoverPlacement = "top" | "bottom" | "left" | "right";

export interface PopoverProps {
    content: React.ReactNode;
    title?: React.ReactNode;
    placement?: PopoverPlacement;
    /** Default `"hover"`, matching antd. `"click"` toggles on click and
     * closes on an outside click, the one real call site that needs it
     * (`Utility/FormattedAsset.tsx`). */
    trigger?: "hover" | "click";
    /** Hover delay before showing, in seconds. Matches `Tooltip`'s
     * default/convention. */
    mouseEnterDelay?: number;
    className?: string;
    /** Controls open/closed state externally - when provided, this
     * component no longer manages its own visibility from hover/click,
     * only calls `onVisibleChange` so the caller can. Real at one call
     * site (`Exchange/BuySell.tsx`'s quick-deposit popover, `trigger=
     * "click"` with `visible`/`onVisibleChange` both set - though
     * nothing there ever drives `visible` from outside the callback
     * itself, so this is "controlled" in shape only; still implemented
     * as genuinely controlled, matching antd's own contract, rather
     * than assuming that'll always hold). */
    visible?: boolean;
    /** Fires whenever this popover opens or closes, however triggered
     * (hover, click, or an outside click while open) - real at the
     * same call site, used there to re-run `ReactTooltip.rebuild()`
     * once newly-shown nested tooltips exist in the DOM. */
    onVisibleChange?: (visible: boolean) => void;
    children: React.ReactNode;
}

// Fourteenth component of the design system's bitshares-ui-style-guide
// replacement (docs/UI_MIGRATION_PLAN.md), following `Modal`/`Tooltip`/
// `Input`/`Form`/`Select`/`Icon`/`Notification`/`Table`/`Row`/`Col`/
// `Radio`/`Switch`/`Card`'s precedent. Replaces `bitshares-ui-style-guide`'s
// `Popover` (antd v3) - not to be confused with `Utility/FormattedPrice.tsx`'s
// unrelated `Popover` import, which comes from the separate `react-popover`
// package and isn't part of `bitshares-ui-style-guide` at all.
//
// Grepped every real call site before designing this: `content` (always),
// an optional `title` header (about half of real call sites), `placement`
// of `"top"`/`"bottom"`/`"left"`/`"right"` only (no `topLeft`-style
// corner placements, unlike `Tooltip`), `trigger` of `"hover"` (the
// default, explicit at one call site) or `"click"` (one real call site),
// and `mouseEnterDelay={0.5}` at the two call sites that set it.
//
// Built as `Tooltip`'s sibling rather than sharing one implementation:
// unlike `Tooltip`, real `content` here is sometimes interactive (a link,
// in `Explorer/Witnesses.tsx`) and one call site needs click-to-open/
// click-outside-to-close instead of hover - different enough interaction
// and pointer-events needs that forcing both into one component would
// have meant threading a `title`/interactive-content/trigger-mode branch
// through `Tooltip`'s simpler hover-only model.
export function Popover({
    content,
    title,
    placement = "top",
    trigger = "hover",
    mouseEnterDelay = 0.1,
    className,
    visible: visibleProp,
    onVisibleChange,
    children
}: PopoverProps): JSX.Element {
    const [internalVisible, setInternalVisible] = React.useState(false);
    const visible =
        visibleProp !== undefined ? visibleProp : internalVisible;
    const showTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>();

    function setVisible(next: boolean) {
        if (visibleProp === undefined) setInternalVisible(next);
        if (onVisibleChange) onVisibleChange(next);
    }

    const ref = useClickOutside<HTMLSpanElement>(
        () => setVisible(false),
        trigger === "click" && visible
    );

    function show() {
        if (trigger !== "hover") return;
        clearTimeout(showTimeoutRef.current);
        showTimeoutRef.current = setTimeout(
            () => setVisible(true),
            mouseEnterDelay * 1000
        );
    }

    function hide() {
        if (trigger !== "hover") return;
        clearTimeout(showTimeoutRef.current);
        setVisible(false);
    }

    function toggleOnClick() {
        if (trigger !== "click") return;
        setVisible(!visible);
    }

    React.useEffect(() => () => clearTimeout(showTimeoutRef.current), []);

    const wrapClasses = [styles.wrap, className].filter(Boolean).join(" ");
    const bubbleClasses = [styles.bubble, styles[placement]]
        .filter(Boolean)
        .join(" ");

    return (
        <span
            ref={ref}
            className={wrapClasses}
            onMouseEnter={show}
            onMouseLeave={hide}
            onClick={toggleOnClick}
        >
            {children}
            {visible ? (
                <span className={bubbleClasses} role="tooltip">
                    {title !== undefined ? (
                        <span className={styles.titleRow}>{title}</span>
                    ) : null}
                    <span className={styles.content}>{content}</span>
                </span>
            ) : null}
        </span>
    );
}
