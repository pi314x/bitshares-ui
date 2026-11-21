import * as React from "react";
import styles from "./Button.module.scss";
import {Icon, IconType} from "./Icon";

export type ButtonVariant = "default" | "accent";
export type ButtonSize = "default" | "small";

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    /** A leading glyph, rendered via the design-system `Icon` before
     * `children` - real at several call sites (antd's own `icon` prop,
     * a glyph name rather than an element). Added only with the glyphs
     * real usage actually needs as each call site gets migrated, not
     * speculatively for all of antd's icon set. */
    icon?: IconType;
    /** Real at exactly one file so far (`Showcases/Barter.tsx`'s
     * icon-only memo-field toggles) - antd's own `size="small"`,
     * reducing padding/font-size. Only `"small"` is real anywhere;
     * antd's `"large"` is never used. */
    size?: ButtonSize;
    /** antd's own `loading`: replaces the leading `icon` with the
     * spinning `loading` glyph and blocks clicks (rendered `disabled`)
     * while true. Real at exactly one call site (`Registration/
     * WalletRegistrationForm.tsx`'s submit button). */
    loading?: boolean;
}

// `type` defaults to `"button"`, matching antd's own `Button` (whose
// internal `htmlType` defaults to `"button"`) rather than the native
// `<button>` default of `"submit"` inside a `<form>`. Found during the
// wallet-sensitive final batch of the call-site migration
// (docs/UI_MIGRATION_PLAN.md §7.2): migrated call sites that put a
// `<Button onClick={handleSubmit}>` inside a `<form onSubmit=...>` (or the
// design-system `<Form>`) silently started firing both the click handler
// and the form's native submit - double-running the handler. Callers that
// really want a submit button already pass `type="submit"` explicitly.
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    function Button(
        {
            variant = "default",
            size = "default",
            type = "button",
            loading = false,
            disabled,
            className,
            icon,
            children,
            ...rest
        },
        ref
    ) {
        const classes = [
            styles.btn,
            variant === "accent" ? styles.accent : "",
            size === "small" ? styles.small : ""
        ]
            .filter(Boolean)
            .concat(className ? [className] : [])
            .join(" ");

        return (
            <button
                ref={ref}
                type={type}
                className={classes}
                disabled={disabled || loading}
                {...rest}
            >
                {loading ? (
                    <Icon type="loading" className={styles.icon} />
                ) : icon ? (
                    <Icon type={icon} className={styles.icon} />
                ) : null}
                {children}
            </button>
        );
    }
);
