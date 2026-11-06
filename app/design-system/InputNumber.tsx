import * as React from "react";
import styles from "./InputNumber.module.scss";

// Twenty-first component of the design system's bitshares-ui-style-guide
// replacement (docs/UI_MIGRATION_PLAN.md), added during the call-site
// migration phase rather than the original twenty - real at exactly 2
// call sites (`Exchange/Personalize.tsx`'s chart-height field,
// `Wallet/WalletUnlockModal.tsx`'s auto-lock-timeout field, the latter
// still deferred with the wallet-sensitive batch), both using only
// `value`/`onChange`/`placeholder`/`style`/`className` - no `min`/`max`/
// `step`/`formatter`/`parser` anywhere, so none of those are built.
//
// `value` is typed `number | false | undefined` to match real usage:
// `Personalize.tsx` passes `typeof chartHeight === "number" && chartHeight`,
// an expression that evaluates to `false` (not a number) whenever
// `chartHeight` isn't already numeric - antd's own `InputNumber` rendered
// that as an empty field, replicated here the same way.
//
// Renders a native `<input type="number">` plus up/down steppers (antd's
// own visual signature for this component), incrementing/decrementing by
// 1 - not a plain unstyled number input, since the stepper buttons are a
// real, visible part of antd's `InputNumber` every call site already
// looks like.
export interface InputNumberProps {
    value?: number | false;
    onChange?: (value: number) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

export function InputNumber({
    value,
    onChange,
    placeholder,
    disabled,
    className,
    style
}: InputNumberProps): JSX.Element {
    const displayValue = typeof value === "number" ? value : "";

    function commit(next: number) {
        if (onChange) onChange(next);
    }

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const raw = e.target.value;
        if (raw === "") return;
        const next = Number(raw);
        if (!Number.isNaN(next)) commit(next);
    }

    function step(delta: number) {
        const base = typeof value === "number" ? value : 0;
        commit(base + delta);
    }

    const wrapClasses = [styles.wrap, className].filter(Boolean).join(" ");

    return (
        <span className={wrapClasses} style={style}>
            <input
                type="number"
                className={styles.input}
                value={displayValue}
                placeholder={placeholder}
                disabled={disabled}
                onChange={handleChange}
            />
            <span className={styles.steppers}>
                <button
                    type="button"
                    className={styles.stepper}
                    disabled={disabled}
                    aria-label="Increase"
                    onClick={() => step(1)}
                >
                    ▲
                </button>
                <button
                    type="button"
                    className={styles.stepper}
                    disabled={disabled}
                    aria-label="Decrease"
                    onClick={() => step(-1)}
                >
                    ▼
                </button>
            </span>
        </span>
    );
}
