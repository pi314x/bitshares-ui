// Local, dependency-free port of react-foundation-apps's
// `Notification.Static` component (docs/UI_MIGRATION_PLAN.md, Phase 9
// dependency cleanup) - the only usage of that package's `Notification`
// export anywhere in the app (grep-confirmed: `Notifier.tsx` is its one
// importer, `Notification.Set` is unused). Merges
// `notification/{notification,static}.jsx` and the relevant parts of
// `utils/animation.jsx` from that now-removed package into one function
// component, preserving:
//   - the exact DOM structure/CSS classes (`notification`, `<position>`,
//     `<color>`, `data-closable`, `is-active`, `ng-enter`/`ng-leave`/
//     `ng-enter-active`/`ng-leave-active`, `fadeIn`/`fadeOut`) - these
//     are styled by this repo's own vendored
//     `assets/stylesheets/vendors/foundation/components/_motion.scss`/
//     `_notification.scss`, never shipped by the npm package itself, so
//     removing that package doesn't touch styling. The `ng-enter`/
//     `ng-leave`/`-active` two-phase class dance is NOT vestigial -
//     `_motion.scss`'s `fade()` mixin compiles to
//     `.fadeIn.ng-enter { opacity: 0 }` /
//     `.fadeIn.ng-enter.ng-enter-active { opacity: 1 }`, so the actual
//     opacity transition only fires when both classes are present
//     together, confirmed by reading the compiled mixin output before
//     simplifying anything.
//   - the open/close pub/sub channel, via `zfApi` (`lib/common/zfApi.ts`,
//     imported here as `common/zfApi`) - itself just a direct
//     `pubsub-js` alias, not
//     Foundation-specific, so this is the same channel/messages
//     (`"open"`/`"close"`) every real caller already publishes to.
//   - the pre-existing upstream bug where the `image` prop's value was
//     never actually used as the `<img>` src (a literal, uninterpolated
//     `"{{ image }}"` string - an Angular-template leftover in the
//     original React source). Preserved rather than fixed per this
//     migration's "preserve known quirks" precedent; moot in practice
//     since this file's one real caller (`Notifier.tsx`) always passes
//     `image=""` (falsy), so this branch never renders either way.
//
// Modernized only where the original used now-unnecessary legacy-browser
// shims: vendor-prefixed transition/animation event name detection
// (`ReactTransitionEvents`, built for IE/old-Android/old-Firefox) is
// dropped for plain `transitionend`/`animationend` listeners (every
// browser/Electron version this app supports fires the unprefixed
// event), and the original's string-concatenation `csscore` class
// add/remove helper is replaced by the DOM's native `classList`.
import * as React from "react";
import zfApi from "common/zfApi";

export interface FoundationNotificationProps {
    id: string;
    title?: React.ReactNode;
    image?: string;
    position?: string;
    color?: string;
    className?: string;
    wrapperElement?: any;
    children?: React.ReactNode;
}

const ANIMATION_IN = "fadeIn";
const ANIMATION_OUT = "fadeOut";

function resetNode(node: HTMLElement) {
    // Matches the original's `reset()`: force the transition-duration to
    // 0 (so the next class change below doesn't itself animate) and
    // strip every enter/leave/animation class back to a clean slate.
    node.style.transitionDuration = "0";
    node.classList.remove(
        "ng-enter",
        "ng-leave",
        "ng-enter-active",
        "ng-leave-active",
        ANIMATION_IN,
        ANIMATION_OUT
    );
}

export default function FoundationNotification({
    id,
    title = null,
    image = "",
    position = "top-right",
    color = "success",
    className = "",
    wrapperElement = "p",
    children
}: FoundationNotificationProps) {
    const [open, setOpen] = React.useState(false);
    const nodeRef = React.useRef<HTMLDivElement | null>(null);

    React.useEffect(() => {
        const token = zfApi.subscribe(id, (name: string, msg: string) => {
            if (msg === "open") {
                setOpen(true);
            } else if (msg === "close") {
                setOpen(false);
            }
        });
        return () => zfApi.unsubscribe(token);
    }, [id]);

    // The original's Animation only ran on `componentDidUpdate` (an
    // `active` prop change), never on mount - this ref replicates that
    // mount-skip.
    const mountedRef = React.useRef(false);
    React.useEffect(() => {
        const node = nodeRef.current;
        if (!node) return;
        if (!mountedRef.current) {
            mountedRef.current = true;
            return;
        }

        const animationType = open ? "enter" : "leave";
        const animationClass = open ? ANIMATION_IN : ANIMATION_OUT;
        const initClass = `ng-${animationType}`;
        const activeClass = `${initClass}-active`;

        resetNode(node);
        node.classList.add(animationClass, initClass, "is-active");

        // Force a reflow so the class changes above and the
        // transition-triggering class added below land in separate
        // frames - otherwise the browser coalesces them and the
        // transition never visually runs (same as the original's
        // `reflow()` + the deferred `transitionDuration = ''`).
        void node.offsetWidth;
        node.style.transitionDuration = "";
        node.classList.add(activeClass);

        const finish = () => {
            resetNode(node);
            if (!open) {
                node.classList.remove("is-active");
            }
            void node.offsetWidth;
            node.removeEventListener("transitionend", finish);
            node.removeEventListener("animationend", finish);
        };
        node.addEventListener("transitionend", finish);
        node.addEventListener("animationend", finish);

        return () => {
            node.removeEventListener("transitionend", finish);
            node.removeEventListener("animationend", finish);
        };
    }, [open]);

    const classes = ["notification", position, color, className]
        .filter(Boolean)
        .join(" ");

    const closeHandler = (e: React.MouseEvent) => {
        setOpen(false);
        e.preventDefault();
        e.stopPropagation();
    };

    return (
        <div ref={nodeRef} id={id} data-closable={true} className={classes}>
            <a href="#" className="close-button" onClick={closeHandler}>
                &times;
            </a>
            {image ? (
                <div className="notification-icon">
                    {/* Preserved upstream bug: never actually used the
                        `image` prop, see this file's header comment. */}
                    <img src="{{ image }}" />
                </div>
            ) : null}
            <div className="notification-content">
                <h1>{title}</h1>
                {React.createElement(wrapperElement, null, children)}
            </div>
        </div>
    );
}
