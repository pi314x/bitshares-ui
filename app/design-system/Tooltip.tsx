import * as React from "react";
import styles from "./Tooltip.module.scss";

export type TooltipPlacement =
    | "top"
    | "bottom"
    | "left"
    | "right"
    | "topLeft"
    | "topRight";

export interface TooltipProps {
    title: React.ReactNode;
    placement?: TooltipPlacement;
    /** Hover delay before showing, in seconds (matches the antd v3
     * convention every real call site already used this prop with -
     * `0.5` was the one value ever passed). */
    mouseEnterDelay?: number;
    className?: string;
    /** Applied to this component's own wrapping `<span>`, not its
     * `children` - antd forwards unrecognized props the same way, onto
     * its own trigger wrapper; real at one call site
     * (`Dashboard/MarketsTable.tsx`'s show/hide-market toggle, which
     * puts the click target and a margin reset on the `Tooltip` itself
     * rather than its `Icon` child). */
    style?: React.CSSProperties;
    onClick?: (event: React.MouseEvent<HTMLSpanElement>) => void;
    children: React.ReactNode;
}

// Second component of the design system's bitshares-ui-style-guide
// replacement (docs/UI_MIGRATION_PLAN.md), following `Modal.tsx`'s
// precedent. Not yet wired into any real screen.
//
// Deliberately wraps `children` in its own `<span>` rather than cloning
// props onto the child element (`React.cloneElement`) - simpler and
// avoids ref-forwarding edge cases for arbitrary children (a `<Button>`,
// an icon, plain text), at the cost of adding one extra inline-block
// element to the DOM, same tradeoff this design system already made
// for `AccountSwitcher`'s trigger wrapper.
//
// Positioned with plain CSS (`position: absolute` relative to the
// wrapper), not a portal - this project has no viewport-aware
// positioning library (Floating UI / Popper) as a dependency, and
// adding one for a tooltip wasn't judged worth it. Known limitation,
// same caveat any plain-CSS tooltip has: it can clip or mis-position
// near the edge of a scrollable/`overflow: hidden` ancestor. Flagged
// here rather than solved speculatively, same as `Modal.tsx`'s
// focus-trap gap - revisit if a migrated screen's real layout hits it.
export function Tooltip({
    title,
    placement = "top",
    mouseEnterDelay = 0.1,
    className,
    style,
    onClick,
    children
}: TooltipProps): JSX.Element {
    const [visible, setVisible] = React.useState(false);
    const showTimeoutRef = React.useRef<ReturnType<typeof setTimeout>>();

    const show = () => {
        clearTimeout(showTimeoutRef.current);
        showTimeoutRef.current = setTimeout(
            () => setVisible(true),
            mouseEnterDelay * 1000
        );
    };

    const hide = () => {
        clearTimeout(showTimeoutRef.current);
        setVisible(false);
    };

    React.useEffect(() => () => clearTimeout(showTimeoutRef.current), []);

    const wrapClasses = [styles.wrap, className].filter(Boolean).join(" ");
    const bubbleClasses = [styles.bubble, styles[placement]]
        .filter(Boolean)
        .join(" ");

    return (
        <span
            className={wrapClasses}
            style={style}
            onClick={onClick}
            onMouseEnter={show}
            onMouseLeave={hide}
            onFocus={show}
            onBlur={hide}
        >
            {children}
            {visible && title ? (
                <span className={bubbleClasses} role="tooltip">
                    {title}
                </span>
            ) : null}
        </span>
    );
}
