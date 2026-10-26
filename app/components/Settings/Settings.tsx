// TypeScript/functional-component port of the legacy Settings.jsx (Phase
// 2, docs/UI_MIGRATION_PLAN.md). Renders the Settings screen's tab menu
// and routes each tab to its subcomponent - AccountsSettings,
// WalletSettings, PasswordSettings, RestoreSettings, BackupSettings,
// AccessSettings, ResetSettings, SettingsEntry, WebsocketAddModal. Most of
// these have since also been ported to TSX in their own later slices (see
// docs/UI_MIGRATION_PLAN.md) - this file's own job stays the same either
// way: orchestration (which tab is active, syncing that with the URL)
// around them, not their internals.
//
// No account balances or signing involved, so this doesn't carry the
// same risk category as the Dashboard/Blocks rewrites.
//
// Two confirmed-dead things dropped during the original port of this file
// (verified by reading every consuming file, not just grepping the
// declaring one):
// - `onReset()` was defined but never called, bound, or referenced.
// - The `apiLatencies` prop (from SettingsContainer) and the `locales`
//   prop plus the `{...this.state}` spread (both passed to SettingsEntry)
//   were never read by anything downstream - AccessSettings fetches its
//   own `apiLatencies` independently, and SettingsEntry only destructures
//   `defaults`/`setting`/`settings` from its props.
// A third, found later while porting AccessSettings itself: the `faucet`
// and `onChange` props this file passed to `<AccessSettings>` were never
// read there either - dropped from this call site once AccessSettings.tsx
// stopped declaring them.
import * as React from "react";
import {useParams, useNavigate} from "react-router-dom";
import counterpart from "counterpart";
import IntlActions from "actions/IntlActions";
import Translate from "react-translate-component";
import SettingsActions from "actions/SettingsActions";
import WebsocketAddModal from "./WebsocketAddModal";
import SettingsEntry from "./SettingsEntry";
import AccountsSettings from "./AccountsSettings";
import LocalDataCard from "./LocalDataCard";
import ExternalSignerSettings from "./ExternalSignerSettings";
import WalletSettings from "./WalletSettings";
import PasswordSettings from "./PasswordSettings";
import RestoreSettings from "./RestoreSettings";
import ResetSettings from "./ResetSettings";
import BackupSettings from "./BackupSettings";
import AccessSettings from "./AccessSettings";
import {set} from "lodash-es";
import {getAllowedLogins, getFaucet, isTestnet} from "../../branding";
import {registrationFaucet} from "../../lib/common/faucet";
import SettingsStore from "../../stores/SettingsStore";
import {Input} from "../../design-system/Input";
import {Form} from "../../design-system/Form";
import {SubMenu} from "../../design-system/SubMenu";
import {PageHead} from "../../design-system/PageHead";
import styles from "./Settings.module.scss";

function getMenuEntries(deprecated: boolean, passwordLogin: boolean): string[] {
    if (deprecated) {
        return ["wallet", "backup"];
    }
    const menuEntries: string[] = ["general"];
    if (!passwordLogin) menuEntries.push("wallet");
    menuEntries.push("accounts");
    menuEntries.push("signing");
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
    const navigate = useNavigate();

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
        navigate("/settings/" + entry);
    }

    let entries: React.ReactNode;
    const activeEntry = menuEntries[activeSetting] || menuEntries[0];

    switch (activeEntry) {
        case "accounts":
            entries = (
                <>
                    <LocalDataCard />
                    <AccountsSettings />
                </>
            );
            break;

        case "wallet":
            entries = <WalletSettings deprecated={deprecated} />;
            break;

        case "signing":
            entries = <ExternalSignerSettings />;
            break;

        case "password":
            entries = <PasswordSettings />;
            break;

        case "backup":
            entries = <BackupSettings />;
            break;

        case "restore":
            entries = (
                <RestoreSettings
                    passwordLogin={settings.get("passwordLogin")}
                />
            );
            break;

        case "access":
            entries = (
                <AccessSettings
                    nodes={defaults.apiServer}
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
                    // the faucet that registers accounts on the chain this app is on
                    // (a test chain has its own; the setting is the main chain's)
                    defaultValue={registrationFaucet(isTestnet(), {
                        faucet_address: settings.get("faucet_address"),
                        testnet_faucet: (SettingsStore as any).getState()
                            .testnet_faucet
                    })}
                    onChange={
                        getFaucet().editable
                            ? (e: any) => onChangeSetting("faucet_address", e)
                            : undefined
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

    // The menu is the page menu of the app (the rounded row the portfolio has),
    // above the section it chooses; the section is one column under it. (It was
    // a list down the left side that took a quarter of the screen.)
    return (
        <Form layout={"vertical"}>
            <div className={deprecated ? "" : "settings-container"}>
                <div className={styles.page}>
                    <SubMenu
                        aria-label={counterpart.translate("header.settings")}
                        items={menuEntries.map(entry => ({
                            key: entry,
                            label: counterpart.translate("settings." + entry)
                        }))}
                        value={menuEntries[activeSetting] || menuEntries[0]}
                        onChange={entry => redirectToEntry(entry)}
                    />

                    <div className={styles.content}>
                        <PageHead
                            title={counterpart.translate(
                                "settings." + menuEntries[activeSetting]
                            )}
                            lead={
                                // the Signing page says it in its own words (a longer
                                // text under the title would repeat it), Access has none
                                activeEntry != "access" &&
                                activeEntry != "signing" ? (
                                    <Translate
                                        unsafe
                                        component="span"
                                        content={`settings.${menuEntries[activeSetting]}_text`}
                                    />
                                ) : null
                            }
                        />
                        {entries}
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
