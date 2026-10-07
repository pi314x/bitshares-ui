import * as React from "react";
import ReactDOM from "react-dom";
import styles from "./Modal.module.scss";
import {useClickOutside} from "../next/hooks/useClickOutside";

// React 16 (this project's version, see AGENTS.md) has no `useId()`
// (React 18+ only) - a plain incrementing counter captured once per
// instance via `useRef`'s lazy initializer is the equivalent.
let nextModalId = 0;
function useStableId(prefix: string): string {
    const idRef = React.useRef<string>();
    if (idRef.current === undefined) {
        idRef.current = `${prefix}-${++nextModalId}`;
    }
    return idRef.current;
}

export interface ModalProps {
    visible: boolean;
    /** Omit to render a modal with no built-in way to dismiss itself
     * (the close button, Escape key, and backdrop click all no-op) -
     * useful for a flow that must run to completion (see Button.tsx's
     * `disabled` precedent for "omit the handler, not a separate flag"). */
    onCancel?: (event?: React.MouseEvent | React.KeyboardEvent) => void;
    title?: React.ReactNode;
    footer?: React.ReactNode;
    width?: number | string;
    /** Shows the built-in `×` button. Default true; has no effect
     * without `onCancel`. */
    closable?: boolean;
    /** Applied to the outer backdrop/wrapper element, matching antd's
     * own `wrapClassName` (as opposed to `className`, which applies to
     * the dialog box itself). */
    wrapClassName?: string;
    className?: string;
    /** Accepted for API compatibility (one real call site sets it,
     * `Modal/DepositModal.tsx`) but a no-op: this component already
     * unmounts its content whenever `visible` is false (a plain
     * conditional `return null`, not a hide-via-CSS toggle), which is
     * `destroyOnClose`'s effect already, unconditionally. */
    destroyOnClose?: boolean;
    children?: React.ReactNode;
}

// First component of the design system's Modal (docs/UI_MIGRATION_PLAN.md,
// the bitshares-ui-style-guide replacement effort) - establishes the
// pattern (portal to `document.body`, `useClickOutside` for backdrop-
// click/Escape, CSS Modules + theme tokens) later components in this
// family followed.
//
// Prop names (`visible`/`onCancel`, not `open`/`onClose`) were corrected
// during the call-site migration phase, not this component's original
// build: the first pass used `open`/`onClose` without checking real
// usage first (an exception to this whole migration's established
// grep-before-building rule, since Modal predates it), and the mismatch
// only surfaced once a real file's `visible={...}`/`onCancel={...}`
// JSX failed to type-check against it. A full prop audit at that point
// (parsing every real `<Modal ...>` opening tag across all 67
// bitshares-ui-style-guide-Modal-importing files, not just grepping
// prop names in isolation, since a naive grep over-counts matches
// inside a `footer={[<Button key=... onClick=... />]}` array) found
// `visible`/`onCancel`/`title`/`footer`/`closable`/`wrapClassName`/
// `className`/`width`/`destroyOnClose` as the real, live surface.
// Checked directly against antd's source rather than assumed:
// `bitshares-ui-style-guide`'s own `Modal` is a bare `export {Modal} from
// "antd"` re-export (`bitshares-ui-style-guide/app/bitshares-ui-style-guide/Modal/index.js`),
// and antd's `Modal.js` spreads every prop it doesn't itself recognize
// straight through to `rc-dialog`'s `Dialog` - but `Dialog`'s own
// implementation never reads arbitrary passthrough props, only the
// specific ones it's written to use. That confirms several frequently-
// used real props (`overlay`, used 35 times; `id`, 28; `noCloseBtn`,
// `overlayClose`, `closeable`, `modalHeader`, `noHeaderContainer`, a few
// each) were always inert dead code under the real antd Modal already
// running in production - not part of this component's API, and dropped
// (not migrated) at each real call site as confirmed-dead.
//
// Deliberately minimal next to antd v3's `Modal`: no built-in open/close
// transition (this design system has no animation primitives yet), no
// full focus-trap cycling (focus moves to the dialog on open and returns
// to the trigger on close, but Tab doesn't wrap within the dialog yet -
// flagged here for a follow-up once a real screen's keyboard-navigation
// needs make the gap concrete rather than speculative), no `onOk`/
// `okText`/`cancelText`/`maskClosable`/`centered`/`afterClose` (all
// confirmed unused by any real call site via the same prop audit).
export function Modal({
    visible,
    onCancel,
    title,
    footer,
    width,
    closable = true,
    wrapClassName,
    className,
    children
}: ModalProps): JSX.Element | null {
    const dialogRef = useClickOutside<HTMLDivElement>(
        () => onCancel && onCancel(),
        visible
    );
    const titleId = useStableId("modal-title");
    const triggerRef = React.useRef<Element | null>(null);

    React.useEffect(() => {
        if (!visible) return;
        triggerRef.current = document.activeElement;
        dialogRef.current?.focus();

        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = previousOverflow;
            if (triggerRef.current instanceof HTMLElement) {
                triggerRef.current.focus();
            }
        };
    }, [visible]);

    if (!visible) return null;

    return ReactDOM.createPortal(
        <div
            className={[styles.backdrop, wrapClassName]
                .filter(Boolean)
                .join(" ")}
        >
            <div
                className={[styles.dialog, className]
                    .filter(Boolean)
                    .join(" ")}
                style={width !== undefined ? {width} : undefined}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title !== undefined ? titleId : undefined}
                tabIndex={-1}
                ref={dialogRef}
            >
                {title !== undefined || (closable && onCancel) ? (
                    <div className={styles.header}>
                        {title !== undefined ? (
                            <h3 id={titleId} className={styles.title}>
                                {title}
                            </h3>
                        ) : (
                            <span />
                        )}
                        {closable && onCancel ? (
                            <button
                                type="button"
                                className={styles.closeButton}
                                aria-label="Close"
                                onClick={onCancel}
                            >
                                ×
                            </button>
                        ) : null}
                    </div>
                ) : null}
                <div className={styles.body}>{children}</div>
                {footer !== undefined ? (
                    <div className={styles.footer}>{footer}</div>
                ) : null}
            </div>
        </div>,
        document.body
    );
}
