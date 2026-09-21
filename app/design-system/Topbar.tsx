import * as React from "react";
import styles from "./Topbar.module.scss";

export interface TopbarProps {
    crumb: string;
    /** BlockchainStore's `rpc_connection_status` ("open" | "closed" | "reconnect" | "error" | null). */
    connectionStatus: string | null;
    accountName: string | null;
}

export function Topbar({
    crumb,
    connectionStatus,
    accountName
}: TopbarProps): JSX.Element {
    const connected = connectionStatus === "open";
    return (
        <header className={styles.topbar}>
            <span className={styles.crumb}>{crumb}</span>
            <span className={styles.spacer} />
            <span className={styles.chip}>
                <span
                    className={`${styles.dot} ${
                        connected ? styles.dotOk : styles.dotWarn
                    }`}
                    aria-hidden="true"
                />
                {connected ? "Connected" : connectionStatus || "Connecting…"}
            </span>
            {accountName ? (
                <span className={styles.chip}>{accountName}</span>
            ) : null}
        </header>
    );
}
