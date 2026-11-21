// "A backup is required": the reminder the original footer showed while the
// local wallet has never been backed up, or has changed since (a key was
// added). Losing the browser's storage loses the keys, so this one stays
// visible until the backup is made. Nothing here reads a key: it looks at the
// wallet's backup date and the cached "backup recommended" flag only.
import * as React from "react";
import {useNavigate} from "react-router-dom";
import counterpart from "counterpart";
import WalletDb from "stores/WalletDb";
import {useAltStore, AltStore} from "./hooks/useAltStore";
import {useReduxState} from "./hooks/useReduxState";
import {selectCachedPropertyState} from "../store/slices/cachedPropertySlice";
import styles from "./BackupNotice.module.scss";

/** Whether the wallet needs a backup: it exists and has none, or it changed. */
export function backupNeeded(wallet: any, backupRecommended: unknown): boolean {
    return !!wallet && (!wallet.backup_date || !!backupRecommended);
}

export default function BackupNotice(): JSX.Element | null {
    const navigate = useNavigate();
    const walletState = useAltStore(
        (WalletDb as unknown) as AltStore<{wallet: any}>
    );
    const cached = useReduxState<any>(selectCachedPropertyState);
    const flag =
        cached.props && typeof cached.props.get === "function"
            ? cached.props.get("backup_recommended")
            : undefined;
    if (!backupNeeded(walletState && walletState.wallet, flag)) return null;
    const label = counterpart.translate("footer.backup") as string;
    return (
        <button
            type="button"
            className={styles.chip}
            title={label}
            onClick={() => navigate("/wallet/backup/create")}
        >
            <span className={styles.dot} aria-hidden="true" />
            <span className={styles.long}>{label}</span>
            <span className={styles.short}>
                {counterpart.translate("settings.backup")}
            </span>
        </button>
    );
}
