import React from "react";
import {ChainStore} from "bitsharesjs";
import AccountStore from "stores/AccountStore";
import NotificationStore from "stores/NotificationStore";
import {useLocation} from "react-router-dom";
import Translate from "react-translate-component";
import {
    DESKTOP_QUERY,
    DesktopModalContext,
    ModalOrPage,
    isDesktopModalPath
} from "./next/desktopModal";
import {useMediaQuery} from "./next/hooks/useMediaQuery";
import SyncError from "./components/SyncError";
import LoadingIndicator from "./components/LoadingIndicator";
import BrowserNotifications from "./components/BrowserNotifications/BrowserNotificationsContainer";
import ReactTooltip from "react-tooltip";
import TransactionConfirm from "./components/Blockchain/TransactionConfirm";
import WalletUnlockModal from "./components/Wallet/WalletUnlockModal";
import BrowserSupportModal from "./components/Modal/BrowserSupportModal";
import missingBrowserFeatures from "./lib/feature_detect/browserFeatures";
import Deprecate from "./Deprecate";
import Incognito from "./components/Layout/Incognito";
import {isIncognito} from "feature_detect";
import {updateGatewayBackers} from "common/gatewayUtils";
import titleUtils from "common/titleUtils";
import {BodyClassName} from "./design-system/BodyClassName";
import {Notification} from "./design-system/Notification";
import {htmlToText} from "./lib/common/notificationHistory";
import {DEFAULT_NOTIFICATION_DURATION} from "services/Notification";
import Loadable from "react-loadable";
import NewsHeadline from "components/Layout/NewsHeadline";

import {Routes, Route, Navigate} from "react-router-dom";
import {withLegacyRouterProps} from "./components/Utility/withLegacyRouterProps";

// Nested route components
import Page404 from "./components/Page404/Page404";

// The new app shell (docs/UI_MIGRATION_PLAN.md, Phase 1): replaces
// Layout/Header + Layout/Footer as the chrome wrapping every route below.
// It renders its own data-wired Rail/Topbar and takes the actual route
// <Switch> as its `content` prop (see the render() method).
const AppShell = Loadable({
    loader: () =>
        import(/* webpackChunkName: "app-shell" */ "./next/NextShellContainer"),
    loading: LoadingIndicator
});

const Invoice = withLegacyRouterProps(
    Loadable({
        loader: () =>
            import(
                /* webpackChunkName: "exchange" */ "./components/Transfer/Invoice"
            ),
        loading: LoadingIndicator
    })
);

const Exchange = withLegacyRouterProps(
    Loadable({
        loader: () =>
            import(
                /* webpackChunkName: "exchange" */ "./components/Exchange/ExchangeContainer"
            ),
        loading: LoadingIndicator
    })
);

const CreditOfferPage = Loadable({
    loader: () =>
        import(
            /* webpackChunkName: "explorer" */ "./components/Account/CreditOffer/CreditOfferPage"
        ),
    loading: LoadingIndicator
});

const SametFundsPage = Loadable({
    loader: () =>
        import(
            /* webpackChunkName: "explorer" */ "./components/Account/SametFund/SametFundsPage"
        ),
    loading: LoadingIndicator
});

const AdvancedPage = Loadable({
    loader: () =>
        import(
            /* webpackChunkName: "explorer" */ "./components/Advanced/AdvancedPage"
        ),
    loading: LoadingIndicator
});

// Send, Deposit and Withdraw as pages (the same dialogs, shown in the page)
const paymentPage = name =>
    Loadable({
        loader: () =>
            import(
                /* webpackChunkName: "app-shell" */ "./next/PaymentPages"
            ).then(module => module[name]),
        loading: LoadingIndicator
    });
const SendPage = paymentPage("SendPage");
const DepositPage = paymentPage("DepositPage");
const WithdrawPage = paymentPage("WithdrawPage");

const TimedTransferPage = Loadable({
    loader: () =>
        import(
            /* webpackChunkName: "account" */ "./components/Account/TimedTransferPage"
        ),
    loading: LoadingIndicator
});

const Explorer = Loadable({
    loader: () =>
        import(
            /* webpackChunkName: "explorer" */ "./components/Explorer/Explorer"
        ),
    loading: LoadingIndicator
});

const PredictionMarketsPage = Loadable({
    loader: () =>
        import(
            /* webpackChunkName: "pm" */ "./components/PredictionMarkets/PMAssetsContainer"
        ),
    loading: LoadingIndicator
});

const AccountPage = Loadable({
    loader: () =>
        import(
            /* webpackChunkName: "account" */ "./components/Account/AccountPage"
        ),
    loading: LoadingIndicator
});

const News = Loadable({
    loader: () => import(/* webpackChunkName: "news" */ "./components/News"),
    loading: LoadingIndicator
});

const Settings = Loadable({
    loader: () =>
        import(
            /* webpackChunkName: "settings" */ "./components/Settings/SettingsContainer"
        ),
    loading: LoadingIndicator
});

const Help = withLegacyRouterProps(
    Loadable({
        loader: () =>
            import(/* webpackChunkName: "help" */ "./components/Help"),
        loading: LoadingIndicator
    })
);

const Asset = Loadable({
    loader: () =>
        import(/* webpackChunkName: "asset" */ "./components/Blockchain/Asset"),
    loading: LoadingIndicator
});

const Block = withLegacyRouterProps(
    Loadable({
        loader: () =>
            import(
                /* webpackChunkName: "block" */ "./components/Blockchain/BlockContainer"
            ),
        loading: LoadingIndicator
    })
);

const DashboardAccountsOnly = Loadable({
    loader: () =>
        import(
            /* webpackChunkName: "dashboard-accounts" */ "./components/Dashboard/DashboardAccountsOnly"
        ),
    loading: LoadingIndicator
});

const DashboardPage = Loadable({
    loader: () =>
        import(
            /* webpackChunkName: "dashboard" */ "./components/Dashboard/DashboardPage"
        ),
    loading: LoadingIndicator
});

const WalletManager = Loadable({
    loader: () =>
        import(
            /* webpackChunkName: "wallet" */ "./components/Wallet/WalletManager"
        ),
    loading: LoadingIndicator
});

const ExistingAccount = Loadable({
    loader: () =>
        import(
            /* webpackChunkName: "existing-account" */ "./components/Wallet/ExistingAccount"
        ),
    loading: LoadingIndicator
});

const CreateWorker = Loadable({
    loader: () =>
        import(
            /* webpackChunkName: "create-worker" */ "./components/Account/CreateWorker"
        ),
    loading: LoadingIndicator
});

const Barter = Loadable({
    loader: () =>
        import(
            /* webpackChunkName: "settings" */ "./components/Showcases/Barter"
        ),
    loading: LoadingIndicator
});

const Borrow = Loadable({
    loader: () =>
        import(
            /* webpackChunkName: "settings" */ "./components/Showcases/Borrow"
        ),
    loading: LoadingIndicator
});

const Htlc = Loadable({
    loader: () =>
        import(
            /* webpackChunkName: "settings" */ "./components/Showcases/Htlc"
        ),
    loading: LoadingIndicator
});

const DirectDebit = Loadable({
    loader: () =>
        import(
            /* webpackChunkName: "settings" */ "./components/Showcases/DirectDebit"
        ),
    loading: LoadingIndicator
});

const QuickTrade = withLegacyRouterProps(
    Loadable({
        loader: () =>
            import(
                /* webpackChunkName: "QuickTrade" */ "./components/QuickTrade/QuickTradeRouter"
            ),
        loading: LoadingIndicator
    })
);

const PoolmartPage = Loadable({
    loader: () =>
        import(
            /* webpackChunkName: "poolmart" */ "./components/Poolmart/PoolmartPage"
        ),
    loading: LoadingIndicator
});

import LoginSelector from "./components/LoginSelector";
import Login from "./components/Login/Login";
import RegistrationSelector from "./components/Registration/RegistrationSelector";
import WalletRegistration from "./components/Registration/WalletRegistration";
import AccountRegistration from "./components/Registration/AccountRegistration";
import {CreateWalletFromBrainkey} from "./components/Wallet/WalletCreate";
import ShowcaseGrid from "./components/Showcases/ShowcaseGrid";
import PriceAlertNotifications from "./components/PriceAlertNotifications";
import GatewaySelectorModal from "./components/Gateways/GatewaySelectorModal";
import SettingsStore from "./stores/SettingsStore";
import GatewayActions from "./actions/GatewayActions";
import {allowedGateway} from "./branding";

// Route components that still read react-router v5's match/history/location
// props (see components/Utility/withLegacyRouterProps.tsx).
const LoginRoute = withLegacyRouterProps(Login);
const RegistrationSelectorRoute = withLegacyRouterProps(RegistrationSelector);
const WalletRegistrationRoute = withLegacyRouterProps(WalletRegistration);
const AccountRegistrationRoute = withLegacyRouterProps(AccountRegistration);

// The small pages (one short form each) that open as a dialog over the page the user
// came from on a desktop screen, and are a page of their own on a phone: the same
// elements serve both (`ModalOrPage` reads which one it is).
const desktopModalRoutes = [
    <Route key="deposit" path="/deposit" element={<DepositPage />} />,
    <Route key="withdraw" path="/withdraw" element={<WithdrawPage />} />,
    <Route
        key="instant"
        path="/instant-trade"
        element={
            <ModalOrPage
                title={<Translate content="showcases.instant_trade.title" />}
                width={680}
            >
                <QuickTrade />
            </ModalOrPage>
        }
    />,
    <Route
        key="instant-market"
        path="/instant-trade/:marketID"
        element={
            <ModalOrPage
                title={<Translate content="showcases.instant_trade.title" />}
                width={680}
            >
                <QuickTrade />
            </ModalOrPage>
        }
    />,
    <Route
        key="htlc"
        path="/htlc"
        element={
            <ModalOrPage
                title={<Translate content="showcases.htlc.title_short" />}
                width={980}
            >
                <Htlc />
            </ModalOrPage>
        }
    />,
    <Route
        key="direct-debit"
        path="/direct-debit"
        element={
            <ModalOrPage
                title={<Translate content="showcases.direct_debit.title" />}
                width={980}
            >
                <DirectDebit />
            </ModalOrPage>
        }
    />,
    <Route
        key="borrow"
        path="/borrow"
        element={
            <ModalOrPage
                title={<Translate content="showcases.borrow.title" />}
                width={880}
            >
                <Borrow />
            </ModalOrPage>
        }
    />
];

class App extends React.Component {
    constructor() {
        super();

        this.tooltipRef = React.createRef();

        let syncFail =
            ChainStore.subError &&
            ChainStore.subError.message ===
                "ChainStore sync error, please check your system clock"
                ? true
                : false;
        this.state = {
            isBrowserSupportModalVisible: false,
            isGatewaySelectorModalVisible: false,
            loading: false,
            synced: this._syncStatus(),
            syncFail,
            incognito: false,
            incognitoWarningDismissed: false,
            height: window && window.innerHeight
        };

        this._rebuildTooltips = this._rebuildTooltips.bind(this);
        this._chainStoreSub = this._chainStoreSub.bind(this);
        this._syncStatus = this._syncStatus.bind(this);
        this._getWindowHeight = this._getWindowHeight.bind(this);

        this.showBrowserSupportModal = this.showBrowserSupportModal.bind(this);
        this.hideBrowserSupportModal = this.hideBrowserSupportModal.bind(this);
        this.hideGatewaySelectorModal = this.hideGatewaySelectorModal.bind(
            this
        );

        Notification.config({
            duration: DEFAULT_NOTIFICATION_DURATION,
            top: 90
        });
    }

    componentWillUnmount() {
        window.removeEventListener("resize", this._getWindowHeight);
        NotificationStore.unlisten(this._onNotificationChange);
        ChainStore.unsubscribe(this._chainStoreSub);
        clearInterval(this.syncCheckInterval);
    }

    /**
     * Returns the current blocktime, or exception if not yet available
     * @returns {Date}
     */
    getBlockTime() {
        let dynGlobalObject = ChainStore.getObject("2.1.0");
        if (dynGlobalObject) {
            let block_time = dynGlobalObject.get("time");
            if (!/Z$/.test(block_time)) {
                block_time += "Z";
            }
            return new Date(block_time);
        } else {
            throw new Error("Blocktime not available right now");
        }
    }

    /**
     * Returns the delta between the current time and the block time in seconds, or -1 if block time not available yet
     *
     * Note: Could be integrating properly with BlockchainStore to send out updates, but not necessary atp
     */
    getBlockTimeDelta() {
        try {
            let bt =
                (this.getBlockTime().getTime() +
                    ChainStore.getEstimatedChainTimeOffset()) /
                1000;
            let now = new Date().getTime() / 1000;
            return Math.abs(now - bt);
        } catch (err) {
            return -1;
        }
    }

    hideBrowserSupportModal() {
        this.setState({
            isBrowserSupportModalVisible: false
        });
    }

    hideGatewaySelectorModal() {
        this.setState({
            isGatewaySelectorModalVisible: false
        });
    }

    showBrowserSupportModal() {
        this.setState({
            isBrowserSupportModalVisible: true
        });
    }

    _syncStatus(setState = false) {
        let synced = this.getBlockTimeDelta() < 5;
        if (setState && synced !== this.state.synced) {
            this.setState({synced});
        }
        return synced;
    }

    _setListeners() {
        try {
            window.addEventListener("resize", this._getWindowHeight, {
                capture: false,
                passive: true
            });
            NotificationStore.listen(this._onNotificationChange.bind(this));
            ChainStore.subscribe(this._chainStoreSub);
            AccountStore.tryToSetCurrentAccount();
        } catch (e) {
            console.error("e:", e);
        }
    }

    componentDidMount() {
        this._setListeners();
        this.syncCheckInterval = setInterval(
            this._syncStatus.bind(this, true),
            5000
        );
        // Not the browser's name, but what it lacks: any current browser
        // (Safari and iOS browsers included) passes.
        const missing = missingBrowserFeatures(window);
        if (!window.electron && missing.length) {
            console.warn("Browser lacks: " + missing.join(", "));
            this.showBrowserSupportModal();
        }

        this._rebuildTooltips();

        isIncognito(
            function(incognito) {
                this.setState({incognito});
            }.bind(this)
        );
        GatewayActions.loadOnChainGatewayConfig();

        if (allowedGateway()) {
            this._ensureExternalServices();
        }
    }

    _ensureExternalServices() {
        setTimeout(() => {
            let hasLoggedIn =
                AccountStore.getState().myActiveAccounts.size > 0 ||
                !!AccountStore.getState().passwordAccount;
            if (!hasLoggedIn) {
                this._ensureExternalServices();
            } else {
                this._checkExternalServices();
            }
        }, 5000);
    }

    _checkExternalServices() {
        if (
            SettingsStore.getState().viewSettings.get(
                "hasSeenExternalServices",
                false
            )
        ) {
            updateGatewayBackers();
        } else {
            this.setState({
                isGatewaySelectorModalVisible: true
            });
        }
    }

    componentDidUpdate(prevProps) {
        if (this.props.location !== prevProps.location) {
            this.onRouteChanged();
            // Phase 9 (docs/UI_MIGRATION_PLAN.md): react-router v6 removed
            // the `history` object `withRouter` used to inject (and with
            // it, `history.listen(...)`), so `_rebuildTooltips` - called
            // once directly in `componentDidMount` for the initial route,
            // exactly as before - is now called again here on every
            // subsequent route change, matching what the dropped
            // `history.listen(this._rebuildTooltips)` subscription used
            // to do (it never fired on the initial mount either, only on
            // later navigations).
            this._rebuildTooltips();
        }
    }

    onRouteChanged() {
        document.title = titleUtils.GetTitleByPath(
            this.props.location.pathname
        );
    }

    _onIgnoreIncognitoWarning() {
        this.setState({incognitoWarningDismissed: true});
    }

    _rebuildTooltips() {
        if (this.rebuildTimeout) return;
        ReactTooltip.hide();

        this.rebuildTimeout = setTimeout(() => {
            if (this.tooltipRef.current) {
                this.tooltipRef.current.globalRebuild();
            }
            this.rebuildTimeout = null;
        }, 1500);
    }

    _chainStoreSub() {
        let synced = this._syncStatus();
        if (synced !== this.state.synced) {
            this.setState({synced});
        }
        if (
            ChainStore.subscribed !== this.state.synced ||
            ChainStore.subError
        ) {
            let syncFail =
                ChainStore.subError &&
                ChainStore.subError.message ===
                    "ChainStore sync error, please check your system clock"
                    ? true
                    : false;
            this.setState({
                syncFail
            });
        }
    }

    /** Usage: NotificationActions.[success,error,warning,info] */
    _onNotificationChange() {
        const notification = NotificationStore.getState().notification;
        if (!notification) return;
        // the same toasts (and the same history) as the rest of the app; the
        // legacy ones allowed HTML in the message: it is shown as text
        const text = value =>
            typeof value === "string" ? htmlToText(value) : value;
        const level = ["success", "error", "warning", "info"].includes(
            notification.level
        )
            ? notification.level
            : "info";
        const hasTitle = !!notification.title;
        Notification[level]({
            message: hasTitle
                ? text(notification.title)
                : text(notification.message),
            description: hasTitle ? text(notification.message) : undefined,
            duration:
                notification.autoDismiss === void 0
                    ? 10
                    : notification.autoDismiss
        });
    }

    // Once per frame at most, and only when the height really changed: this
    // re-rendered the whole app on every resize event (flicker while resizing).
    _getWindowHeight() {
        if (this._heightFrame) return;
        this._heightFrame = window.requestAnimationFrame(() => {
            this._heightFrame = null;
            const height = window && window.innerHeight;
            if (height !== this.state.height) this.setState({height});
        });
    }

    // /** Non-static, used by passing notificationSystem via react Component refs */
    // _addNotification(params) {
    //     console.log("add notification:", this.refs, params);
    //     this.refs.notificationSystem.addNotification(params);
    // }

    render() {
        let {incognito, incognitoWarningDismissed} = this.state;
        let {walletMode, theme} = this.props;
        let content = null;

        if (this.state.syncFail) {
            content = <SyncError />;
        } else if (this.state.loading) {
            content = (
                <div className="grid-frame vertical">
                    <LoadingIndicator
                        loadingText={"Connecting to APIs and starting app"}
                    />
                </div>
            );
        } else if (__DEPRECATED__) {
            content = <Deprecate {...this.props} />;
        } else {
            let accountName =
                AccountStore.getState().currentAccount ||
                AccountStore.getState().passwordAccount;
            accountName =
                accountName && accountName !== "null"
                    ? accountName
                    : "committee-account";
            content = (
                <div className="grid-frame vertical">
                    <NewsHeadline />
                    <AppShell
                        content={
                            <>
                                <Routes
                                    location={
                                        this.props.backgroundLocation ||
                                        undefined
                                    }
                                >
                                    {desktopModalRoutes}
                                    <Route
                                        path="/"
                                        element={<DashboardPage />}
                                    />
                                    <Route
                                        path="/account/:account_name/*"
                                        element={<AccountPage />}
                                    />
                                    <Route
                                        path="/accounts"
                                        element={<DashboardAccountsOnly />}
                                    />
                                    <Route
                                        path="/market/:marketID"
                                        element={<Exchange />}
                                    />
                                    <Route
                                        path="/credit-offer"
                                        element={<CreditOfferPage />}
                                    />
                                    <Route
                                        path="/send"
                                        element={<SendPage />}
                                    />
                                    <Route
                                        path="/timed-transfer"
                                        element={<TimedTransferPage />}
                                    />
                                    <Route
                                        path="/samet-funds"
                                        element={<SametFundsPage />}
                                    />
                                    <Route
                                        path="/advanced"
                                        element={<AdvancedPage />}
                                    />
                                    <Route
                                        path="/settings/:tab"
                                        element={<Settings />}
                                    />
                                    <Route
                                        path="/settings"
                                        element={<Settings />}
                                    />
                                    <Route
                                        path="/invoice/:data"
                                        element={<Invoice />}
                                    />
                                    <Route
                                        path="/deposit-withdraw"
                                        element={
                                            <Navigate to="/deposit" replace />
                                        }
                                    />
                                    <Route
                                        path="/create-account/*"
                                        element={<LoginSelector />}
                                    />
                                    <Route
                                        path="/login"
                                        element={<LoginRoute />}
                                    />
                                    <Route
                                        path="/registration"
                                        element={<RegistrationSelectorRoute />}
                                    />
                                    <Route
                                        path="/registration/local"
                                        element={<WalletRegistrationRoute />}
                                    />
                                    <Route
                                        path="/registration/cloud"
                                        element={<AccountRegistrationRoute />}
                                    />
                                    <Route path="/news" element={<News />} />
                                    <Route
                                        path="/portfolio"
                                        element={
                                            <Navigate
                                                to={`/account/${accountName}/overview`}
                                                replace
                                            />
                                        }
                                    />
                                    <Route
                                        path="/voting"
                                        element={
                                            <Navigate
                                                to={`/account/${accountName}/voting`}
                                                replace
                                            />
                                        }
                                    />
                                    {/* Explorer routes */}
                                    <Route
                                        path="/explorer/pools"
                                        element={
                                            <Navigate to="/pools" replace />
                                        }
                                    />
                                    <Route
                                        path="/explorer/:tab"
                                        element={<Explorer />}
                                    />
                                    <Route
                                        path="/explorer"
                                        element={<Explorer />}
                                    />
                                    <Route
                                        path="/asset/:symbol"
                                        element={<Asset />}
                                    />
                                    <Route
                                        path="/block/:height"
                                        element={<Block />}
                                    />
                                    <Route
                                        path="/block/:height/:txIndex"
                                        element={<Block />}
                                    />

                                    <Route
                                        path="/barter"
                                        element={<Barter />}
                                    />

                                    <Route
                                        path="/spotlight"
                                        element={<ShowcaseGrid />}
                                    />

                                    {/* Wallet backup/restore routes */}
                                    <Route
                                        path="/wallet/*"
                                        element={<WalletManager />}
                                    />
                                    <Route
                                        path="/create-wallet-brainkey"
                                        element={<CreateWalletFromBrainkey />}
                                    />
                                    <Route
                                        path="/existing-account/*"
                                        element={<ExistingAccount />}
                                    />

                                    <Route
                                        path="/create-worker"
                                        element={<CreateWorker />}
                                    />

                                    {/* Help routes */}
                                    <Route path="/help" element={<Help />} />
                                    <Route
                                        path="/help/:path1"
                                        element={<Help />}
                                    />
                                    <Route
                                        path="/help/:path1/:path2"
                                        element={<Help />}
                                    />
                                    <Route
                                        path="/help/:path1/:path2/:path3"
                                        element={<Help />}
                                    />
                                    <Route
                                        path="/prediction"
                                        element={<PredictionMarketsPage />}
                                    />
                                    <Route
                                        path="/pools"
                                        element={<PoolmartPage />}
                                    />
                                    <Route path="*" element={<Page404 />} />
                                </Routes>
                                {this.props.backgroundLocation ? (
                                    <DesktopModalContext.Provider value={true}>
                                        <Routes>{desktopModalRoutes}</Routes>
                                    </DesktopModalContext.Provider>
                                ) : null}
                            </>
                        }
                    />
                    <ReactTooltip
                        ref={this.tooltipRef}
                        place="top"
                        type={theme === "lightTheme" ? "dark" : "light"}
                        effect="solid"
                    />
                </div>
            );
        }

        return (
            <div
                style={{backgroundColor: !theme ? "#2a2a2a" : null}}
                className={theme}
            >
                <BodyClassName className={theme}>
                    {walletMode && incognito && !incognitoWarningDismissed ? (
                        <Incognito
                            onClickIgnore={this._onIgnoreIncognitoWarning.bind(
                                this
                            )}
                        />
                    ) : null}
                    <div id="content-wrapper">
                        {content}
                        <TransactionConfirm />
                        <BrowserNotifications />
                        <PriceAlertNotifications />
                        <WalletUnlockModal />
                        <BrowserSupportModal
                            visible={this.state.isBrowserSupportModalVisible}
                            hideModal={this.hideBrowserSupportModal}
                            showModal={this.showBrowserSupportModal}
                        />
                        <GatewaySelectorModal
                            visible={this.state.isGatewaySelectorModalVisible}
                            hideModal={this.hideGatewaySelectorModal}
                        />
                    </div>
                </BodyClassName>
            </div>
        );
    }
}

// react-router v6 no longer injects `location` as a prop (`withRouter`
// is gone entirely) - this wrapper reads it via the hook and forwards
// it as a prop, since `App`'s `componentDidUpdate` compares
// `this.props.location !== prevProps.location` and `onRouteChanged`
// reads `this.props.location.pathname` - both need the real-pathname
// semantics `useLocation()` provides, not just a reactive dependency.
function AppWithLocation(props) {
    const location = useLocation();
    // On a desktop a small page is a dialog over the page that was open, so that page
    // stays on screen as the routes' background (the dashboard, when the address was
    // opened directly); on a phone it is a page like any other.
    const desktop = useMediaQuery(DESKTOP_QUERY);
    const lastPage = React.useRef(null);
    const asDialog = desktop && isDesktopModalPath(location.pathname);
    if (!isDesktopModalPath(location.pathname)) lastPage.current = location;
    const backgroundLocation = asDialog
        ? lastPage.current || {
              pathname: "/",
              search: "",
              hash: "",
              state: null,
              key: "dialog-background"
          }
        : null;
    return (
        <App
            {...props}
            location={location}
            backgroundLocation={backgroundLocation}
        />
    );
}

export default AppWithLocation;
