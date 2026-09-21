// Real data wiring for NextShell (docs/UI_MIGRATION_PLAN.md, Phase 1). This
// is what App.jsx actually mounts at /next — reads the same legacy Alt.js
// stores/actions Layout/Header.jsx and Layout/Footer.jsx read (the adapter
// pattern from §6.2), then hands the results to the presentational
// NextShell as props. Kept separate from NextShell itself so the standalone
// preview harness (app/next/preview-entry.tsx, webpack.preview.config.js)
// can render NextShell with static data without pulling in bitsharesjs and
// the rest of the legacy store graph.
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
// the midnight option going forward, not an oversight. Legacy screens
// that still read `themes` directly (most of them, until they're migrated)
// are unaffected either way; they just stop offering midnight once a user
// touches this toggle.
function legacyThemeToThemeName(legacyTheme: unknown): ThemeName {
    return legacyTheme === "lightTheme" ? "light" : "dark";
}

function themeNameToLegacyTheme(theme: ThemeName): string {
    return theme === "light" ? "lightTheme" : "darkTheme";
}

function ThemeToggle() {
    const {theme, toggleTheme} = useTheme();
    return (
        <Button variant="accent" onClick={toggleTheme}>
            Switch to {theme === "dark" ? "light" : "dark"} theme
        </Button>
    );
}

function DemoContent() {
    const location = useLocation();
    return (
        <>
            <AccountBrowsingMode location={location} />
            <h1>BitShares — new UI shell</h1>
            <p style={{color: "var(--muted)"}}>
                Phase 1 slice: rail, topbar, account switcher, node picker,
                locale switcher, wallet lock and send/deposit/withdraw all
                read/write the same legacy Alt.js stores, actions and
                components (<code>stores/AccountStore</code>,{" "}
                <code>stores/BlockchainStore</code>,{" "}
                <code>stores/WalletUnlockStore</code>,{" "}
                <code>stores/SettingsStore</code>,{" "}
                <code>components/Utility/NodeSelector</code>,{" "}
                <code>components/Modal/SendModal</code>, etc.) the legacy
                Header/Footer use, via <code>NextShellContainer</code> — not
                a mock. See <code>docs/UI_MIGRATION_PLAN.md</code>.
            </p>
            <ThemeToggle />
        </>
    );
}

export default function NextShellContainer(): JSX.Element {
    const account = useAltStore<AccountStoreState>(AccountStore);
    const blockchain = useAltStore<BlockchainStoreState>(BlockchainStore);
    const walletUnlock = useAltStore<WalletUnlockStoreState>(
        WalletUnlockStore
    );
    const settings = useAltStore<SettingsStoreState>(SettingsStore);
    const gateway = useAltStore<GatewayStoreState>(GatewayStore);
    const intl = useAltStore<IntlStoreState>(IntlStore);

    const currentAccount = account.currentAccount || account.passwordAccount;
    const accounts = account.myActiveAccounts.toArray();
    const activeNode = settings.settings.get("activeNode") as string | null;
    const themeValue = legacyThemeToThemeName(settings.settings.get("themes"));

    const sendModalRef = React.useRef<{show: () => void} | null>(null);
    const [depositVisible, setDepositVisible] = React.useState(false);
    const [depositEverShown, setDepositEverShown] = React.useState(false);
    const [withdrawVisible, setWithdrawVisible] = React.useState(false);
    const [withdrawEverShown, setWithdrawEverShown] = React.useState(false);

    // Same logic as Layout/Header.jsx's _toggleLock — replicated exactly
    // rather than restated, per AGENTS.md: wallet-unlock code is
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
                content={<DemoContent />}
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
