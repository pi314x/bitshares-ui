import * as React from "react";
import styles from "./Button.module.scss";

export type ButtonVariant = "default" | "accent";

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    function Button({variant = "default", className, ...rest}, ref) {
        const classes = [styles.btn, variant === "accent" ? styles.accent : ""]
            .filter(Boolean)
            .concat(className ? [className] : [])
            .join(" ");

        return <button ref={ref} className={classes} {...rest} />;
    }
);
