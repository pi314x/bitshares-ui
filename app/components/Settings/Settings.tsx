// TypeScript/functional-component port of the legacy Settings.jsx (Phase
// 2, docs/UI_MIGRATION_PLAN.md). Renders the Settings screen's tab menu
// and routes each tab to its (unchanged) subcomponent - AccountsSettings,
// WalletSettings, PasswordSettings, RestoreSettings, BackupSettings,
// AccessSettings, ResetSettings, SettingsEntry, WebsocketAddModal - none
// of which are touched here.
//
// No account balances or signing involved, so this doesn't carry the
// same risk category as the Dashboard/Blocks rewrites - it's mostly
// orchestration (which tab is active, syncing that with the URL) around
// already-working subcomponents.
//
// Two confirmed-dead things dropped during the port (verified by reading
// every consuming file, not just grepping the declaring one):
// - `onReset()` was defined but never called, bound, or referenced.
// - The `apiLatencies` prop (from SettingsContainer) and the `locales`
//   prop plus the `{...this.state}` spread (both passed to SettingsEntry)
//   were never read by anything downstream - AccessSettings.jsx fetches
//   its own `apiLatencies` independently, and SettingsEntry.jsx only
//   destructures `defaults`/`setting`/`settings` from its props.
import * as React from "react";
import {useParams, useHistory} from "react-router-dom";
import counterpart from "counterpart";
import IntlActions from "actions/IntlActions";
import Translate from "react-translate-component";
import SettingsActions from "actions/SettingsActions";
import WebsocketAddModal from "./WebsocketAddModal";
import SettingsEntry from "./SettingsEntry";
import AccountsSettings from "./AccountsSettings";
import WalletSettings from "./WalletSettings";
import PasswordSettings from "./PasswordSettings";
import RestoreSettings from "./RestoreSettings";
import ResetSettings from "./ResetSettings";
import BackupSettings from "./BackupSettings";
import AccessSettings from "./AccessSettings";
import {set} from "lodash-es";
import {getAllowedLogins, getFaucet} from "../../branding";
import {Input, Form} from "bitshares-ui-style-guide";
import "./Settings.scss";

function getMenuEntries(deprecated: boolean, passwordLogin: boolean): string[] {
    if (deprecated) {
        return ["wallet", "backup"];
    }
    const menuEntries: string[] = ["general"];
    if (!passwordLogin) menuEntries.push("wallet");
    menuEntries.push("accounts");
    if (!passwordLogin) menuEntries.push("password");
    if (!passwordLogin) menuEntries.push("backup");
    if (!passwordLogin) menuEntries.push("restore");
    menuEntries.push("access");
    if (getFaucet().show) menuEntries.push("faucet_address");
    menuEntries.push("reset");
    return menuEntries;
}

function getSettingEntries() {
    const general = [
        "locale",
        "unit",
        "fee_asset",
        "filteredServiceProviders",
        "browser_notifications",
        "showSettles",
        "walletLockTimeout",
        "themes",
        "showAssetPercent",
        "viewOnlyMode",
        "showProposedTx"
    ];
    // disable that the user can change login method if only one is allowed
    if (getAllowedLogins().length > 1) general.push("passwordLogin");
    general.push("reset");
    return {general, access: ["apiServer", "faucet_address"]};
}

function findEntry(targetValue: any, targetDefaults: any): any {
    if (!targetDefaults) return targetValue;
    if (targetDefaults[0].translate) {
        for (let i = 0; i < targetDefaults.length; i++) {
            if (
                counterpart.translate(
                    `settings.${targetDefaults[i].translate}`
                ) === targetValue
            ) {
                return i;
            }
        }
    } else {
        return targetDefaults.indexOf(targetValue);
    }
}

export interface SettingsProps {
    deprecated?: boolean;
    settings: any;
    viewSettings: any;
    defaults: any;
}

export default function Settings(props: SettingsProps) {
    const {deprecated = false, settings, viewSettings, defaults} = props;
    const {tab} = useParams<{tab?: string}>();
    const history = useHistory();

    const passwordLogin = settings.get("passwordLogin");

    function computeInitialMenuEntries() {
        return getMenuEntries(deprecated, passwordLogin);
    }

    const [menuEntries, setMenuEntries] = React.useState<string[]>(
        computeInitialMenuEntries
    );
    const [activeSetting, setActiveSetting] = React.useState<number>(() => {
        const initial = computeInitialMenuEntries();
        const tabIndex = tab
            ? initial.indexOf(tab)
            : viewSettings.get("activeSetting", 0);
        return tabIndex >= 0 ? tabIndex : 0;
    });
    const [apiServer, setApiServer] = React.useState<string>(() =>
        settings.get("apiServer")
    );
    const [isAddNodeModalVisible, setAddNodeModalVisible] = React.useState(
        false
    );
    const [
        isRemoveNodeModalVisible,
        setRemoveNodeModalVisible
    ] = React.useState(false);
    const [removeNode, setRemoveNode] = React.useState<{
        name: string | null;
        url: string | null;
    }>({name: null, url: null});

    const settingEntries = React.useMemo(getSettingEntries, []);

    function showAddNodeModal() {
        setAddNodeModalVisible(true);
    }

    function hideAddNodeModal() {
        setAddNodeModalVisible(false);
    }

    function showRemoveNodeModal(url: string, name: string) {
        setRemoveNodeModalVisible(true);
        setRemoveNode({url, name});
    }

    function hideRemoveNodeModal() {
        setRemoveNodeModalVisible(false);
        setRemoveNode({url: null, name: null});
    }

    function onChangeMenu(entry: string) {
        const index = menuEntries.indexOf(entry);
        setActiveSetting(index);
        SettingsActions.changeViewSetting({activeSetting: index});
    }

    // Sync menu entries/active tab when passwordLogin changes (legacy
    // UNSAFE_componentWillReceiveProps): the set of visible tabs shifts, so
    // the currently-active tab's *index* may no longer point at it.
    const prevPasswordLoginRef = React.useRef(passwordLogin);
    React.useEffect(() => {
        if (prevPasswordLoginRef.current === passwordLogin) return;
        const oldPasswordLogin = prevPasswordLoginRef.current;
        prevPasswordLoginRef.current = passwordLogin;

        const currentEntries = getMenuEntries(deprecated, oldPasswordLogin);
        const newEntries = getMenuEntries(deprecated, passwordLogin);
        setMenuEntries(newEntries);
        setActiveSetting(prevActive => {
            const currentActiveName = currentEntries[prevActive];
            const newActiveIndex = newEntries.indexOf(currentActiveName);
            const newActive = newEntries[newActiveIndex];
            if (newActiveIndex && newActiveIndex !== prevActive) {
                return newActiveIndex;
            } else if (!newActive || prevActive > newEntries.length - 1) {
                return 0;
            }
            return prevActive;
        });
    }, [passwordLogin, deprecated]);

    // Sync active tab when the URL's :tab param changes after mount
    // (legacy componentDidUpdate) - e.g. browser back/forward navigation.
    // The initial tab (if any) is already handled by activeSetting's own
    // lazy initializer above, so this effect skips its first run.
    const isFirstRender = React.useRef(true);
    React.useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        if (tab) {
            onChangeMenu(tab);
        }
    }, [tab]);

    function handleNotificationChange(path: string, value: any) {
        // use different change handler because checkbox doesn't work
        // normal with e.preventDefault()
        const updatedValue = set(
            settings.get("browser_notifications"),
            path,
            value
        );
        SettingsActions.changeSetting({
            setting: "browser_notifications",
            value: updatedValue
        });
    }

    function handleSettingsEntryChange(setting: string, input: any) {
        if (!input.target) {
            onChangeSetting(setting, {target: {value: input}});
        } else {
            onChangeSetting(setting, input);
        }
    }

    function onChangeSetting(setting: string, e: any) {
        if (e.preventDefault) e.preventDefault();

        let value: any = null;

        switch (setting) {
            case "locale": {
                const myLocale = counterpart.getLocale();
                if (e.target.value !== myLocale) {
                    IntlActions.switchLocale(e.target.value);
                    SettingsActions.changeSetting({
                        setting: "locale",
                        value: e.target.value
                    });
                }
                break;
            }

            case "themes":
                SettingsActions.changeSetting({
                    setting: "themes",
                    value: e.target.value
                });
                break;

            case "defaultMarkets":
                break;

            case "walletLockTimeout": {
                let newValue = parseInt(e.target.value, 10);
                if (isNaN(newValue)) newValue = 0;
                if (!isNaN(newValue) && typeof newValue === "number") {
                    SettingsActions.changeSetting({
                        setting: "walletLockTimeout",
                        value: newValue
                    });
                }
                break;
            }

            case "inverseMarket":
            case "confirmMarketOrder":
                value = findEntry(e.target.value, defaults[setting]) === 0; // USD/BTS is true, BTS/USD is false
                break;

            case "apiServer":
                SettingsActions.changeSetting({
                    setting: "apiServer",
                    value: e.target.value
                });
                setApiServer(e.target.value);
                break;

            case "showProposedTx":
            case "showSettles":
            case "showAssetPercent":
            case "passwordLogin":
            case "viewOnlyMode": {
                let reference = defaults[setting][0];
                if (reference.translate) reference = reference.translate;
                SettingsActions.changeSetting({
                    setting,
                    value: e.target.value === reference
                });
                break;
            }

            case "filteredServiceProviders":
                break;
            case "fee_asset":
            case "unit": {
                const defaultSettings = defaults["unit"];
                const index = findEntry(e.target.value, defaultSettings);
                SettingsActions.changeSetting({
                    setting: setting,
                    value: defaultSettings[index]
                });
                break;
            }

            default:
                value = findEntry(e.target.value, defaults[setting]);
                break;
        }

        if (value !== null) {
            SettingsActions.changeSetting({setting: setting, value: value});
        }
    }

    function redirectToEntry(entry: string) {
        history.push("/settings/" + entry);
    }

    let entries: React.ReactNode;
    const activeEntry = menuEntries[activeSetting] || menuEntries[0];

    switch (activeEntry) {
        case "accounts":
            entries = <AccountsSettings />;
            break;

        case "wallet":
            entries = <WalletSettings deprecated={deprecated} />;
            break;

        case "password":
            entries = <PasswordSettings />;
            break;

        case "backup":
            entries = <BackupSettings />;
            break;

        case "restore":
            entries = (
                <RestoreSettings passwordLogin={settings.get("passwordLogin")} />
            );
            break;

        case "access":
            entries = (
                <AccessSettings
                    faucet={settings.get("faucet_address")}
                    nodes={defaults.apiServer}
                    onChange={onChangeSetting}
                    showAddNodeModal={showAddNodeModal}
                    showRemoveNodeModal={showRemoveNodeModal}
                />
            );
            break;
        case "faucet_address":
            entries = (
                <Input
                    disabled={!getFaucet().editable}
                    type="text"
                    defaultValue={settings.get("faucet_address")}
                    onChange={
                        getFaucet().editable
                            ? (e: any) => onChangeSetting("faucet_address", e)
                            : null
                    }
                />
            );
            break;

        case "reset":
            entries = <ResetSettings />;
            break;

        default:
            entries = (settingEntries as any)[activeEntry].map(
                (setting: string) => {
                    return (
                        <SettingsEntry
                            key={setting}
                            setting={setting}
                            settings={settings}
                            defaults={
                                defaults[
                                    setting === "fee_asset" ? "unit" : setting
                                ]
                            }
                            onChange={handleSettingsEntryChange}
                            onNotificationChange={handleNotificationChange}
                        />
                    );
                }
            );
            break;
    }

    return (
        <Form layout={"vertical"}>
            <div
                className={deprecated ? "" : "grid-block settings-container"}
            >
                <div className="grid-block main-content margin-block wrap">
                    <div
                        className="grid-content shrink settings-menu"
                        style={{paddingRight: "2rem"}}
                    >
                        <Translate
                            style={{paddingBottom: 10, paddingLeft: 10}}
                            component="h3"
                            content="header.settings"
                            className={"panel-bg-color"}
                        />

                        <ul className="set-nav">
                            {menuEntries.map((entry, index) => {
                                return (
                                    <li
                                        className={
                                            "set-nav-item" +
                                            (index === activeSetting
                                                ? " active set-nav-item-active"
                                                : "")
                                        }
                                        onClick={() => redirectToEntry(entry)}
                                        key={entry}
                                    >
                                        <Translate
                                            content={"settings." + entry}
                                        />
                                    </li>
                                );
                            })}
                        </ul>
                    </div>

                    <div
                        className="grid-content set-content"
                        style={{
                            height: "100%"
                        }}
                    >
                        <div
                            className="grid-block small-12 no-margin vertical"
                            style={{
                                maxWidth: 1000
                            }}
                        >
                            <Translate
                                component="h3"
                                content={"settings." + menuEntries[activeSetting]}
                            />
                            {activeEntry != "access" && (
                                <Translate
                                    unsafe
                                    style={{
                                        paddingTop: 5,
                                        marginBottom: 30
                                    }}
                                    content={`settings.${menuEntries[activeSetting]}_text`}
                                    className="panel-bg-color"
                                />
                            )}
                            {entries}
                        </div>
                    </div>
                </div>
                <WebsocketAddModal
                    removeNode={removeNode}
                    isAddNodeModalVisible={isAddNodeModalVisible}
                    isRemoveNodeModalVisible={isRemoveNodeModalVisible}
                    onAddNodeClose={hideAddNodeModal}
                    onRemoveNodeClose={hideRemoveNodeModal}
                    apis={defaults["apiServer"]}
                    api={defaults["apiServer"]
                        .filter((a: any) => {
                            return a.url === apiServer;
                        })
                        .reduce((a: any, b: any) => {
                            return b && b.url;
                        }, null)}
                    changeConnection={(nextApiServer: string) => {
                        setApiServer(nextApiServer);
                    }}
                />
            </div>
        </Form>
    );
}
