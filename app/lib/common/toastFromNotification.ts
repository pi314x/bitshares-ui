// What a notification of the legacy shape (`NotificationActions.success({message, title,
// children, autoDismiss})`) shows as a toast. The legacy system showed `children` (a React
// element) as the body when there was no message: the confirmation of a transaction sends only
// that, and the conversion dropped it - an empty toast, and an empty entry under the bell.

export interface LegacyNotification {
    level?: string;
    title?: any;
    message?: any;
    children?: any;
    autoDismiss?: number;
}

export interface Toast {
    level: "success" | "error" | "warning" | "info";
    message: any;
    description: any;
    duration: number;
}

const LEVELS = ["success", "error", "warning", "info"];

/** `text` turns a string that may hold HTML into text (the legacy toasts allowed markup). */
export function toastFromNotification(
    notification: LegacyNotification,
    text: (value: string) => string = value => value,
    defaultDuration = 10
): Toast {
    const asText = (value: any) =>
        typeof value === "string" ? text(value) : value;
    const present = (value: any) =>
        value !== undefined && value !== null && value !== "";
    const hasTitle = present(notification.title);
    // the body: the message, else the element the sender gave
    const body = present(notification.message)
        ? notification.message
        : notification.children;
    return {
        level: (LEVELS.includes(notification.level as string)
            ? notification.level
            : "info") as Toast["level"],
        message: asText(hasTitle ? notification.title : body),
        description: hasTitle ? asText(body) : undefined,
        duration:
            notification.autoDismiss === undefined
                ? defaultDuration
                : notification.autoDismiss
    };
}
