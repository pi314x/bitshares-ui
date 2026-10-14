import * as React from "react";
import ReactDOM from "react-dom";
import styles from "./Modal.module.scss";

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

// A modal can be shown as part of the page instead of over it. Wrap it in
// `ModalAsPage` and the first `Modal` below renders in place: no backdrop, no
// scroll lock, no Escape handling, the page's own width. The Send, Deposit and
// Withdraw screens are the same dialogs this way, reached from the menu rather
// than opening over whatever was on screen. A `Modal` nested inside it (a
// confirmation, a QR code) is an ordinary overlay again.
const PagePresentation = React.createContext<boolean>(false);
// Set below a dialog that is shown in the page: what opens from inside it
// (a QR code over the transaction to confirm) is an overlay, but not "another
// dialog over the page" that would push its parent out of the page.
const NestedInPage = React.createContext<boolean>(false);

// How many dialogs are open over the page right now (the ordinary ones, not
// those shown in the page). A dialog that is asked to show in the page while
// another one is open over it would end up hidden behind that one's backdrop
// - "unlock your wallet" while the Send dialog is open - so it opens as an
// overlay then.
let overlaysOpen = 0;
const overlayListeners = new Set<() => void>();

function useOverlaysOpen(): number {
    return React.useSyncExternalStore(
        listener => {
            overlayListeners.add(listener);
            return () => {
                overlayListeners.delete(listener);
            };
        },
        () => overlaysOpen,
        () => 0
    );
}

function setOverlaysOpen(delta: number) {
    overlaysOpen += delta;
    overlayListeners.forEach(listener => listener());
}

export function ModalAsPage({
    children
}: {
    children?: React.ReactNode;
}): JSX.Element {
    return (
        <PagePresentation.Provider value={true}>
            {children}
        </PagePresentation.Provider>
    );
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
    /** Overrides the backdrop's `z-index` (default 1000) - real at one
     * call site (`Wallet/WalletUnlockModal.tsx`, `1001`, so the unlock
     * dialog always renders above any other open modal). */
    zIndex?: number;
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
    zIndex,
    className,
    children
}: ModalProps): JSX.Element | null {
    const asPageRequested = React.useContext(PagePresentation);
    const nestedInPage = React.useContext(NestedInPage);
    const overlays = useOverlaysOpen();
    const asPage = asPageRequested && overlays === 0;
    const dialogRef = React.useRef<HTMLDivElement>(null);
    // Escape closes the dialog. A dropdown that is open (Select draws its list
    // on <body>, outside the dialog) takes the key first: it handles it in the
    // capture phase and stops it, so one Escape closes one thing.
    React.useEffect(() => {
        if (!visible || !onCancel || asPage) return;
        const onKey = (event: KeyboardEvent) => {
            if (event.key === "Escape") onCancel();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [visible, onCancel, asPage]);
    const titleId = useStableId("modal-title");
    const triggerRef = React.useRef<Element | null>(null);

    React.useEffect(() => {
        if (!visible || asPageRequested || nestedInPage) return;
        // an ordinary dialog: it counts as open over the page
        setOverlaysOpen(1);
        return () => setOverlaysOpen(-1);
    }, [visible, asPageRequested, nestedInPage]);

    React.useEffect(() => {
        if (!visible || asPage) return;
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
    }, [visible, asPage]);

    const pageRef = React.useRef<HTMLElement>(null);
    React.useEffect(() => {
        if (!visible || !asPage) return;
        // a dialog that opens above the part of the page that is on screen
        // (a transaction to confirm) must not be somewhere out of sight
        const node = pageRef.current;
        if (node && typeof node.scrollIntoView === "function") {
            node.scrollIntoView({block: "start", behavior: "smooth"});
        }
    }, [visible, asPage]);

    if (!visible) return null;

    if (asPage) {
        return (
            <NestedInPage.Provider value={true}>
                <PagePresentation.Provider value={false}>
                    <section
                        ref={pageRef}
                        className={[styles.page, className]
                            .filter(Boolean)
                            .join(" ")}
                        aria-labelledby={
                            title !== undefined ? titleId : undefined
                        }
                    >
                        {title !== undefined ? (
                            <h2 id={titleId} className={styles.pageTitle}>
                                {title}
                            </h2>
                        ) : null}
                        <div className={styles.pageBody}>{children}</div>
                        {footer !== undefined ? (
                            <div className={styles.pageFooter}>{footer}</div>
                        ) : null}
                    </section>
                </PagePresentation.Provider>
            </NestedInPage.Provider>
        );
    }

    return ReactDOM.createPortal(
        <div
            className={[styles.backdrop, wrapClassName]
                .filter(Boolean)
                .join(" ")}
            style={zIndex !== undefined ? {zIndex} : undefined}
            // A click on the backdrop itself (not on anything inside the dialog
            // or in a layer that belongs to it, such as a Select's list, which
            // React bubbles to here through its portal) dismisses the dialog.
            onMouseDown={event => {
                if (event.target === event.currentTarget && onCancel) {
                    onCancel();
                }
            }}
        >
            <div
                className={[styles.dialog, className].filter(Boolean).join(" ")}
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
