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
    open: boolean;
    /** Omit to render a modal with no built-in way to dismiss itself
     * (the close button, Escape key, and backdrop click all no-op) -
     * useful for a flow that must run to completion (see Button.tsx's
     * `disabled` precedent for "omit the handler, not a separate flag"). */
    onClose?: () => void;
    title?: React.ReactNode;
    footer?: React.ReactNode;
    width?: number | string;
    /** Shows the built-in `×` button. Default true; has no effect
     * without `onClose`. */
    closable?: boolean;
    children?: React.ReactNode;
}

// First component of the design system's Modal (docs/UI_MIGRATION_PLAN.md,
// the bitshares-ui-style-guide replacement effort) - establishes the
// pattern (portal to `document.body`, `useClickOutside` for backdrop-
// click/Escape, CSS Modules + theme tokens) later components in this
// family (Form, Select, Table, ...) will follow. Not yet wired into any
// real screen - call sites still use bitshares-ui-style-guide's `Modal`
// (antd v3) until they're migrated to this one file by file, the same
// strangler-fig pattern every other phase of this migration has used.
//
// Deliberately minimal next to antd v3's `Modal`: no built-in open/close
// transition (this design system has no animation primitives yet), no
// full focus-trap cycling (focus moves to the dialog on open and returns
// to the trigger on close, but Tab doesn't wrap within the dialog yet -
// flagged here for a follow-up once a real screen's keyboard-navigation
// needs make the gap concrete rather than speculative).
export function Modal({
    open,
    onClose,
    title,
    footer,
    width,
    closable = true,
    children
}: ModalProps): JSX.Element | null {
    const dialogRef = useClickOutside<HTMLDivElement>(
        () => onClose && onClose(),
        open
    );
    const titleId = useStableId("modal-title");
    const triggerRef = React.useRef<Element | null>(null);

    React.useEffect(() => {
        if (!open) return;
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
    }, [open]);

    if (!open) return null;

    return ReactDOM.createPortal(
        <div className={styles.backdrop}>
            <div
                className={styles.dialog}
                style={width !== undefined ? {width} : undefined}
                role="dialog"
                aria-modal="true"
                aria-labelledby={title !== undefined ? titleId : undefined}
                tabIndex={-1}
                ref={dialogRef}
            >
                {title !== undefined || (closable && onClose) ? (
                    <div className={styles.header}>
                        {title !== undefined ? (
                            <h3 id={titleId} className={styles.title}>
                                {title}
                            </h3>
                        ) : (
                            <span />
                        )}
                        {closable && onClose ? (
                            <button
                                type="button"
                                className={styles.closeButton}
                                aria-label="Close"
                                onClick={onClose}
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
