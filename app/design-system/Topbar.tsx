import * as React from "react";
import styles from "./Topbar.module.scss";
import {AccountSwitcher} from "./AccountSwitcher";
import {WalletLockButton} from "./WalletLockButton";
import {NodePicker} from "./NodePicker";
import {LocaleSwitcher} from "./LocaleSwitcher";
import {Button} from "./Button";

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
    /** WalletUnlockStore's `locked`, or null before it's known. */
    locked: boolean | null;
    onToggleLock: () => void;
    currentLocale: string | null;
    locales: string[];
    onSelectLocale: (locale: string) => void;
    onShowSend: () => void;
    onShowDeposit: () => void;
    onShowWithdraw: () => void;
}

export function Topbar({
    crumb,
    connectionStatus,
    activeNode,
    nodeSelector,
    currentAccount,
    accounts,
    onSelectAccount,
    locked,
    onToggleLock,
    currentLocale,
    locales,
    onSelectLocale,
    onShowSend,
    onShowDeposit,
    onShowWithdraw
}: TopbarProps): JSX.Element {
    const connected = connectionStatus === "open";
    return (
        <header className={styles.topbar}>
            <span className={styles.crumb}>{crumb}</span>
            <span className={styles.spacer} />
            <Button onClick={onShowSend}>Send</Button>
            <Button onClick={onShowDeposit}>Deposit</Button>
            <Button onClick={onShowWithdraw}>Withdraw</Button>
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
            <LocaleSwitcher
                currentLocale={currentLocale}
                locales={locales}
                onSelect={onSelectLocale}
            />
            <WalletLockButton locked={locked} onToggle={onToggleLock} />
            <AccountSwitcher
                currentAccount={currentAccount}
                accounts={accounts}
                onSelect={onSelectAccount}
            />
        </header>
    );
}
