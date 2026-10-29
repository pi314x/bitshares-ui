import * as React from "react";
import {createPortal} from "react-dom";
import {createRoot, Root} from "react-dom/client";
import {Icon} from "./Icon";
import styles from "./Notification.module.scss";
import {
    nodeToText,
    recordNotification
} from "../lib/common/notificationHistory";

// Seventh component of the design system's bitshares-ui-style-guide
// replacement (docs/UI_MIGRATION_PLAN.md), following `Modal`/`Tooltip`/
// `Input`/`Form`/`Select`/`Icon`'s precedent. Replaces
// `bitshares-ui-style-guide`'s `Notification`, antd v3's imperative toast
// API (`Notification.success({...})`/`Notification.error({...})`, called
// from plain event handlers and store code - not rendered as JSX by any
// caller, unlike every other component this design system has ported so
// far).
//
// Grepped every real call site's actual usage before designing this:
// `Notification.success`/`.error` are the two severities called directly
// as `Notification.error(...)`; `.warning` (no `.info`) is also real but
// was missed on the first pass here, since its two call sites
// (`Exchange/Exchange.tsx`, `Account/AccountPermissions.tsx`) write
// `(Notification as any).warning(...)` - the `as any` cast hid the call
// from the original grep for `Notification\.(success|error|...)`, caught
// only once the call-site migration phase tried to compile those two
// files against this module's real (cast-free) exported methods. `.info`
// was missed the same way, for the same reason, caught later still:
// `PriceAlertNotifications.tsx`'s two call sites also write
// `(Notification as any).info(...)` - and, caught at the same time,
// genuinely pass `description` (a rich `<Translate>` block naming the
// asset pair and expected/actual price, not just a string) and `icon`
// (a colored up/down caret overriding the default severity icon) -
// real content, not cosmetic, so both are supported rather than
// silently dropped. No other real call site uses either. No call site
// anywhere passes `placement` or `onClick`, and the one
// `Notification.config({...})` call (`App.jsx`, setting a default
// `duration` and `top` offset so toasts clear the topbar) is kept as
// the only other supported entry point.
//
// Architecturally different from this design system's other components:
// since real call sites invoke this as a plain function from outside
// React (store code, submit handlers), not as JSX, there's no `<Notification>`
// element for a caller to render. Instead this module owns a single
// lazily-created container appended to `document.body` on first use, and
// re-renders it directly (a plain `root.render` call passing the
// current entries as props) every time an entry is pushed or dismissed -
// not a subscribed-to pub/sub store, since `useEffect`-based subscription
// introduced a real timing bug here: the subscribing effect from the
// container's *own* mount doesn't flush until the end of the current
// `act()`/task, so the first entry pushed in the same synchronous call as
// the container's creation was silently dropped (notified before
// anything had subscribed to hear it).
//
// Where the toasts are drawn: a `<NotificationHost/>` mounted inside the app (App.jsx) draws them, through a
// portal, so that what a toast holds finds the router and the language it needs - the confirmation of a
// transaction holds an operation row, with links to accounts and formatted amounts, which threw in a root of
// its own (no router, no `intl`). Until a host is mounted (the start-up, a test), the toasts are drawn in a
// root of their own, as before.
export interface NotificationArgs {
    message: React.ReactNode;
    /** Seconds before auto-dismissing; 0 disables auto-dismiss. Defaults
     * to whatever `Notification.config({duration})` last set (4.5s
     * un-configured, matching antd's own default). */
    duration?: number;
    /** Extra content shown below `message`, in a smaller/muted style -
     * real at `PriceAlertNotifications.tsx`'s two `.info(...)` calls,
     * each a rich `<Translate>` block naming the asset pair and
     * expected/actual price, not just a plain string. */
    description?: React.ReactNode;
    /** Overrides this entry's default severity icon with a caller-
     * supplied element - real at the same two call sites (a colored
     * up/down caret matching whether the alert fired for a price
     * crossing above or below the threshold). */
    icon?: React.ReactNode;
}

export interface NotificationConfigArgs {
    duration?: number;
    top?: number;
}

type NotificationKind = "success" | "error" | "warning" | "info";

interface NotificationEntry {
    id: number;
    /** seconds until it goes (0: it stays until closed) */
    duration: number;
    kind: NotificationKind;
    message: React.ReactNode;
    description?: React.ReactNode;
    icon?: React.ReactNode;
}

const config: Required<NotificationConfigArgs> = {
    duration: 4.5,
    top: 24
};

let entries: NotificationEntry[] = [];
let nextId = 1;
let root: Root | null = null;
// the hosts mounted in the app, and who wants to know when the entries change
let hosts = 0;
const listeners = new Set<() => void>();

function render() {
    listeners.forEach(listener => listener());
    if (!root) return;
    root.render(hosts > 0 ? null : <NotificationStack entries={entries} />);
}

function dismiss(id: number) {
    entries = entries.filter(entry => entry.id !== id);
    render();
}

function ensureContainer() {
    if (root) return;
    const containerNode = document.createElement("div");
    document.body.appendChild(containerNode);
    root = createRoot(containerNode);
}

function push(kind: NotificationKind, args: NotificationArgs) {
    // the toast goes away; the history (the bell) keeps it
    try {
        recordNotification(
            kind,
            nodeToText(args.message),
            nodeToText(args.description)
        );
    } catch (e) {
        // never let the history stop a toast
    }
    if (hosts === 0) ensureContainer();
    const id = nextId++;
    const duration = args.duration ?? config.duration;
    entries = [
        ...entries,
        {
            id,
            duration: duration > 0 ? duration : 0,
            kind,
            message: args.message,
            description: args.description,
            icon: args.icon
        }
    ];
    render();
    if (duration > 0) {
        setTimeout(() => dismiss(id), duration * 1000);
    }
}

function SuccessIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
        >
            <circle cx="12" cy="12" r="9" />
            <path d="M8 12.5l2.5 2.5L16 9.5" />
        </svg>
    );
}

interface NotificationStackProps {
    entries: NotificationEntry[];
}

function NotificationStack({
    entries
}: NotificationStackProps): JSX.Element | null {
    if (entries.length === 0) return null;

    return (
        <div className={styles.stack} style={{top: config.top}}>
            {entries.map(entry => (
                <div
                    key={entry.id}
                    className={[styles.entry, styles[entry.kind]]
                        .filter(Boolean)
                        .join(" ")}
                    role="alert"
                    style={
                        entry.duration
                            ? ({
                                  "--toast-duration": `${entry.duration}s`
                              } as React.CSSProperties)
                            : undefined
                    }
                >
                    <span className={styles.icon}>
                        {entry.icon ? (
                            entry.icon
                        ) : entry.kind === "success" ? (
                            <SuccessIcon />
                        ) : entry.kind === "info" ? (
                            <Icon type="info-circle" />
                        ) : (
                            <Icon type="exclamation-circle" />
                        )}
                    </span>
                    <div className={styles.messageGroup}>
                        <div className={styles.message}>{entry.message}</div>
                        {entry.description ? (
                            <div className={styles.description}>
                                {entry.description}
                            </div>
                        ) : null}
                    </div>
                    <button
                        type="button"
                        className={styles.close}
                        aria-label="Close"
                        onClick={() => dismiss(entry.id)}
                    >
                        <Icon type="close" />
                    </button>
                </div>
            ))}
        </div>
    );
}

/** Draws the toasts inside the app, so that they share its router and language; mount it once, below both. */
export function NotificationHost(): JSX.Element {
    const list = React.useSyncExternalStore(
        listener => {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
        () => entries
    );
    React.useEffect(() => {
        hosts++;
        // what a root of its own was showing moves here
        render();
        return () => {
            hosts--;
            // the toasts that are left are drawn in a root of their own again
            if (hosts === 0 && entries.length > 0) {
                ensureContainer();
                render();
            }
        };
    }, []);
    return createPortal(<NotificationStack entries={list} />, document.body);
}

export const Notification = {
    success(args: NotificationArgs): void {
        push("success", args);
    },
    error(args: NotificationArgs): void {
        push("error", args);
    },
    warning(args: NotificationArgs): void {
        push("warning", args);
    },
    info(args: NotificationArgs): void {
        push("info", args);
    },
    config(args: NotificationConfigArgs): void {
        if (args.duration !== undefined) config.duration = args.duration;
        if (args.top !== undefined) config.top = args.top;
    }
};
