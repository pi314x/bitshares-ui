// Presentational shell for the strangler-fig rewrite
// (docs/UI_MIGRATION_PLAN.md, Phase 0/1): Rail + Topbar + content area.
// Takes its data as props rather than reading stores itself, on purpose —
// see NextShellContainer.tsx for why (it's the one that reads the real
// Alt.js stores and is what App.jsx actually mounts at /next).
import * as React from "react";
import {ThemeProvider} from "../design-system/ThemeProvider";
import {ThemeName} from "../design-system/tokens";
import {Rail, RailNavGroup} from "../design-system/Rail";
import {Topbar} from "../design-system/Topbar";
import styles from "./NextShell.module.scss";
import "../design-system/theme.scss";
import "@fontsource/archivo/500.css";
import "@fontsource/archivo/600.css";
import "@fontsource/archivo/700.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";

export interface NextShellProps {
    navGroups: RailNavGroup[];
    crumb: string;
    railFooter?: React.ReactNode;
    /** BlockchainStore's `rpc_connection_status`, or null before it's known. */
    connectionStatus: string | null;
    /** SettingsStore's `activeNode` setting. */
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
    content: React.ReactNode;
    /**
     * Controlled theme (mapped from the legacy SettingsStore's 3-theme
     * `themes` setting onto this design system's 2 themes — see
     * NextShellContainer). Omit both for the standalone preview harness's
     * uncontrolled default.
     */
    themeValue?: ThemeName;
    onThemeChange?: (theme: ThemeName) => void;
}

function ShellChrome({
    navGroups,
    crumb,
    railFooter,
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
    onShowWithdraw,
    content
}: Omit<NextShellProps, "themeValue" | "onThemeChange">) {
    return (
        <div className={styles.shell}>
            <Rail groups={navGroups} footer={railFooter} />
            <div className={styles.main}>
                <Topbar
                    crumb={crumb}
                    connectionStatus={connectionStatus}
                    activeNode={activeNode}
                    nodeSelector={nodeSelector}
                    currentAccount={currentAccount}
                    accounts={accounts}
                    onSelectAccount={onSelectAccount}
                    locked={locked}
                    onToggleLock={onToggleLock}
                    currentLocale={currentLocale}
                    locales={locales}
                    onSelectLocale={onSelectLocale}
                    onShowSend={onShowSend}
                    onShowDeposit={onShowDeposit}
                    onShowWithdraw={onShowWithdraw}
                />
                <div className={styles.content}>{content}</div>
            </div>
        </div>
    );
}

export default function NextShell({
    themeValue,
    onThemeChange,
    ...rest
}: NextShellProps): JSX.Element {
    return (
        <ThemeProvider value={themeValue} onChange={onThemeChange}>
            <ShellChrome {...rest} />
        </ThemeProvider>
    );
}
