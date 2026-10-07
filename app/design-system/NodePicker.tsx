import * as React from "react";
import styles from "./NodePicker.module.scss";
import {useClickOutside} from "../next/hooks/useClickOutside";

export interface NodePickerProps {
    connected: boolean;
    label: string;
    /**
     * The legacy `Utility/NodeSelector` component, rendered here rather
     * than reimplemented — it already connects to SettingsStore and
     * handles node ping/selection itself (docs/UI_MIGRATION_PLAN.md's
     * "reuse, don't rewrite" for anything with real existing behavior).
     */
    children: React.ReactNode;
}

export function NodePicker({
    connected,
    label,
    children
}: NodePickerProps): JSX.Element {
    const [open, setOpen] = React.useState(false);
    const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);

    return (
        <div className={styles.wrap} ref={ref}>
            <button
                type="button"
                className={styles.trigger}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={() => setOpen(o => !o)}
            >
                <span
                    className={`${styles.dot} ${
                        connected ? styles.dotOk : styles.dotWarn
                    }`}
                    aria-hidden="true"
                />
                {label}
            </button>
            {open ? <div className={styles.panel}>{children}</div> : null}
        </div>
    );
}
