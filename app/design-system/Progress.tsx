import * as React from "react";
import styles from "./Progress.module.scss";

// Nineteenth component of the design system's bitshares-ui-style-guide
// replacement (docs/UI_MIGRATION_PLAN.md), following `Modal`/`Tooltip`/
// `Input`/`Form`/`Select`/`Icon`/`Notification`/`Table`/`Row`/`Col`/
// `Radio`/`Switch`/`Card`/`Popover`/`Checkbox`/`Alert`/`Tabs`/
// `BodyClassName`'s precedent. Replaces `bitshares-ui-style-guide`'s
// `Progress` (antd v3). One real call site
// (`Forms/PasswordInputStyleGuide.tsx`, a password-strength meter):
// `percent` and `showInfo={false}`. No `type="circle"`, `status`,
// `strokeColor`, or `format` anywhere - a plain linear bar.
export interface ProgressProps {
    percent: number;
    /** Default true, matching antd: shows the percentage text next to
     * the bar. The one real call site sets this false. */
    showInfo?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

export function Progress({
    percent,
    showInfo = true,
    className,
    style
}: ProgressProps): JSX.Element {
    const clamped = Math.max(0, Math.min(100, percent));

    return (
        <div
            className={[styles.wrap, className].filter(Boolean).join(" ")}
            style={style}
            role="progressbar"
            aria-valuenow={clamped}
            aria-valuemin={0}
            aria-valuemax={100}
        >
            <div className={styles.track}>
                <div className={styles.fill} style={{width: `${clamped}%`}} />
            </div>
            {showInfo ? (
                <span className={styles.info}>{Math.round(clamped)}%</span>
            ) : null}
        </div>
    );
}
