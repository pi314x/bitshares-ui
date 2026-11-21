import * as React from "react";
import styles from "./Checkbox.module.scss";

// Fifteenth component of the design system's bitshares-ui-style-guide
// replacement (docs/UI_MIGRATION_PLAN.md), following `Modal`/`Tooltip`/
// `Input`/`Form`/`Select`/`Icon`/`Notification`/`Table`/`Row`/`Col`/
// `Radio`/`Switch`/`Card`/`Popover`'s precedent. Replaces
// `bitshares-ui-style-guide`'s `Checkbox` (antd v3).
//
// Grepped every real call site before designing this: `checked` +
// `onChange` (every real `onChange` handler reads `e.target.checked`,
// never `e.target.value`) or, at two call sites, a plain `onClick` that
// takes no arguments and toggles its own externally-held state directly.
// Also real: `disabled`, `id`, `tabIndex`, `className`, `style`, and an
// optional label (`children` - two real call sites render a bare
// checkbox with none). No `Checkbox.Group`/`indeterminate` anywhere.
//
// Unlike `Radio`, no custom event synthesis is needed here: a checkbox's
// `checked` is already the one piece of state real call sites read, and
// the native `<input type="checkbox">`'s own `onChange` event already
// carries `target.checked` correctly - there's no antd-vs-native type
// mismatch the way `Radio`'s non-string `value` had (checked against
// `rc-checkbox`'s source to confirm there, see `Radio.tsx`'s header
// comment). So this one wraps the native input's real event straight
// through.
export interface CheckboxProps {
    checked?: boolean;
    disabled?: boolean;
    id?: string;
    tabIndex?: number;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
}

export function Checkbox({
    checked,
    disabled,
    id,
    tabIndex,
    onChange,
    onClick,
    className,
    style,
    children
}: CheckboxProps): JSX.Element {
    return (
        <label
            className={[
                styles.checkbox,
                disabled ? styles.disabled : "",
                className
            ]
                .filter(Boolean)
                .join(" ")}
            style={style}
        >
            <input
                type="checkbox"
                id={id}
                className={styles.input}
                checked={!!checked}
                disabled={disabled}
                tabIndex={tabIndex}
                onChange={onChange}
                onClick={onClick}
            />
            {children !== undefined ? (
                <span className={styles.label}>{children}</span>
            ) : null}
        </label>
    );
}
