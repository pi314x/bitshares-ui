import * as React from "react";
import styles from "./WalletLockButton.module.scss";

export interface WalletLockButtonProps {
    /** WalletUnlockStore's `locked`, or null before it's known. */
    locked: boolean | null;
    onToggle: () => void;
    /** Replaces the Locked/Unlocked text (e.g. "Extension" while the wallet
     * extension is the signer, where the local wallet's lock state is moot). */
    label?: string | null;
}

// Replaces the legacy Header's lock/unlock indicator. Deliberately just
// toggles the SAME WalletUnlockActions.lock()/unlock() the legacy Header
// calls (see NextShellContainer) rather than reimplementing the unlock
// flow (password prompt, brainkey, etc.) — that flow is security-sensitive
// and already exists; this button only needs to trigger it.
export function WalletLockButton({
    locked,
    onToggle,
    label: labelOverride
}: WalletLockButtonProps): JSX.Element {
    const label =
        labelOverride ||
        (locked === null ? "Wallet" : locked ? "Locked" : "Unlocked");
    const hint =
        locked === null || labelOverride
            ? undefined
            : locked
            ? "Wallet locked - click to unlock"
            : "Wallet unlocked - click to lock";
    return (
        <button
            type="button"
            className={styles.btn}
            onClick={onToggle}
            title={hint}
            aria-label={hint ? `${label}. ${hint}` : label}
        >
            <svg
                className={`${styles.padlock} ${
                    locked ? styles.locked : styles.unlocked
                }`}
                viewBox="0 0 16 16"
                width="14"
                height="14"
                aria-hidden="true"
            >
                <rect x="3" y="7" width="10" height="7" rx="1.5" />
                {locked ? (
                    <path d="M5 7V5a3 3 0 0 1 6 0v2" />
                ) : (
                    <path d="M5 7V5a3 3 0 0 1 5.6-1.5" />
                )}
            </svg>
            {label}
        </button>
    );
}
