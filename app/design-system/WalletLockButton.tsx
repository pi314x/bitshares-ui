import * as React from "react";
import styles from "./WalletLockButton.module.scss";

export interface WalletLockButtonProps {
    /** WalletUnlockStore's `locked`, or null before it's known. */
    locked: boolean | null;
    onToggle: () => void;
}

// Replaces the legacy Header's lock/unlock indicator. Deliberately just
// toggles the SAME WalletUnlockActions.lock()/unlock() the legacy Header
// calls (see NextShellContainer) rather than reimplementing the unlock
// flow (password prompt, brainkey, etc.) — that flow is security-sensitive
// and already exists; this button only needs to trigger it.
export function WalletLockButton({
    locked,
    onToggle
}: WalletLockButtonProps): JSX.Element {
    const label =
        locked === null ? "Wallet" : locked ? "Locked" : "Unlocked";
    return (
        <button type="button" className={styles.btn} onClick={onToggle}>
            <span
                className={`${styles.dot} ${
                    locked ? styles.locked : styles.unlocked
                }`}
                aria-hidden="true"
            />
            {label}
        </button>
    );
}
