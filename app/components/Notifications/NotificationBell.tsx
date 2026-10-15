// The bell in the top bar: what the app told the user, kept here (in this
// browser) after the toast is gone, with the entries not yet looked at marked.
// Opening the panel shows them; closing it marks them as seen.
import * as React from "react";
import counterpart from "counterpart";
import {useClickOutside} from "../../next/hooks/useClickOutside";
import {
    HistoryItem,
    clearNotifications,
    markAllSeen,
    unseenCount,
    useNotificationHistory
} from "../../lib/common/notificationHistory";
import {timeAgo} from "../../lib/common/timeAgo";
import styles from "./NotificationBell.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`notification_center.${key}`, params) as string;

function ago(at: number): string {
    const {unit, count} = timeAgo(at);
    return unit === "now" ? t("now") : t(unit, {count});
}

function KindIcon({kind}: {kind: HistoryItem["kind"]}) {
    const common = {
        width: 16,
        height: 16,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.8,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
        "aria-hidden": true
    };
    if (kind === "success") {
        return (
            <svg {...common}>
                <circle cx="12" cy="12" r="9" />
                <path d="m8 12.5 2.8 2.8L16 9.6" />
            </svg>
        );
    }
    if (kind === "error") {
        return (
            <svg {...common}>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7.5v5.5M12 16.5h.01" />
            </svg>
        );
    }
    if (kind === "warning") {
        return (
            <svg {...common}>
                <path d="M12 4 3 19.5h18L12 4Z" />
                <path d="M12 10v4.5M12 17.2h.01" />
            </svg>
        );
    }
    return (
        <svg {...common}>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5.5M12 7.8h.01" />
        </svg>
    );
}

export function NotificationBell(): JSX.Element {
    const items = useNotificationHistory();
    const [open, setOpen] = React.useState(false);
    const unseen = unseenCount(items);
    // what was unseen when the panel opened stays marked while it is open
    const [fresh, setFresh] = React.useState<Set<number>>(new Set());

    const close = React.useCallback(() => {
        setOpen(false);
        markAllSeen();
    }, []);
    const ref = useClickOutside<HTMLDivElement>(close, open);
    // where the bar ends, for the phone's sheet (fixed under the bar)
    const [panelTop, setPanelTop] = React.useState(0);

    const toggle = () => {
        if (open) {
            close();
        } else {
            setFresh(new Set(items.filter(i => !i.seen).map(i => i.id)));
            const wrap = ref.current;
            if (wrap) setPanelTop(wrap.getBoundingClientRect().bottom + 8);
            setOpen(true);
        }
    };

    return (
        <div className={styles.wrap} ref={ref}>
            <button
                type="button"
                className={styles.bell}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-label={
                    unseen
                        ? `${t("label")}: ${t("unseen", {count: unseen})}`
                        : t("label")
                }
                title={t("label")}
                onClick={toggle}
            >
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                >
                    <path d="M6 17h12l-1.4-2.2V10.5a4.6 4.6 0 0 0-9.2 0v4.3L6 17Z" />
                    <path d="M10 19.5a2.1 2.1 0 0 0 4 0" />
                </svg>
                {unseen ? (
                    <span className={styles.badge}>
                        {unseen > 9 ? "9+" : unseen}
                    </span>
                ) : null}
            </button>
            {open ? (
                <div
                    className={styles.panel}
                    style={{["--bell-top" as any]: `${panelTop}px`}}
                    role="dialog"
                    aria-label={t("title")}
                >
                    <div className={styles.head}>
                        <span className={styles.title}>{t("title")}</span>
                        <span className={styles.actions}>
                            {items.length ? (
                                <button
                                    type="button"
                                    className={styles.link}
                                    onClick={() => {
                                        clearNotifications();
                                        setFresh(new Set());
                                    }}
                                >
                                    {t("clear")}
                                </button>
                            ) : null}
                        </span>
                    </div>
                    {items.length ? (
                        <ul className={styles.list}>
                            {items.map(item => (
                                <li
                                    key={item.id}
                                    className={`${styles.item} ${
                                        fresh.has(item.id) ? styles.fresh : ""
                                    }`}
                                >
                                    <span
                                        className={`${styles.kind} ${
                                            styles[item.kind]
                                        }`}
                                    >
                                        <KindIcon kind={item.kind} />
                                    </span>
                                    <span className={styles.text}>
                                        <span className={styles.itemTitle}>
                                            {item.title}
                                        </span>
                                        {item.description ? (
                                            <span className={styles.desc}>
                                                {item.description}
                                            </span>
                                        ) : null}
                                    </span>
                                    <span className={styles.when}>
                                        {ago(item.at)}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className={styles.empty}>{t("empty")}</div>
                    )}
                </div>
            ) : null}
        </div>
    );
}

export default NotificationBell;
