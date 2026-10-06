import * as React from "react";
import ReactDOM from "react-dom";
import {Icon} from "./Icon";
import styles from "./Notification.module.scss";

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
// `Notification.success`/`.error` are the only two severities ever called
// (no `.warning`/`.info`), every call site passes only `message` (no
// `description`, `duration` override, `placement`, or `onClick` anywhere
// in the app), and the one `Notification.config({...})` call
// (`App.jsx`, setting a default `duration` and `top` offset so toasts
// clear the topbar) is kept as the only other supported entry point.
//
// Architecturally different from this design system's other components:
// since real call sites invoke this as a plain function from outside
// React (store code, submit handlers), not as JSX, there's no `<Notification>`
// element for a caller to render. Instead this module owns a single
// lazily-created container appended to `document.body` on first use, and
// re-renders it directly (a plain `ReactDOM.render` call passing the
// current entries as props) every time an entry is pushed or dismissed -
// not a subscribed-to pub/sub store, since `useEffect`-based subscription
// introduced a real timing bug here: the subscribing effect from the
// container's *own* mount doesn't flush until the end of the current
// `act()`/task, so the first entry pushed in the same synchronous call as
// the container's creation was silently dropped (notified before
// anything had subscribed to hear it).
export interface NotificationArgs {
    message: React.ReactNode;
    /** Seconds before auto-dismissing; 0 disables auto-dismiss. Defaults
     * to whatever `Notification.config({duration})` last set (4.5s
     * un-configured, matching antd's own default). */
    duration?: number;
}

export interface NotificationConfigArgs {
    duration?: number;
    top?: number;
}

type NotificationKind = "success" | "error";

interface NotificationEntry {
    id: number;
    kind: NotificationKind;
    message: React.ReactNode;
}

const config: Required<NotificationConfigArgs> = {
    duration: 4.5,
    top: 24
};

let entries: NotificationEntry[] = [];
let nextId = 1;
let containerNode: HTMLDivElement | null = null;

function render() {
    if (!containerNode) return;
    ReactDOM.render(<NotificationStack entries={entries} />, containerNode);
}

function dismiss(id: number) {
    entries = entries.filter((entry) => entry.id !== id);
    render();
}

function ensureContainer() {
    if (containerNode) return;
    containerNode = document.createElement("div");
    document.body.appendChild(containerNode);
}

function push(kind: NotificationKind, args: NotificationArgs) {
    ensureContainer();
    const id = nextId++;
    const duration = args.duration ?? config.duration;
    entries = [...entries, {id, kind, message: args.message}];
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
            {entries.map((entry) => (
                <div
                    key={entry.id}
                    className={[styles.entry, styles[entry.kind]]
                        .filter(Boolean)
                        .join(" ")}
                    role="alert"
                >
                    <span className={styles.icon}>
                        {entry.kind === "success" ? (
                            <SuccessIcon />
                        ) : (
                            <Icon type="exclamation-circle" />
                        )}
                    </span>
                    <div className={styles.message}>{entry.message}</div>
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

export const Notification = {
    success(args: NotificationArgs): void {
        push("success", args);
    },
    error(args: NotificationArgs): void {
        push("error", args);
    },
    config(args: NotificationConfigArgs): void {
        if (args.duration !== undefined) config.duration = args.duration;
        if (args.top !== undefined) config.top = args.top;
    }
};
