// Presentational shell for the strangler-fig rewrite
// (docs/UI_MIGRATION_PLAN.md, Phase 0/1): Rail + Topbar + content area.
// Takes its data as props rather than reading stores itself, on purpose —
// see NextShellContainer.tsx for why (it's the one that reads the real
// Alt.js stores and is what App.jsx actually mounts at /next).
import * as React from "react";
import {Link, useLocation} from "react-router-dom";
import {ThemeProvider} from "../design-system/ThemeProvider";
import {ThemeName} from "../design-system/tokens";
import {Rail, RailNavGroup} from "../design-system/Rail";
import {Topbar} from "../design-system/Topbar";
import styles from "./NextShell.module.scss";
import "../design-system/theme.scss";
import "../design-system/fonts";

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
    accountBadges?: Record<string, string>;
    onLogout?: () => void;
    /** WalletUnlockStore's `locked`, or null before it's known. */
    locked: boolean | null;
    onToggleLock: () => void;
    /** Overrides the lock button's text (see design-system/WalletLockButton). */
    lockLabel?: string | null;
    currentLocale: string | null;
    locales: string[];
    onSelectLocale: (locale: string) => void;
    onShowSend: () => void;
    onShowDeposit: () => void;
    onShowWithdraw: () => void;
    /** See TopbarProps.extensionAction. */
    extensionAction?: {label: string; onClick: () => void; disabled?: boolean};
    /** The block's status, in the status bar at the very end of the page. */
    statusDock?: React.ReactNode;
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
    accountBadges,
    onLogout,
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
    statusDock,
    content
}: Omit<NextShellProps, "themeValue" | "onThemeChange">) {
    // Phone width: the rail is a drawer. It closes on navigation, on Escape and
    // when the backdrop is tapped, and the page behind it does not scroll.
    const [navOpen, setNavOpen] = React.useState(false);
    const {pathname} = useLocation();
    const closeNav = React.useCallback(() => setNavOpen(false), []);
    React.useEffect(() => setNavOpen(false), [pathname]);
    React.useEffect(() => {
        if (!navOpen) return undefined;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setNavOpen(false);
        };
        document.addEventListener("keydown", onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.removeEventListener("keydown", onKey);
            document.body.style.overflow = previous;
        };
    }, [navOpen]);

    return (
        <div className={styles.shell}>
            {navOpen && (
                <div
                    className={styles.scrim}
                    onClick={closeNav}
                    aria-hidden="true"
                    data-testid="nav-scrim"
                />
            )}
            <Rail
                id="main-nav"
                groups={navGroups}
                footer={railFooter}
                open={navOpen}
                onNavigate={closeNav}
                onAction={action => {
                    if (action === "send") onShowSend();
                    else if (action === "deposit") onShowDeposit();
                    else if (action === "withdraw") onShowWithdraw();
                }}
                onClose={closeNav}
            />
            <div className={styles.main}>
                <Topbar
                    crumb={crumb}
                    connectionStatus={connectionStatus}
                    activeNode={activeNode}
                    nodeSelector={nodeSelector}
                    currentAccount={currentAccount}
                    accounts={accounts}
                    onSelectAccount={onSelectAccount}
                    accountBadges={accountBadges}
                    onLogout={onLogout}
                    hideConnection
                    locked={locked}
                    onToggleLock={onToggleLock}
                    lockLabel={lockLabel}
                    currentLocale={currentLocale}
                    locales={locales}
                    onSelectLocale={onSelectLocale}
                    extensionAction={extensionAction}
                    onOpenNav={() => setNavOpen(true)}
                    navOpen={navOpen}
                    navId="main-nav"
                />
                <div className={styles.content}>{content}</div>
                {/* the very end of the page: a row of its own after the
                    content (never over it), the same place at every width */}
                <div className={styles.status} role="contentinfo">
                    <Link
                        to="/settings/access"
                        className={styles.chip}
                        title={activeNode || "Nodes"}
                        aria-label={`Nodes: ${
                            connectionStatus === "open"
                                ? "connected"
                                : connectionStatus || "connecting"
                        }`}
                    >
                        <span
                            className={`${styles.chipDot} ${
                                connectionStatus === "open"
                                    ? styles.chipDotOk
                                    : styles.chipDotWarn
                            }`}
                            aria-hidden="true"
                        />
                        <span className={styles.nodeText}>
                            {connectionStatus === "open"
                                ? "Connected"
                                : connectionStatus || "Connecting…"}
                        </span>
                        {statusDock}
                    </Link>
                </div>
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
