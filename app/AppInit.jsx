// Phase 9 (docs/UI_MIGRATION_PLAN.md): the real `alt`/`alt-react`
// packages are being removed now that every Alt store has a Redux-
// backed facade (`getState()`/`listen()`/`unlisten()`). This file used
// to be wrapped with alt-react's `connect(AppInit, {listenTo, getProps})`
// (subscribing to `[IntlStore, WalletManagerStore, SettingsStore]` and
// injecting `locale`/`walletMode`/`theme`/`apiServer` as props) plus
// `supplyFluxContext(alt)(AppInit)` (providing Alt's React context) -
// grep-confirmed nothing downstream ever read `this.context.flux`/
// `props.flux`, so `supplyFluxContext` was dropped outright. `connect`'s
// subscribe/derive-props behavior is reproduced directly in this class
// (componentDidMount/componentWillUnmount `listen`/`unlisten` the same
// 3 stores, `forceUpdate` on change; `render()` computes the same 4
// derived values inline instead of receiving them as injected props) -
// `<AppInit />` is rendered with no explicit props (see `index.js`), so
// there is no caller-prop-precedence case to preserve.
//
// Also drops `react-hot-loader`'s `hot(module)(...)` wrapper (Phase 9
// dependency cleanup) - that package patches React's reconciler purely
// to preserve component state across dev-mode hot reloads; it's a no-op
// in production (`hot()` only activates when `process.env.NODE_ENV !==
// "production"`) and was never load-bearing for correctness. Removing
// it means a dev-mode edit now triggers webpack's plain
// `HotModuleReplacementPlugin` module-replacement + full remount
// instead of a state-preserving swap - an accepted dev-experience
// tradeoff, not a behavior change for any shipped build.
import React from "react";
import {Provider} from "react-redux";
import {reduxStore} from "./store/reduxStore";
import App from "./App";
import IntlActions from "actions/IntlActions";
import WalletManagerStore from "stores/WalletManagerStore";
import SettingsStore from "stores/SettingsStore";
import IntlStore from "stores/IntlStore";
import intlData from "./components/Utility/intlData";
import {IntlProvider} from "react-intl";
import willTransitionTo from "./routerTransition";
import {BodyClassName} from "./design-system/BodyClassName";
import LoadingScreen from "./components/LoadingScreen";
import InitError from "./components/InitError";
import SyncError from "./components/SyncError";
import LogsActions from "actions/LogsActions";
import ExternalSignerActions from "actions/ExternalSignerActions";
import {startExternalAccountSync} from "stores/ExternalAccountSync";
import NodeSelector from "./components/Utility/NodeSelector";
import {selectAccountState} from "./store/slices/accountSlice";
import {READY_MAX_MS, accountsReady, coverVisible} from "./lib/common/startup";
/*
 * Electron does not support browserHistory, so we need to use hashHistory.
 * The same is true for servers without configuration options, such as Github Pages
 */
import {HashRouter, BrowserRouter} from "react-router-dom";

const Router = __HASH_HISTORY__ ? HashRouter : BrowserRouter;

// DEPRECATED / WARNING: this is deactivated because there is a race condition for some components when log is saved,
//                       since it calls setState. If the subcomponent does not have a tailored rerendering logic, this may a WSOD
const allowPersistentLog = false;

class RootIntl extends React.Component {
    UNSAFE_componentWillMount() {
        IntlActions.switchLocale(this.props.locale);
    }

    render() {
        return (
            <IntlProvider
                locale={this.props.locale}
                formats={intlData.formats}
                initialNow={Date.now()}
            >
                <Router>
                    <App {...this.props} />
                </Router>
            </IntlProvider>
        );
    }
}

class AppInit extends React.Component {
    constructor() {
        super();

        this.state = {
            apiConnected: false,
            apiError: false,
            syncError: null,
            status: "",
            extendeLogText: [], // used to cache logs when not mounted
            nodeFilterHasChanged: false,
            showNodeFilter: false,
            // the account lists have been read: the app can show something
            appReady: false
        };
        this.mounted = true;
        this.persistentLogEnabled = false;
    }

    /**
     * Global error catching and forwarding to log handler
     * @param error
     */
    componentDidCatch(error) {
        if (this.persistentLogEnabled) {
            this.saveExtendedLog("error", [error]);
        } else {
            console.error(error);
        }
    }

    componentDidUpdate(nextProps, nextState) {
        LogsActions.setLog(nextState.extendeLogText);
    }

    saveExtendedLog(type, logText) {
        const maxlogslength = 19;
        const logState = this.state.extendeLogText;
        var text = "";

        for (const value of logText) {
            text += value;
        }
        text = [type, ": ", text].join("");
        if (logState.length > maxlogslength) {
            logState.splice(0, 1);
        }
        if (text.indexOf(logState[logState.length - 1])) {
            logState.push(text);
            if (this.mounted) {
                this.setState({extendeLogText: logState});
            } else {
                LogsActions.setLog(logState);
            }
        }
    }

    _enablePersistingLog() {
        if (!allowPersistentLog) return;
        if (this.persistentLogEnabled) return;

        if (!this.state.extendeLogText.length) {
            LogsActions.getLogs().then(data => {
                if (data) {
                    this.setState({extendeLogText: data});
                }
            });
        }

        const thiz = this;
        const saveLog = (type, log) => {
            if (
                log.length > 1 &&
                typeof log[1] === "string" &&
                log[1] === "html2canvas:"
            ) {
                return;
            }
            thiz.saveExtendedLog(type, Array.from(log));
            if (thiz.mounted) {
                console[`str${type}`].apply(console, log);
            }
        };

        // see https://www.sitepoint.com/javascript-decorators-what-they-are/ for decorator

        // see https://stackoverflow.com/questions/9559725/extending-console-log-without-affecting-log-line for line numbers

        console.strlog = console.log.bind(console);
        console.strerror = console.error.bind(console);
        console.strwarn = console.warn.bind(console);
        console.strinfo = console.info.bind(console);
        console.strtimeEnd = console.timeEnd.bind(console);
        console.strdebug = console.debug.bind(console);

        console.log = function() {
            saveLog("log", arguments);
        };
        console.warn = function() {
            saveLog("warn", arguments);
        };
        console.error = function() {
            saveLog("error", arguments);
        };
        console.info = function() {
            saveLog("info", arguments);
        };
        console.timeEnd = function() {
            saveLog("timeEnd", arguments);
        };
        console.debug = function() {
            saveLog("debug", arguments);
        };

        this.persistentLogEnabled = true;
    }

    UNSAFE_componentWillMount() {
        if (!__DEV__) {
            this._enablePersistingLog();
        }
        setTimeout(() => {
            this.setState({
                showNodeFilter: true
            });
        }, 5000);
        willTransitionTo(true, this._statusCallback.bind(this))
            .then(() => {
                this.setState({
                    apiConnected: true,
                    apiError: false,
                    syncError: null
                });
                this._watchReady();
                // Optional extension-based signing (off unless the user chose it):
                // look for the extension now that the chain id is known.
                startExternalAccountSync();
                ExternalSignerActions.init();
            })
            .catch(err => {
                console.log("willTransitionTo err:", err);
                this.setState({
                    apiConnected: false,
                    apiError: true,
                    syncError: !err
                        ? null
                        : (err && err.message).indexOf(
                              "ChainStore sync error"
                          ) !== -1
                });
            });
    }

    componentDidMount() {
        this.mounted = true;
        //Detect OS for platform specific fixes
        if (navigator.platform.indexOf("Win") > -1) {
            var main = document.getElementById("content");
            var windowsClass = "windows";
            if (main.className.indexOf("windows") === -1) {
                main.className =
                    main.className +
                    (main.className.length ? " " : "") +
                    windowsClass;
            }
        }

        this._onStoreChange = () => this.forceUpdate();
        IntlStore.listen(this._onStoreChange);
        WalletManagerStore.listen(this._onStoreChange);
        SettingsStore.listen(this._onStoreChange);
    }

    // The start-up screen stays until the account state has been read (or
    // READY_MAX_MS), so the app does not appear with a second spinner of its
    // own. See lib/common/startup.ts.
    _watchReady() {
        const done = () => {
            this._stopWatchingReady();
            if (this.mounted) this.setState({appReady: true});
        };
        const check = () => {
            if (accountsReady(selectAccountState(reduxStore.getState()))) {
                done();
            }
        };
        this._unsubscribeReady = reduxStore.subscribe(check);
        this._readyTimer = setTimeout(done, READY_MAX_MS);
        check();
    }

    _stopWatchingReady() {
        if (this._unsubscribeReady) this._unsubscribeReady();
        if (this._readyTimer) clearTimeout(this._readyTimer);
        this._unsubscribeReady = null;
        this._readyTimer = null;
    }

    componentWillUnmount() {
        this.mounted = false;
        this._stopWatchingReady();
        IntlStore.unlisten(this._onStoreChange);
        WalletManagerStore.unlisten(this._onStoreChange);
        SettingsStore.unlisten(this._onStoreChange);
    }

    _statusCallback(status) {
        this.setState({status});
    }

    _onNodeFilterChange() {
        this.setState({
            nodeFilterHasChanged: true
        });
    }

    _renderLoadingScreen(server, theme) {
        return (
            <LoadingScreen
                status={this.state.status}
                server={server || ""}
                theme={theme}
            >
                {this.state.showNodeFilter && (
                    <div className="padding">
                        <NodeSelector
                            onChange={this._onNodeFilterChange.bind(this)}
                        />
                        {this.state.nodeFilterHasChanged && (
                            <div style={{marginTop: "1rem"}}>
                                Please reload for the changes to take effect
                            </div>
                        )}
                    </div>
                )}
            </LoadingScreen>
        );
    }

    render() {
        const {apiConnected, apiError, syncError} = this.state;
        const locale = IntlStore.getState().currentLocale;
        const walletMode =
            !SettingsStore.getState().settings.get("passwordLogin") ||
            !!WalletManagerStore.getState().current_wallet;
        const theme = SettingsStore.getState().settings.get("themes");
        const apiServer = SettingsStore.getState().settings.get(
            "activeNode",
            ""
        );

        // One stable tree: the app, the start-up screen and the error screens
        // are siblings in fixed places, so the start-up screen is the same
        // element before and after the connection opens (no remount, no second
        // spinner).
        const cover = coverVisible({
            apiConnected,
            apiError,
            appReady: this.state.appReady
        });
        return (
            <React.Fragment>
                {apiConnected ? (
                    <RootIntl
                        {...this.props}
                        {...this.state}
                        locale={locale}
                        walletMode={walletMode}
                        theme={theme}
                        apiServer={apiServer}
                    />
                ) : null}
                {cover || (!apiConnected && apiError) ? (
                    <div
                        style={{backgroundColor: !theme ? "#2a2a2a" : null}}
                        className={theme}
                    >
                        <div id="content-wrapper">
                            <div className="grid-frame vertical">
                                {/* once the app is mounted it sets the body's
                                    theme class itself; a second owner would
                                    take it off the body when this screen
                                    goes (the buttons turned upper case) */}
                                <BodyClassName
                                    className={apiConnected ? undefined : theme}
                                >
                                    {!apiError ? (
                                        this._renderLoadingScreen(
                                            apiServer,
                                            theme
                                        )
                                    ) : syncError ? (
                                        <SyncError />
                                    ) : (
                                        <InitError />
                                    )}
                                </BodyClassName>
                            </div>
                        </div>
                    </div>
                ) : null}
            </React.Fragment>
        );
    }
}

// Makes the Redux store available to any component using react-redux's
// `useSelector`/`useDispatch` - see this file's own header above for why
// the Alt.js flux context this used to run alongside is gone.
function AppInitWithReduxProvider(props) {
    return (
        <Provider store={reduxStore}>
            <AppInit {...props} />
        </Provider>
    );
}

export default AppInitWithReduxProvider;
