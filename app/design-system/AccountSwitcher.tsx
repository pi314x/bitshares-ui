import * as React from "react";
import styles from "./AccountSwitcher.module.scss";
import {useClickOutside} from "../next/hooks/useClickOutside";

export interface AccountSwitcherProps {
    currentAccount: string | null;
    /** The accounts this browser holds keys for (AccountStore's myActiveAccounts). */
    accounts: string[];
    onSelect: (accountName: string) => void;
    /** A short note shown next to an account ("Extension"), by account name. */
    badges?: Record<string, string>;
    /** Shows "Log out" at the end of the menu when given. */
    onLogout?: () => void;
    /** Accounts the user follows (not their own): listed after their own. */
    followedAccounts?: string[];
    /**
     * Follow / unfollow the current account when it is not one of the user's
     * own: `following` says which of the two the entry offers.
     */
    follow?: {following: boolean; onToggle: () => void};
}

// Replaces the legacy Header's account dropdown for the new shell. Reads
// and writes the same account list / current-account selection
// (docs/UI_MIGRATION_PLAN.md §6.2's adapter pattern) via props from
// NextShellContainer, which is what actually touches AccountStore /
// AccountActions.
export function AccountSwitcher({
    currentAccount,
    accounts,
    onSelect,
    badges,
    onLogout,
    followedAccounts = [],
    follow
}: AccountSwitcherProps): JSX.Element {
    const [open, setOpen] = React.useState(false);
    const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);

    const renderItem = (name: string) => (
        <button
            key={name}
            type="button"
            role="menuitem"
            className={`${styles.item} ${
                name === currentAccount ? styles.itemActive : ""
            }`}
            onClick={() => {
                onSelect(name);
                setOpen(false);
            }}
        >
            {name}
            {badges && badges[name] ? (
                <span className={styles.badge}>{badges[name]}</span>
            ) : null}
        </button>
    );

    return (
        <div className={styles.wrap} ref={ref}>
            <button
                type="button"
                className={styles.trigger}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen(o => !o)}
            >
                <span className={styles.name}>
                    {currentAccount || "No account"}
                </span>
                <span className={styles.caret} aria-hidden="true">
                    ▾
                </span>
            </button>
            {open ? (
                <div className={styles.menu} role="menu">
                    {accounts.length === 0 && followedAccounts.length === 0 ? (
                        <div className={styles.empty}>No accounts</div>
                    ) : (
                        <>
                            {accounts.map(name => renderItem(name))}
                            {followedAccounts.length > 0 ? (
                                <>
                                    <div className={styles.group}>Followed</div>
                                    {followedAccounts.map(name =>
                                        renderItem(name)
                                    )}
                                </>
                            ) : null}
                        </>
                    )}
                    {follow && currentAccount ? (
                        <button
                            type="button"
                            role="menuitem"
                            className={`${styles.item} ${styles.follow}`}
                            onClick={() => {
                                follow.onToggle();
                                setOpen(false);
                            }}
                        >
                            {follow.following
                                ? `Unfollow ${currentAccount}`
                                : `Follow ${currentAccount}`}
                        </button>
                    ) : null}
                    {onLogout && currentAccount ? (
                        <button
                            type="button"
                            role="menuitem"
                            className={`${styles.item} ${styles.logout}`}
                            onClick={() => {
                                onLogout();
                                setOpen(false);
                            }}
                        >
                            Log out
                        </button>
                    ) : null}
                </div>
            ) : null}
        </div>
    );
}
