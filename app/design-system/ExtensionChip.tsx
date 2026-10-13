import * as React from "react";
import styles from "./ExtensionChip.module.scss";

export interface ExtensionChipProps {
    label: string;
    onClick: () => void;
    disabled?: boolean;
}

// A small plug: the wallet extension is something you connect to.
const Plug = () => (
    <svg
        className={styles.plug}
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M5.5 1.5v3M10.5 1.5v3M3.5 4.5h9v2.5a4.5 4.5 0 0 1-9 0zM8 11.5v3" />
    </svg>
);

export function ExtensionChip({
    label,
    onClick,
    disabled
}: ExtensionChipProps): JSX.Element {
    return (
        <button
            type="button"
            className={styles.chip}
            onClick={onClick}
            disabled={disabled}
        >
            <Plug />
            {label}
        </button>
    );
}
