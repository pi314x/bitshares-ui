// A labelled field of the strategy cards: the label above, the control, and under it the problem (red) or the help (muted).
import * as React from "react";
import styles from "./StrategiesPage.module.scss";

export function Field(props: {
    label: React.ReactNode;
    help?: React.ReactNode;
    error?: string | null;
    children: React.ReactNode;
}) {
    return (
        <div className={styles.field}>
            <span className={styles.label}>{props.label}</span>
            {props.children}
            {props.error ? (
                <span className={styles.error}>{props.error}</span>
            ) : props.help ? (
                <span className={styles.help}>{props.help}</span>
            ) : null}
        </div>
    );
}
