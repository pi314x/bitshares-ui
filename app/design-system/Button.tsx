import * as React from "react";
import styles from "./Button.module.scss";
import {Icon, IconType} from "./Icon";

export type ButtonVariant = "default" | "accent";

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    /** A leading glyph, rendered via the design-system `Icon` before
     * `children` - real at several call sites (antd's own `icon` prop,
     * a glyph name rather than an element). Added only with the glyphs
     * real usage actually needs as each call site gets migrated, not
     * speculatively for all of antd's icon set. */
    icon?: IconType;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    function Button({variant = "default", className, icon, children, ...rest}, ref) {
        const classes = [styles.btn, variant === "accent" ? styles.accent : ""]
            .filter(Boolean)
            .concat(className ? [className] : [])
            .join(" ");

        return (
            <button ref={ref} className={classes} {...rest}>
                {icon ? (
                    <Icon type={icon} className={styles.icon} />
                ) : null}
                {children}
            </button>
        );
    }
);
