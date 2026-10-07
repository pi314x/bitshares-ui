import * as React from "react";
import {Icon} from "./Icon";
import styles from "./Alert.module.scss";

// Sixteenth component of the design system's bitshares-ui-style-guide
// replacement (docs/UI_MIGRATION_PLAN.md), following `Modal`/`Tooltip`/
// `Input`/`Form`/`Select`/`Icon`/`Notification`/`Table`/`Row`/`Col`/
// `Radio`/`Switch`/`Card`/`Popover`/`Checkbox`'s precedent. Replaces
// `bitshares-ui-style-guide`'s `Alert` (antd v3).
//
// Grepped every real call site before designing this: `message` (near-
// always; one real call site passes `message=""` and leans on
// `description` instead - still a real pattern, not a misuse, so
// `message` stays optional rather than required), an optional
// `description`, `type` of `"success"`/`"error"`/`"warning"`/`"info"`
// (antd's full set, all four genuinely used), `showIcon`, `style`, and
// one real `banner` usage (`Layout/NewsHeadline.tsx`, a full-width
// variant with no border radius/side borders). No `closable`/`onClose`/
// custom `icon` override anywhere - `NewsHeadline.tsx` renders its own
// separate close `×` icon next to the `Alert` rather than using antd's
// built-in closable behavior, so that stays out of this component too.
//
// Reuses this design system's own `Icon` component for the
// `showIcon`/`info`/`warning` glyphs (`exclamation-circle`/
// `info-circle`, already in `Icon`'s real-usage-scoped glyph set) rather
// than drawing new ones; `success` draws its own small inline check-circle
// SVG, the same pattern `Notification.tsx` already established for a
// glyph `Icon` doesn't carry (no real `<Icon type="check-circle">` call
// site exists anywhere in the app, so it was never added there).
export type AlertType = "success" | "info" | "warning" | "error";

export interface AlertProps {
    message?: React.ReactNode;
    description?: React.ReactNode;
    type?: AlertType;
    showIcon?: boolean;
    /** Full-width variant with no border radius or side borders, for an
     * alert spanning the top of a page/section rather than sitting
     * inside a bordered layout. */
    banner?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

function SuccessIcon() {
    return (
        <svg
            viewBox="0 0 24 24"
            width="16"
            height="16"
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

function typeIcon(type: AlertType) {
    switch (type) {
        case "success":
            return <SuccessIcon />;
        case "info":
            return <Icon type="info-circle" />;
        case "warning":
        case "error":
            return <Icon type="exclamation-circle" />;
    }
}

export function Alert({
    message,
    description,
    type = "info",
    showIcon,
    banner,
    className,
    style
}: AlertProps): JSX.Element {
    return (
        <div
            className={[
                styles.alert,
                styles[type],
                banner ? styles.banner : "",
                className
            ]
                .filter(Boolean)
                .join(" ")}
            style={style}
            role="alert"
        >
            {showIcon ? (
                <span className={styles.icon}>{typeIcon(type)}</span>
            ) : null}
            <div className={styles.body}>
                {message ? (
                    <div className={styles.message}>{message}</div>
                ) : null}
                {description ? (
                    <div className={styles.description}>{description}</div>
                ) : null}
            </div>
        </div>
    );
}
