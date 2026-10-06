import * as React from "react";
import styles from "./Switch.module.scss";

// Twelfth component of the design system's bitshares-ui-style-guide
// replacement (docs/UI_MIGRATION_PLAN.md), following `Modal`/`Tooltip`/
// `Input`/`Form`/`Select`/`Icon`/`Notification`/`Table`/`Row`/`Col`/
// `Radio`'s precedent. Replaces `bitshares-ui-style-guide`'s `Switch`
// (antd v3).
//
// Grepped every real call site before designing this: always `checked` +
// `onChange` (every real call site is controlled, no `defaultChecked`
// usage), one real `checkedChildren`/`unCheckedChildren` pair
// (`Account/AccountOverview.tsx`, `"Yes"`/`"No"` labels inside the
// pill). No `disabled`, no `size="small"`, no `loading` anywhere.
// Real `onChange` handlers all ignore antd's own `(checked, event)`
// callback args and just toggle their own externally-held state
// (`() => setChecked(!checked)`) - the signature here still matches
// antd's real one for fidelity, it's just unused by every current
// caller.
export interface SwitchProps {
    checked: boolean;
    onChange?: (checked: boolean, event: React.MouseEvent) => void;
    checkedChildren?: React.ReactNode;
    unCheckedChildren?: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
}

export function Switch({
    checked,
    onChange,
    checkedChildren,
    unCheckedChildren,
    className,
    style
}: SwitchProps): JSX.Element {
    function handleClick(event: React.MouseEvent) {
        if (onChange) onChange(!checked, event);
    }

    const label = checked ? checkedChildren : unCheckedChildren;

    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            className={[styles.switch, checked ? styles.checked : "", className]
                .filter(Boolean)
                .join(" ")}
            style={style}
            onClick={handleClick}
        >
            {label !== undefined ? (
                <span className={styles.text}>{label}</span>
            ) : null}
            <span className={styles.handle} />
        </button>
    );
}
