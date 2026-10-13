// Loading indicators. Originally a mechanical port of the legacy
// LoadingIndicator.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md); restyled onto the
// design tokens (LoadingIndicator.module.scss): "circle"/"circle-small" are an
// SVG ring, "three-bounce" three soft dots, anything else (the default and
// LoadingButton's "loading-overlay") a centred ring over the parent with the
// optional text. The legacy `progress` counter that always rendered "0" is gone.
//
// Not security-sensitive per AGENTS.md: purely presentational.
import * as React from "react";
import styles from "./LoadingIndicator.module.scss";

interface LoadingIndicatorProps {
    type?: string | null;
    loadingText?: string | null;
    children?: React.ReactNode;
}

function Ring({small}: {small?: boolean}) {
    return (
        <svg
            className={`${styles.ring} ${
                small ? styles.ringSmall : ""
            } circle-wrapper`}
            viewBox="0 0 24 24"
            role="status"
            aria-label="Loading"
        >
            <circle className={styles.ringTrack} cx="12" cy="12" r="9" />
            <circle className={styles.ringArc} cx="12" cy="12" r="9" />
        </svg>
    );
}

export default function LoadingIndicator({
    type = null,
    loadingText = null,
    children
}: LoadingIndicatorProps) {
    switch (type) {
        case "three-bounce":
            return (
                <span
                    className={styles.dots}
                    role="status"
                    aria-label="Loading"
                >
                    <span />
                    <span />
                    <span />
                </span>
            );
        case "circle":
            return <Ring />;
        case "circle-small":
            return <Ring small />;
        default:
            return (
                <div className={styles.overlay}>
                    <Ring />
                    {loadingText && (
                        <p className={styles.text}>{loadingText}</p>
                    )}
                    {!!children && <div>{children}</div>}
                </div>
            );
    }
}
