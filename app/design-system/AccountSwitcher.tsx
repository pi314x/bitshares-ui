import * as React from "react";
import styles from "./AccountSwitcher.module.scss";
import {useClickOutside} from "../next/hooks/useClickOutside";

export interface AccountSwitcherProps {
    currentAccount: string | null;
    /** The accounts this browser holds keys for (AccountStore's myActiveAccounts). */
    accounts: string[];
    onSelect: (accountName: string) => void;
}

// Replaces the legacy Header's account dropdown for the new shell. Reads
// and writes the same account list / current-account selection
// (docs/UI_MIGRATION_PLAN.md §6.2's adapter pattern) via props from
// NextShellContainer, which is what actually touches AccountStore /
// AccountActions.
export function AccountSwitcher({
    currentAccount,
    accounts,
    onSelect
}: AccountSwitcherProps): JSX.Element {
    const [open, setOpen] = React.useState(false);
    const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);

    return (
        <div className={styles.wrap} ref={ref}>
            <button
                type="button"
                className={styles.trigger}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen(o => !o)}
            >
                {currentAccount || "No account"}
                <span className={styles.caret} aria-hidden="true">
                    ▾
                </span>
            </button>
            {open ? (
                <div className={styles.menu} role="menu">
                    {accounts.length === 0 ? (
                        <div className={styles.empty}>No accounts</div>
                    ) : (
                        accounts.map(name => (
                            <button
                                key={name}
                                type="button"
                                role="menuitem"
                                className={`${styles.item} ${
                                    name === currentAccount
                                        ? styles.itemActive
                                        : ""
                                }`}
                                onClick={() => {
                                    onSelect(name);
                                    setOpen(false);
                                }}
                            >
                                {name}
                            </button>
                        ))
                    )}
                </div>
            ) : null}
        </div>
    );
}
