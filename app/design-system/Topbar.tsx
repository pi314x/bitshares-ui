import * as React from "react";
import styles from "./Topbar.module.scss";
import {AccountSwitcher} from "./AccountSwitcher";
import {WalletLockButton} from "./WalletLockButton";
import {NodePicker} from "./NodePicker";
import {LocaleSwitcher} from "./LocaleSwitcher";
import {Button} from "./Button";
import {ExtensionChip} from "./ExtensionChip";

export interface TopbarProps {
    crumb: string;
    /** BlockchainStore's `rpc_connection_status` ("open" | "closed" | "reconnect" | "error" | null). */
    connectionStatus: string | null;
    /** SettingsStore's `activeNode` setting, e.g. "wss://node.xbts.io/ws". */
    activeNode: string | null;
    /** The legacy Utility/NodeSelector component — see NodePicker's comment. */
    nodeSelector: React.ReactNode;
    currentAccount: string | null;
    accounts: string[];
    onSelectAccount: (accountName: string) => void;
    accountBadges?: Record<string, string>;
    /** The connection chip lives in the status bar at the bottom instead. */
    hideConnection?: boolean;
    /** "Log out" in the account menu. */
    onLogout?: () => void;
    /** WalletUnlockStore's `locked`, or null before it's known. */
    locked: boolean | null;
    onToggleLock: () => void;
    /** Overrides the lock button's text; see WalletLockButton. */
    lockLabel?: string | null;
    currentLocale: string | null;
    locales: string[];
    onSelectLocale: (locale: string) => void;
    /** Optional: the shell offers these in the menu (Payments) instead. */
    onShowSend?: () => void;
    onShowDeposit?: () => void;
    onShowWithdraw?: () => void;
    /**
     * One-click opt-in to a detected wallet browser extension (shown only while
     * it is installed and not the signer). Omit it and nothing shows.
     */
    extensionAction?: {label: string; onClick: () => void; disabled?: boolean};
    /** Phone width: opens the navigation drawer; omit it and no menu button shows. */
    onOpenNav?: () => void;
    navOpen?: boolean;
    navId?: string;
}

export function Topbar({
    crumb,
    connectionStatus,
    activeNode,
    nodeSelector,
    currentAccount,
    accounts,
    onSelectAccount,
    accountBadges,
    onLogout,
    hideConnection = false,
    locked,
    onToggleLock,
    lockLabel,
    currentLocale,
    locales,
    onSelectLocale,
    onShowSend,
    onShowDeposit,
    onShowWithdraw,
    extensionAction,
    onOpenNav,
    navOpen = false,
    navId
}: TopbarProps): JSX.Element {
    const connected = connectionStatus === "open";
    return (
        <header className={styles.topbar}>
            {onOpenNav && (
                <button
                    type="button"
                    className={styles.menuBtn}
                    aria-label="Menu"
                    aria-expanded={navOpen}
                    aria-controls={navId}
                    onClick={onOpenNav}
                >
                    <span className={styles.menuBars} aria-hidden="true" />
                </button>
            )}
            <span className={styles.crumb}>{crumb}</span>
            <span className={styles.spacer} />
            {(onShowSend || onShowDeposit || onShowWithdraw) && (
                <div className={styles.actions}>
                    {onShowSend && <Button onClick={onShowSend}>Send</Button>}
                    {onShowDeposit && (
                        <Button onClick={onShowDeposit}>Deposit</Button>
                    )}
                    {onShowWithdraw && (
                        <Button onClick={onShowWithdraw}>Withdraw</Button>
                    )}
                </div>
            )}
            <div className={styles.status}>
                {hideConnection ? null : (
                    <NodePicker
                        connected={connected}
                        label={
                            connected
                                ? "Connected"
                                : connectionStatus || "Connecting…"
                        }
                    >
                        <div
                            style={{
                                fontSize: 12,
                                color: "var(--muted)",
                                marginBottom: 8
                            }}
                        >
                            {activeNode || "No node selected"}
                        </div>
                        {nodeSelector}
                    </NodePicker>
                )}
                <LocaleSwitcher
                    currentLocale={currentLocale}
                    locales={locales}
                    onSelect={onSelectLocale}
                />
                <WalletLockButton
                    locked={locked}
                    onToggle={onToggleLock}
                    label={lockLabel}
                />
                {extensionAction && (
                    <ExtensionChip
                        label={extensionAction.label}
                        onClick={extensionAction.onClick}
                        disabled={extensionAction.disabled}
                    />
                )}
                <AccountSwitcher
                    currentAccount={currentAccount}
                    accounts={accounts}
                    onSelect={onSelectAccount}
                    badges={accountBadges}
                    onLogout={onLogout}
                />
            </div>
        </header>
    );
}
