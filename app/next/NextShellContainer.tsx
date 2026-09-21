// Real data wiring for NextShell (docs/UI_MIGRATION_PLAN.md, Phase 1). This
// is what App.jsx mounts as the app's actual chrome, wrapping every route —
// it reads the same legacy Alt.js stores/actions Layout/Header.jsx and
// Layout/Footer.jsx used to read (the adapter pattern from §6.2), then
// hands the results to the presentational NextShell as props. Kept
// separate from NextShell itself so the standalone preview harness
// (app/next/preview-entry.tsx, webpack.preview.config.js) can render
// NextShell with static data without pulling in bitsharesjs and the rest
// of the legacy store graph.
//
// Anything with real existing behavior (node selection, send/deposit/
// withdraw, account browsing-mode banner) is reused from its legacy
// component here, not reimplemented — docs/UI_MIGRATION_PLAN.md's
// "reuse, don't rewrite" principle.
import * as React from "react";
import {useLocation} from "react-router-dom";
import NextShell from "./NextShell";
import {Button} from "../design-system/Button";
import {useTheme} from "../design-system/ThemeProvider";
import {ThemeName} from "../design-system/tokens";
import {RailNavGroup} from "../design-system/Rail";
import {useAltStore} from "./hooks/useAltStore";
// Untyped legacy Alt.js stores/actions/components (no .d.ts yet) —
// resolved via tsconfig's baseUrl the same way webpack resolves them via
// resolve.modules.
import AccountStore from "stores/AccountStore";
import BlockchainStore from "stores/BlockchainStore";
import WalletUnlockStore from "stores/WalletUnlockStore";
import SettingsStore from "stores/SettingsStore";
import GatewayStore from "stores/GatewayStore";
import IntlStore from "stores/IntlStore";
import AccountActions from "actions/AccountActions";
import WalletUnlockActions from "actions/WalletUnlockActions";
import SettingsActions from "actions/SettingsActions";
import IntlActions from "actions/IntlActions";
import WalletDb from "stores/WalletDb";
import {
    setLocalStorageType,
    isPersistantType
} from "lib/common/localStorage";
import NodeSelector from "components/Utility/NodeSelector";
import AccountBrowsingMode from "components/Account/AccountBrowsingMode";
import SendModal from "components/Modal/SendModal";
import DepositModal from "components/Modal/DepositModal";
import WithdrawModal from "components/Modal/WithdrawModalNew";
import {getDefaultMarket} from "branding";

interface ImmutableSetLike<T> {
    toArray(): T[];
}

interface AccountStoreState {
    currentAccount: string | null;
    passwordAccount: string | null;
    myActiveAccounts: ImmutableSetLike<string>;
}

interface BlockchainStoreState {
    rpc_connection_status: string | null;
}

interface WalletUnlockStoreState {
    locked: boolean;
    rememberMe: boolean;
}

interface ImmutableMapLike {
    get(key: string): unknown;
}

interface SettingsStoreState {
    settings: ImmutableMapLike;
    defaults: {locale: string[]};
}

interface GatewayStoreState {
    backedCoins: unknown;
}

interface IntlStoreState {
    currentLocale: string;
}

const NAV_GROUPS: RailNavGroup[] = [
    {
        label: "Account",
        items: [
            {label: "Dashboard", to: "/", exact: true},
            {label: "Accounts", to: "/accounts"},
            {label: "Settings", to: "/settings"}
        ]
    },
    {
        label: "Markets",
        items: [
            {label: "Trade", to: `/market/${getDefaultMarket()}`},
            {label: "Liquidity pools", to: "/pools"},
            {label: "Explorer", to: "/explorer"}
        ]
    }
];

// The legacy `themes` setting has 3 values (darkTheme/lightTheme/
// midnightTheme); this design system has 2. Reading collapses midnight
// into dark (closest visual match); writing from here only ever picks
// "darkTheme" or "lightTheme" — a deliberate product decision to retire
// the midnight option going forward, not an oversight. The legacy
// Settings page's own theme control (app/components/Settings/Settings.jsx)
// writes the same setting and still offers midnight; that's unaffected
// until Settings itself gets migrated.
function legacyThemeToThemeName(legacyTheme: unknown): ThemeName {
    return legacyTheme === "lightTheme" ? "light" : "dark";
}

function themeNameToLegacyTheme(theme: ThemeName): string {
    return theme === "light" ? "lightTheme" : "darkTheme";
}

function RailThemeToggle() {
    const {theme, toggleTheme} = useTheme();
    return (
        <Button onClick={toggleTheme} style={{width: "100%"}}>
            {theme === "dark" ? "Light theme" : "Dark theme"}
        </Button>
    );
}

export interface NextShellContainerProps {
    /** The real route content (App.jsx's <Switch>...</Switch>). */
    content: React.ReactNode;
}

// Capitalized first path segment as a stand-in breadcrumb (e.g. "/market/
// BTS_CNY" -> "Market"). Real per-route breadcrumbs/titles are a Phase 2
// concern (each migrated screen can pass its own); this just keeps the
// topbar from lying with a hardcoded "Phase 1 shell preview" label now
// that the shell wraps every route, not just /next.
function crumbFromPath(pathname: string): string {
    const segment = pathname.split("/").filter(Boolean)[0];
    if (!segment) return "Dashboard";
    return segment.charAt(0).toUpperCase() + segment.slice(1);
}

export default function NextShellContainer({
    content
}: NextShellContainerProps): JSX.Element {
    const account = useAltStore<AccountStoreState>(AccountStore);
    const blockchain = useAltStore<BlockchainStoreState>(BlockchainStore);
    const walletUnlock = useAltStore<WalletUnlockStoreState>(
        WalletUnlockStore
    );
    const settings = useAltStore<SettingsStoreState>(SettingsStore);
    const gateway = useAltStore<GatewayStoreState>(GatewayStore);
    const intl = useAltStore<IntlStoreState>(IntlStore);
    const location = useLocation();

    const currentAccount = account.currentAccount || account.passwordAccount;
    const accounts = account.myActiveAccounts.toArray();
    const activeNode = settings.settings.get("activeNode") as string | null;
    const themeValue = legacyThemeToThemeName(settings.settings.get("themes"));

    const sendModalRef = React.useRef<{show: () => void} | null>(null);
    const [depositVisible, setDepositVisible] = React.useState(false);
    const [depositEverShown, setDepositEverShown] = React.useState(false);
    const [withdrawVisible, setWithdrawVisible] = React.useState(false);
    const [withdrawEverShown, setWithdrawEverShown] = React.useState(false);

    // Same logic as the legacy Layout/Header.jsx's _toggleLock — replicated
    // exactly rather than restated, per AGENTS.md: wallet-unlock code is
    // security-sensitive, prefer minimal, well-tested diffs over refactors.
    const onToggleLock = React.useCallback(() => {
        if (WalletDb.isLocked()) {
            WalletUnlockActions.unlock()
                .then(() => {
                    AccountActions.tryToSetCurrentAccount();
                })
                .catch(() => {});
        } else {
            WalletUnlockActions.lock();
            if (!walletUnlock.rememberMe) {
                if (!isPersistantType()) {
                    setLocalStorageType("persistant");
                }
                AccountActions.setPasswordAccount(null);
                AccountStore.tryToSetCurrentAccount();
            }
        }
    }, [walletUnlock.rememberMe]);

    return (
        <>
            <NextShell
                navGroups={NAV_GROUPS}
                crumb={crumbFromPath(location.pathname)}
                railFooter={<RailThemeToggle />}
                currentAccount={currentAccount}
                accounts={accounts}
                onSelectAccount={name =>
                    AccountActions.setCurrentAccount.defer(name)
                }
                connectionStatus={blockchain.rpc_connection_status}
                activeNode={activeNode}
                nodeSelector={<NodeSelector />}
                locked={walletUnlock.locked}
                onToggleLock={onToggleLock}
                currentLocale={intl.currentLocale}
                locales={settings.defaults.locale}
                onSelectLocale={locale => IntlActions.switchLocale(locale)}
                onShowSend={() => sendModalRef.current?.show()}
                onShowDeposit={() => {
                    setDepositVisible(true);
                    setDepositEverShown(true);
                }}
                onShowWithdraw={() => {
                    setWithdrawVisible(true);
                    setWithdrawEverShown(true);
                }}
                themeValue={themeValue}
                onThemeChange={theme =>
                    SettingsActions.changeSetting({
                        setting: "themes",
                        value: themeNameToLegacyTheme(theme)
                    })
                }
                content={
                    <>
                        <AccountBrowsingMode location={location} />
                        {content}
                    </>
                }
            />
            <SendModal
                id="send_modal_next_shell"
                refCallback={(e: {show: () => void} | null) => {
                    sendModalRef.current = e;
                }}
                from_name={currentAccount}
            />
            {depositEverShown && (
                <DepositModal
                    visible={depositVisible}
                    hideModal={() => setDepositVisible(false)}
                    showModal={() => setDepositVisible(true)}
                    modalId="deposit_modal_next_shell"
                    account={currentAccount}
                    backedCoins={gateway.backedCoins}
                />
            )}
            {withdrawEverShown && (
                <WithdrawModal
                    visible={withdrawVisible}
                    hideModal={() => setWithdrawVisible(false)}
                    showModal={() => setWithdrawVisible(true)}
                    modalId="withdraw_modal_next_shell"
                    backedCoins={gateway.backedCoins}
                />
            )}
        </>
    );
}
