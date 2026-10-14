// The notifications the app showed, kept in this browser: the toast goes away
// after a few seconds, the history stays and says which entries have not been
// looked at (the bell in the top bar).
//
// A small external store (read with `useSyncExternalStore`), persisted in
// localStorage. Nothing here is a secret: the text of a toast, a time, a kind.
import * as React from "react";

export type NotificationKind = "success" | "error" | "warning" | "info";

export interface HistoryItem {
    id: number;
    /** ms since the epoch */
    at: number;
    kind: NotificationKind;
    title: string;
    description: string;
    seen: boolean;
}

const KEY = "__graphene__notificationHistory";
export const MAX_ITEMS = 100;

let items: HistoryItem[] = load();
const listeners = new Set<() => void>();

function load(): HistoryItem[] {
    try {
        const parsed = JSON.parse(window.localStorage.getItem(KEY) || "[]");
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter(
                (x: any) =>
                    x &&
                    typeof x.id === "number" &&
                    typeof x.at === "number" &&
                    typeof x.title === "string"
            )
            .slice(0, MAX_ITEMS);
    } catch (e) {
        return [];
    }
}

function save() {
    try {
        window.localStorage.setItem(KEY, JSON.stringify(items));
    } catch (e) {
        // not kept: the toasts still show
    }
}

function emit() {
    listeners.forEach(listener => listener());
}

/** Adds an entry (newest first); returns it. */
export function recordNotification(
    kind: NotificationKind,
    title: string,
    description = "",
    at: number = Date.now()
): HistoryItem {
    const id = (items.length ? Math.max(...items.map(i => i.id)) : 0) + 1;
    const item: HistoryItem = {
        id,
        at,
        kind,
        title: title.slice(0, 300),
        description: description.slice(0, 600),
        seen: false
    };
    items = [item, ...items].slice(0, MAX_ITEMS);
    save();
    emit();
    return item;
}

export function getNotifications(): HistoryItem[] {
    return items;
}

export function unseenCount(list: HistoryItem[] = items): number {
    return list.reduce((n, item) => n + (item.seen ? 0 : 1), 0);
}

export function markAllSeen(): void {
    if (!items.some(i => !i.seen)) return;
    items = items.map(i => (i.seen ? i : {...i, seen: true}));
    save();
    emit();
}

export function clearNotifications(): void {
    if (!items.length) return;
    items = [];
    save();
    emit();
}

/** Back to what is stored (tests). */
export function reloadNotifications(): void {
    items = load();
    emit();
}

function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function useNotificationHistory(): HistoryItem[] {
    return React.useSyncExternalStore(subscribe, getNotifications, () => []);
}

/**
 * Plain text of a message that may be a React node (a translated element, a
 * link): its strings, joined. Best effort; used for the history only.
 */
export function nodeToText(node: any, depth = 0): string {
    if (node === null || node === undefined || typeof node === "boolean") {
        return "";
    }
    if (typeof node === "string" || typeof node === "number") {
        return String(node);
    }
    if (Array.isArray(node)) {
        return node
            .map(n => nodeToText(n, depth + 1))
            .join("")
            .replace(/\s+/g, " ");
    }
    if (depth > 8) return "";
    const props = node.props || {};
    if (typeof props.children !== "undefined") {
        return nodeToText(props.children, depth + 1);
    }
    // a <Translate content="key" ...> carries the key, not the text
    if (typeof props.content === "string") {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const counterpart = require("counterpart");
            return String(
                counterpart.translate(props.content, props.with || props)
            );
        } catch (e) {
            return props.content;
        }
    }
    return "";
}

/** The text of an HTML string (the legacy toasts allowed markup). */
export function htmlToText(html: string): string {
    if (!/[<&]/.test(html)) return html;
    try {
        const doc = new DOMParser().parseFromString(html, "text/html");
        return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
    } catch (e) {
        return html.replace(/<[^>]*>/g, "");
    }
}
