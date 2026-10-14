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
import {useLocation, useNavigate} from "react-router-dom";
import NextShell from "./NextShell";
import BlockStatus from "./BlockStatus";
import {LocaleSwitcher} from "../design-system/LocaleSwitcher";
import {Button} from "../design-system/Button";
import {useTheme} from "../design-system/ThemeProvider";
import {ThemeName} from "../design-system/tokens";
import {NAV_GROUPS, crumbFromPath} from "./navigation";
import {useReduxState} from "./hooks/useReduxState";
import {selectAccountState} from "../store/slices/accountSlice";
import {selectBlockchain} from "../store/slices/blockchainSlice";
import {selectWalletUnlockState} from "../store/slices/walletUnlockSlice";
import {selectSettingsState} from "../store/slices/settingsSlice";
import {selectGateway} from "../store/slices/gatewaySlice";
import {
    selectExternalSigner,
    selectExternalSigningActive
} from "../store/slices/externalSignerSlice";
import ExternalSignerActions from "../actions/ExternalSignerActions";
import {selectIntlState} from "../store/slices/intlSlice";
// Untyped legacy Alt.js stores/actions/components (no .d.ts yet) —
// resolved via tsconfig's baseUrl the same way webpack resolves them via
// resolve.modules.
import AccountStore from "stores/AccountStore";
import AccountActions from "actions/AccountActions";
import WalletUnlockActions from "actions/WalletUnlockActions";
import SettingsActions from "actions/SettingsActions";
import IntlActions from "actions/IntlActions";
import WalletDb from "stores/WalletDb";
import {setLocalStorageType, isPersistantType} from "lib/common/localStorage";
import {logoutSession} from "./logoutSession";
import NodeSelector from "components/Utility/NodeSelector";
import AccountBrowsingMode from "components/Account/AccountBrowsingMode";
import SendModal from "components/Modal/SendModal";
import TransactionConfirm from "components/Blockchain/TransactionConfirm";
import WalletUnlockModal from "components/Wallet/WalletUnlockModal";
import DepositModal from "components/Modal/DepositModal";
import WithdrawModal from "components/Modal/WithdrawModalNew";

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
    /** Set while a request to unlock waits for the user's answer. */
    resolve?: (() => void) | null;
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

export default function NextShellContainer({
    content
}: NextShellContainerProps): JSX.Element {
    const account = useReduxState<AccountStoreState>(selectAccountState);
    const blockchain = useReduxState<BlockchainStoreState>(selectBlockchain);
    const walletUnlock = useReduxState<WalletUnlockStoreState>(
        selectWalletUnlockState
    );
    const settings = useReduxState<SettingsStoreState>(selectSettingsState);
    const gateway = useReduxState<GatewayStoreState>(selectGateway);
    const intl = useReduxState<IntlStoreState>(selectIntlState);
    const location = useLocation();
    const navigate = useNavigate();
    // While the wallet extension is the signer, the local wallet's lock state is
    // moot: the pill says so and leads to the signing settings instead.
    const extensionSigning = useReduxState(selectExternalSigningActive);
    const externalSigner = useReduxState(selectExternalSigner);
    // The extension is installed (the provider answered), is not the signer, and
    // the user has not asked for it yet: offer the one-click switch. Local
    // signing stays the default; this only ever acts on a click.
    const extensionAction =
        !extensionSigning &&
        (externalSigner.status === "disconnected" ||
            externalSigner.status === "connecting")
            ? {
                  label:
                      externalSigner.status === "connecting"
                          ? "Connecting…"
                          : "Use extension",
                  disabled: externalSigner.status === "connecting",
                  onClick: () => {
                      ExternalSignerActions.setPreference("extension");
                      ExternalSignerActions.connect();
                  }
              }
            : undefined;

    const currentAccount = account.currentAccount || account.passwordAccount;
    // The extension's account is one of the choices while it is the signer (its
    // keys are not in the local wallet, so it is not in `myActiveAccounts`).
    // Accounts of the local wallet stay selectable and sign locally.
    const extensionAccount =
        extensionSigning && externalSigner.account
            ? externalSigner.account.accountName
            : null;
    const localAccounts = account.myActiveAccounts.toArray();
    const accounts =
        extensionAccount && !localAccounts.includes(extensionAccount)
            ? [extensionAccount, ...localAccounts]
            : localAccounts;
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

    // Log out: lock the wallet and forget the session's account (see
    // logoutSession.ts).
    const onLogout = React.useCallback(() => logoutSession(), []);

    // A request to unlock that was open when the user chose another page goes
    // away with it (it is shown in the page, not over it). Only a request that
    // was already pending *before* the change: a page may ask for its own.
    const unlockPending = !!walletUnlock.resolve;
    const pendingBefore = React.useRef(false);
    const lastPath = React.useRef(location.pathname);
    React.useEffect(() => {
        if (lastPath.current !== location.pathname) {
            lastPath.current = location.pathname;
            if (pendingBefore.current) WalletUnlockActions.cancel();
        }
        pendingBefore.current = unlockPending;
    });

    return (
        <>
            <NextShell
                navGroups={NAV_GROUPS}
                crumb={crumbFromPath(location.pathname)}
                railFooter={
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8
                        }}
                    >
                        <LocaleSwitcher
                            block
                            placement="top"
                            currentLocale={intl.currentLocale}
                            locales={settings.defaults.locale}
                            onSelect={locale =>
                                IntlActions.switchLocale(locale)
                            }
                        />
                        <RailThemeToggle />
                    </div>
                }
                currentAccount={currentAccount}
                accounts={accounts}
                onSelectAccount={name =>
                    AccountActions.setCurrentAccount.defer(name)
                }
                onLogout={onLogout}
                accountBadges={
                    extensionAccount
                        ? {[extensionAccount]: "Extension"}
                        : undefined
                }
                connectionStatus={blockchain.rpc_connection_status}
                activeNode={activeNode}
                nodeSelector={<NodeSelector />}
                locked={extensionSigning ? false : walletUnlock.locked}
                onToggleLock={
                    extensionSigning
                        ? () => navigate("/settings/signing")
                        : onToggleLock
                }
                lockLabel={extensionSigning ? "Extension" : null}
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
                extensionAction={extensionAction}
                statusDock={<BlockStatus />}
                themeValue={themeValue}
                onThemeChange={theme =>
                    SettingsActions.changeSetting({
                        setting: "themes",
                        value: themeNameToLegacyTheme(theme)
                    })
                }
                chips={<AccountBrowsingMode location={location} chip />}
                content={
                    <>
                        {/* "Confirm this transaction": in the page, not a popup */}
                        <TransactionConfirm inline />
                        {/* and "unlock your wallet" with it */}
                        <WalletUnlockModal inline />
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
