// Redux-backed replacement for the Alt.js SettingsStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 batch 9 - see
// `../store/reduxStore.ts`'s header for the overall migration approach).
//
// Part of a genuinely circular cluster that could not be split into
// smaller batches - see `./IntlStore.ts`'s header for the full
// explanation of why `IntlStore`, `SettingsStore`, `WalletUnlockStore`,
// `AccountStore`, and `WalletManagerStore` all had to migrate together.
//
// Preserves the exact interface every call site relies on - `getState()`,
// `listen()`, `unlisten()`, and every method the original
// `exportPublicMethods()`ed (`init`, `getSetting`, `getLastBudgetObject`,
// `setLastBudgetObject`, `hasAnyPriceAlert`) - plus every `onXxx` handler,
// now plain public methods (rather than bindListeners-private) so
// `../actions/SettingsActions.ts`/`../actions/IntlActions.ts` can call
// them directly, including the two cross-bound ones
// (`onSwitchLocale`/`onClearSettings`).
//
// Not security-sensitive itself per AGENTS.md (no key material - app
// preferences, node lists, starred markets, etc.) but every value here
// flows into `WalletUnlockStore`'s `walletLockTimeout`/`passwordLogin`
// and `AccountStore`'s `passwordLogin` via the shared `changeSetting`
// action, so ported with the same care as the rest of this cluster.
import {reduxStore} from "../store/reduxStore";
import Immutable, {fromJS} from "immutable";
import ls from "common/localStorage";
import {Apis} from "bitsharesjs-ws";
import {settingsAPIs} from "api/apiConfig";
import {
    getDefaultTheme,
    getDefaultLogin,
    getMyMarketsBases,
    getMyMarketsQuotes,
    getUnits
} from "branding";
import {
    patchState,
    seedSettingsState,
    addWS as addWSAction,
    removeWS as removeWSAction,
    hideWS as hideWSAction,
    showWS as showWSAction,
    selectSettingsState,
    buildInitialSettingsState,
    SettingsState
} from "../store/slices/settingsSlice";

const CORE_ASSET = "BTS"; // Setting this to BTS to prevent loading issues when used with BTS chain which is the most usual case currently

const STORAGE_KEY = "__graphene__";
const ss = (ls as any)(STORAGE_KEY);

/**
 * SettingsStore takes care of maintaining user set settings values and notifies all listeners
 */
class SettingsStoreFacade {
    private unsubscribers = new Map<() => void, () => void>();

    constructor() {
        const settings = Immutable.Map(this._getSetting());
        const defaultSettings = Immutable.Map(this._getDefaultSetting());
        const defaults = this._getChoices();
        const viewSettings = Immutable.Map(ss.get("viewSettings_v1"));
        const marketDirections = Immutable.Map(ss.get("marketDirections"));
        const hiddenAssets = Immutable.List(ss.get("hiddenAssets", []));
        const hiddenMarkets = Immutable.List(ss.get("hiddenMarkets", []));
        const apiLatencies = ss.get("apiLatencies", {});
        const mainnet_faucet = ss.get(
            "mainnet_faucet",
            settingsAPIs.DEFAULT_FAUCET
        );
        const testnet_faucet = ss.get(
            "testnet_faucet",
            settingsAPIs.TESTNET_FAUCET
        );
        const exchange = fromJS(ss.get("exchange", {}));
        const priceAlert = fromJS(ss.get("priceAlert", []));
        const hiddenNewsHeadline = Immutable.List(
            ss.get("hiddenNewsHeadline", [])
        );
        const chartLayouts = Immutable.List(ss.get("chartLayouts", []));

        reduxStore.dispatch(
            seedSettingsState(
                buildInitialSettingsState({
                    settings,
                    defaultSettings,
                    defaults,
                    viewSettings,
                    marketDirections,
                    hiddenAssets,
                    hiddenMarkets,
                    apiLatencies,
                    mainnet_faucet,
                    testnet_faucet,
                    exchange,
                    priceAlert,
                    hiddenNewsHeadline,
                    chartLayouts
                })
            )
        );
    }

    getState(): SettingsState {
        return selectSettingsState(reduxStore.getState());
    }

    listen(callback: () => void) {
        let previous = selectSettingsState(reduxStore.getState());
        const unsubscribe = reduxStore.subscribe(() => {
            const next = selectSettingsState(reduxStore.getState());
            if (next !== previous) {
                previous = next;
                callback();
            }
        });
        this.unsubscribers.set(callback, unsubscribe);
    }

    unlisten(callback: () => void) {
        const unsubscribe = this.unsubscribers.get(callback);
        if (unsubscribe) {
            unsubscribe();
            this.unsubscribers.delete(callback);
        }
    }

    /**
     * Returns the default selected values that the user can reset to
     */
    private _getDefaultSetting() {
        return {
            locale: "en",
            apiServer: settingsAPIs.DEFAULT_WS_NODE,
            filteredApiServers: [],
            filteredServiceProviders: ["all"],
            faucet_address: settingsAPIs.DEFAULT_FAUCET,
            unit: CORE_ASSET,
            fee_asset: CORE_ASSET,
            showSettles: false,
            showAssetPercent: false,
            walletLockTimeout: 60 * 10,
            themes: (getDefaultTheme as any)(),
            passwordLogin: (getDefaultLogin as any)() == "password",
            browser_notifications: {
                allow: true,
                additional: {
                    transferToMe: true
                }
            },
            rememberMe: true,
            viewOnlyMode: true,
            showProposedTx: false
        };
    }

    /**
     * All possible choices for the settings
     */
    private _getDefaultChoices(): any {
        return {
            locale: ["en", "zh", "fr", "ko", "de", "es", "it", "tr", "ru", "ja"],
            apiServer: (settingsAPIs as any).WS_NODE_LIST.slice(0), // clone all default servers as configured in apiConfig.js
            filteredApiServers: [[]],
            filteredServiceProviders: [[]],
            unit: (getUnits as any)(),
            fee_asset: (getUnits as any)(),
            showProposedTx: [{translate: "yes"}, {translate: "no"}],
            showSettles: [{translate: "yes"}, {translate: "no"}],
            showAssetPercent: [{translate: "yes"}, {translate: "no"}],
            themes: ["darkTheme", "lightTheme", "midnightTheme"],
            passwordLogin: [
                {translate: "cloud_login"},
                {translate: "local_wallet"}
            ],
            browser_notifications: {
                allow: [true, false],
                additional: {
                    transferToMe: [true, false]
                }
            },
            rememberMe: [true, false],
            viewOnlyMode: [{translate: "show"}, {translate: "hide"}]
        };
    }

    /**
     * Checks if an object is actually empty (no keys or only empty keys)
     */
    private _isEmpty(object: any) {
        let isEmpty = true;
        Object.keys(object).forEach(key => {
            if (object.hasOwnProperty(key) && object[key] !== null)
                isEmpty = false;
        });
        return isEmpty;
    }

    /**
     * Ensures that defauls are not stored in local storage, only changes, and when reading inserts all defaults.
     */
    private _replaceDefaults(
        mode: any = "saving",
        settings: any,
        defaultSettings: any = null
    ): any {
        if (defaultSettings == null) {
            // this method might be called recursively, so not always use the whole defaults
            defaultSettings = this._getDefaultSetting();
        }

        const excludedKeys = ["activeNode"];

        // avoid copy by reference
        const returnSettings: any = {};
        if (mode === "saving") {
            // remove every setting that is default
            Object.keys(settings).forEach(key => {
                if (excludedKeys.includes(key)) {
                    return;
                }
                // must be of same type to be compatible
                if (typeof settings[key] === typeof defaultSettings[key]) {
                    if (
                        !(settings[key] instanceof Array) &&
                        typeof settings[key] == "object"
                    ) {
                        const newSetting = this._replaceDefaults(
                            "saving",
                            settings[key],
                            defaultSettings[key]
                        );
                        if (!this._isEmpty(newSetting)) {
                            returnSettings[key] = newSetting;
                        }
                    } else if (settings[key] !== defaultSettings[key]) {
                        // only save if its not the default
                        if (settings[key] instanceof Array) {
                            if (
                                JSON.stringify(settings[key]) !==
                                JSON.stringify(defaultSettings[key])
                            ) {
                                returnSettings[key] = settings[key];
                            }
                        } else {
                            // only save if its not the default
                            returnSettings[key] = settings[key];
                        }
                    }
                }
                // all other cases are defaults, do not put the value in local storage
            });
        } else {
            Object.keys(defaultSettings).forEach(key => {
                let setDefaults = false;
                if (settings[key] !== undefined) {
                    // exists in saved settings, check value
                    if (typeof settings[key] !== typeof defaultSettings[key]) {
                        // incompatible types, use default
                        setDefaults = true;
                    } else if (
                        !(settings[key] instanceof Array) &&
                        typeof settings[key] == "object"
                    ) {
                        // check all subkeys
                        returnSettings[key] = this._replaceDefaults(
                            "loading",
                            settings[key],
                            defaultSettings[key]
                        );
                    } else {
                        returnSettings[key] = settings[key];
                    }
                } else {
                    setDefaults = true;
                }
                if (setDefaults) {
                    if (typeof settings[key] == "object") {
                        // use defaults, deep copy
                        returnSettings[key] = JSON.parse(
                            JSON.stringify(defaultSettings[key])
                        );
                    } else {
                        returnSettings[key] = defaultSettings[key];
                    }
                }
            });
            // copy all the rest as well
            Object.keys(settings).forEach(key => {
                if (returnSettings[key] == undefined) {
                    // deep copy
                    returnSettings[key] = JSON.parse(JSON.stringify(settings[key]));
                }
            });
        }
        return returnSettings;
    }

    /**
     * Returns the currently active settings, either default or from local storage
     */
    private _getSetting() {
        // migrate to new settings
        // - v3  defaults are stored as values which makes it impossible to react on changed defaults
        // - v4  refactored complete settings handling. defaults are no longer stored in local storage and
        //       set if not present on loading
        const support_v3_until = new Date("2018-10-20T00:00:00Z");

        if (!ss.has("settings_v4") && new Date() < support_v3_until) {
            // ensure backwards compatibility of settings version
            const settings_v3 = ss.get("settings_v3");
            if (!!settings_v3) {
                if (settings_v3["themes"] === "olDarkTheme") {
                    settings_v3["themes"] = "midnightTheme";
                }
            }
            this._saveSettingsRaw(settings_v3, this._getDefaultSetting());
        }

        return this._loadSettings();
    }

    /**
     * Overwrite configuration while utilizing call-by-reference
     */
    private _injectApiConfiguration(apiTarget: any, apiSource: any) {
        // any defaults in the apiConfig are to be maintained!
        apiTarget.hidden = apiSource.hidden;
    }

    /**
     * Save settings to local storage after checking for defaults, reading
     * from the current Redux state (used by every handler after the
     * constructor has run).
     */
    private _saveSettings() {
        const settings = this.getState().settings.toJS();
        ss.set("settings_v4", this._replaceDefaults("saving", settings));
    }

    /**
     * Save settings to local storage after checking for defaults, given
     * an explicit settings object (used by the constructor, before the
     * Redux state exists yet).
     */
    private _saveSettingsRaw(settings: any, defaultSettings?: any) {
        ss.set(
            "settings_v4",
            this._replaceDefaults("saving", settings, defaultSettings)
        );
    }

    /**
     * Load settings from local storage and fill in details
     */
    private _loadSettings() {
        const userSavedSettings = ss.get("settings_v4");
        return this._replaceDefaults("loading", userSavedSettings);
    }

    /**
     * Returns the currently active choices for settings, either default or from local storage
     */
    private _getChoices(): any {
        // default choices the user can select from
        const choices = this._getDefaultChoices();
        // get choices stored in local storage
        const savedChoices = this._ensureBackwardsCompatibilityChoices(
            ss.get("defaults_v1", {apiServer: []})
        );

        // merge choices by hand (do not use merge as the order in the apiServer list may change)
        const mergedChoices: any = Object.assign({}, savedChoices);
        Object.keys(choices).forEach(key => {
            if (key != "apiServer") {
                mergedChoices[key] = choices[key];
            }
        });
        mergedChoices.apiServer = this._getApiServerChoices(choices, savedChoices);
        return mergedChoices;
    }

    /**
     * Get all apiServer choices and mark the ones that are in the default choice as default
     */
    private _getApiServerChoices(choices: any, savedChoices: any) {
        let apiServer = choices.apiServer.slice(0); // maintain order in apiConfig.js
        // add any apis that the user added and update changes
        savedChoices.apiServer.forEach((api: any) => {
            const found = apiServer.find((a: any) => a.url == api.url);
            if (!!found) {
                this._injectApiConfiguration(found, api);
            } else {
                if (!api.default) {
                    // always add personal nodes at end of existing nodes, arbitrary decision
                    apiServer.push(api);
                }
            }
        });
        apiServer = apiServer.map((node: any) => {
            const found = choices.apiServer.find((a: any) => a.url == node.url);
            node.default = !!found;
            node.hidden = !!node.hidden; // make sure this flag exists
            return node;
        });
        return apiServer;
    }

    /**
     * Adjust loaded choices for backwards compatibility if any key names or values change
     */
    private _ensureBackwardsCompatibilityChoices(savedChoices: any) {
        /* Fix for old clients after changing cn to zh */
        if (savedChoices && savedChoices.locale) {
            const cnIdx = savedChoices.locale.findIndex((a: any) => a === "cn");
            if (cnIdx !== -1) savedChoices.locale[cnIdx] = "zh";
        }
        if (savedChoices && savedChoices.themes) {
            const olIdx = savedChoices.themes.findIndex(
                (a: any) => a === "olDarkTheme"
            );
            if (olIdx !== -1) savedChoices.themes[olIdx] = "midnightTheme";
        }
        if (savedChoices && savedChoices.apiServer) {
            savedChoices.apiServer = savedChoices.apiServer.map((api: any) => {
                // might be only a string, be backwards compatible
                if (typeof api === "string") {
                    api = {
                        url: api,
                        location: null
                    };
                }
                return api;
            });
        }
        return savedChoices;
    }

    init(): Promise<void> {
        return new Promise(resolve => {
            if (this.getState().initDone) {
                resolve();
                return;
            }
            const starredKey = this._getChainKey("markets");
            const marketsKey = this._getChainKey("userMarkets");
            const basesKey = this._getChainKey("preferredBases");
            // Default markets setup
            const topMarkets: any = {
                markets_4018d784: (getMyMarketsQuotes as any)(),
                markets_39f5e2ed: [
                    // TESTNET
                    "PEG.FAKEUSD",
                    "BTWTY"
                ]
            };

            const bases: any = {
                markets_4018d784: (getMyMarketsBases as any)(),
                markets_39f5e2ed: [
                    // TESTNET
                    "TEST"
                ]
            };

            const coreAssets: any = {
                markets_4018d784: "BTS",
                markets_39f5e2ed: "TEST"
            };
            const coreAsset = coreAssets[starredKey] || "BTS";
            /*
             * Update units depending on the chain, also make sure the 0 index
             * asset is always the correct CORE asset name
             */
            this.onUpdateUnits();
            const defaults = this.getState().defaults;
            defaults.unit[0] = coreAsset;

            const defaultBases = bases[starredKey] || bases.markets_4018d784;
            const storedBases = ss.get(basesKey, []);
            const preferredBases = Immutable.List(
                storedBases.length ? storedBases : defaultBases
            );

            const chainMarkets = topMarkets[starredKey] || [];

            const defaultMarketsList = this._getDefaultMarkets(
                preferredBases,
                chainMarkets
            );
            const defaultMarkets = Immutable.Map(defaultMarketsList);
            const starredMarkets = Immutable.Map(ss.get(starredKey, []));
            const userMarkets = Immutable.Map(ss.get(marketsKey, {}));

            reduxStore.dispatch(
                patchState({
                    starredKey,
                    marketsKey,
                    basesKey,
                    preferredBases,
                    chainMarkets,
                    defaultMarkets,
                    starredMarkets,
                    userMarkets,
                    initDone: true
                })
            );
            resolve();
        });
    }

    private _getDefaultMarkets(preferredBases: any, chainMarkets: any) {
        const markets: any[] = [];

        preferredBases.forEach((base: any) => {
            addMarkets(markets, base, chainMarkets);
        });

        function addMarkets(target: any[], base: any, markets: any[]) {
            markets
                .filter((a: any) => {
                    return a !== base;
                })
                .forEach((market: any) => {
                    target.push([`${market}_${base}`, {quote: market, base: base}]);
                });
        }

        return markets;
    }

    getSetting(setting: string) {
        return this.getState().settings.get(setting);
    }

    onChangeSetting(payload: {setting: string; value: any; rememberMe?: any}) {
        let save = true;
        switch (payload.setting) {
            case "faucet_address":
                if (payload.value.indexOf("testnet") === -1) {
                    ss.set("mainnet_faucet", payload.value);
                    reduxStore.dispatch(
                        patchState({mainnet_faucet: payload.value})
                    );
                } else {
                    ss.set("testnet_faucet", payload.value);
                    reduxStore.dispatch(
                        patchState({testnet_faucet: payload.value})
                    );
                }
                break;

            case "walletLockTimeout":
                ss.set("lockTimeout", payload.value);
                break;

            case "activeNode":
                // doesnt need to be saved in local storage
                save = true;

            default:
                break;
        }
        // check current settings
        if (this.getState().settings.get(payload.setting) !== payload.value) {
            const settings = this.getState().settings.set(
                payload.setting,
                payload.value
            );
            reduxStore.dispatch(patchState({settings}));
            if (save) {
                this._saveSettings();
            }
        }
    }

    onChangeViewSetting(payload: any) {
        let viewSettings = this.getState().viewSettings;
        for (const key in payload) {
            viewSettings = viewSettings.set(key, payload[key]);
        }
        reduxStore.dispatch(patchState({viewSettings}));
        ss.set("viewSettings_v1", viewSettings.toJS());
    }

    onChangeMarketDirection(payload: any) {
        let marketDirections = this.getState().marketDirections;
        for (const key in payload) {
            if (payload[key]) {
                marketDirections = marketDirections.set(key, payload[key]);
            } else {
                marketDirections = marketDirections.delete(key);
            }
        }
        reduxStore.dispatch(patchState({marketDirections}));
        ss.set("marketDirections", marketDirections.toJS());
    }

    onHideAsset(payload: {id: any; status: any}) {
        let hiddenAssets = this.getState().hiddenAssets;
        if (payload.id) {
            if (!payload.status) {
                hiddenAssets = hiddenAssets.delete(hiddenAssets.indexOf(payload.id));
            } else {
                hiddenAssets = hiddenAssets.push(payload.id);
            }
        }
        reduxStore.dispatch(patchState({hiddenAssets}));
        ss.set("hiddenAssets", hiddenAssets.toJS());
    }

    onHideMarket(payload: {id: any; status: any}) {
        let hiddenMarkets = this.getState().hiddenMarkets;
        if (payload.id) {
            if (!payload.status) {
                hiddenMarkets = hiddenMarkets.delete(
                    hiddenMarkets.indexOf(payload.id)
                );
            } else {
                hiddenMarkets = hiddenMarkets.push(payload.id);
            }
        }
        reduxStore.dispatch(patchState({hiddenMarkets}));
        ss.set("hiddenMarkets", hiddenMarkets.toJS());
    }

    onAddStarMarket(market: {quote: any; base: any}) {
        const marketID = market.quote + "_" + market.base;
        const state = this.getState();
        if (!state.starredMarkets.has(marketID)) {
            const starredMarkets = state.starredMarkets.set(marketID, {
                quote: market.quote,
                base: market.base
            });
            reduxStore.dispatch(patchState({starredMarkets}));
            ss.set(state.starredKey, starredMarkets.toJS());
        } else {
            return false;
        }
    }

    onSetUserMarket(payload: {quote: any; base: any; value: any}) {
        const marketID = payload.quote + "_" + payload.base;
        const state = this.getState();
        let userMarkets = state.userMarkets;
        if (payload.value) {
            userMarkets = userMarkets.set(marketID, {
                quote: payload.quote,
                base: payload.base
            });
        } else {
            userMarkets = userMarkets.delete(marketID);
        }
        reduxStore.dispatch(patchState({userMarkets}));
        ss.set(state.marketsKey, userMarkets.toJS());
    }

    onRemoveStarMarket(market: {quote: any; base: any}) {
        const marketID = market.quote + "_" + market.base;
        const state = this.getState();
        const starredMarkets = state.starredMarkets.delete(marketID);
        reduxStore.dispatch(patchState({starredMarkets}));
        ss.set(state.starredKey, starredMarkets.toJS());
    }

    onClearStarredMarkets() {
        const starredMarkets = Immutable.Map({});
        reduxStore.dispatch(patchState({starredMarkets}));
        ss.set(this.getState().starredKey, starredMarkets.toJS());
    }

    onAddWS(ws: any) {
        if (typeof ws === "string") {
            ws = {url: ws, location: null};
        }
        reduxStore.dispatch(addWSAction(ws));
        ss.set("defaults_v1", this.getState().defaults);
    }

    onRemoveWS(index: number) {
        reduxStore.dispatch(removeWSAction(index));
        ss.set("defaults_v1", this.getState().defaults);
    }

    onHideWS(url: string) {
        reduxStore.dispatch(hideWSAction(url));
        ss.set("defaults_v1", this.getState().defaults);
    }

    onShowWS(url: string) {
        reduxStore.dispatch(showWSAction(url));
        ss.set("defaults_v1", this.getState().defaults);
    }

    onClearSettings(resolve?: () => void) {
        ss.remove("settings_v3");
        ss.remove("settings_v4");
        const defaultSettings = this.getState().defaultSettings;
        reduxStore.dispatch(patchState({settings: defaultSettings}));

        this._saveSettings();

        if (resolve) {
            resolve();
        }
    }

    onSwitchLocale({locale}: {locale: string}) {
        this.onChangeSetting({setting: "locale", value: locale});
    }

    private _getChainId() {
        return ((Apis as any).instance().chain_id || "4018d784").substr(0, 8);
    }

    private _getChainKey(key: string) {
        const chainId = this._getChainId();
        return key + (chainId ? `_${chainId.substr(0, 8)}` : "");
    }

    onUpdateLatencies(latencies: any) {
        ss.set("apiLatencies", latencies);
        reduxStore.dispatch(patchState({apiLatencies: latencies}));
    }

    getLastBudgetObject() {
        return ss.get(this._getChainKey("lastBudgetObject"), "2.13.1");
    }

    setLastBudgetObject(value: any) {
        ss.set(this._getChainKey("lastBudgetObject"), value);
    }

    private setExchangeSettings(key: string, value: any) {
        const exchange = this.getState().exchange.set(key, value);
        reduxStore.dispatch(patchState({exchange}));
        ss.set("exchange", exchange.toJS());
    }

    getPriceAlert() {
        return this.getState().priceAlert.toJS();
    }

    onSetPriceAlert(value: any) {
        const priceAlert = fromJS(value);
        reduxStore.dispatch(patchState({priceAlert}));
        ss.set("priceAlert", value);
    }

    hasAnyPriceAlert(quoteAssetSymbol: string, baseAssetSymbol: string) {
        return this.getState().priceAlert.some(
            (priceAlert: any) =>
                priceAlert.get("quoteAssetSymbol") === quoteAssetSymbol &&
                priceAlert.get("baseAssetSymbol") === baseAssetSymbol
        );
    }

    getExchangeSettings(key: string) {
        return this.getState().exchange.get(key);
    }

    onSetExchangeLastExpiration(value: any) {
        this.setExchangeSettings("lastExpiration", fromJS(value));
    }

    onSetExchangeTutorialShown(value: any) {
        this.setExchangeSettings("tutorialShown", value);
    }

    getExhchangeLastExpiration() {
        return this.getExchangeSettings("lastExpiration");
    }

    onModifyPreferedBases(payload: any) {
        const state = this.getState();
        let preferredBases = state.preferredBases;
        let defaultMarkets = state.defaultMarkets;
        if ("newIndex" in payload && "oldIndex" in payload) {
            /* Reorder */
            const current = preferredBases.get(payload.newIndex);
            preferredBases = preferredBases.set(
                payload.newIndex,
                preferredBases.get(payload.oldIndex)
            );
            preferredBases = preferredBases.set(payload.oldIndex, current);
        } else if ("remove" in payload) {
            /* Remove */
            preferredBases = preferredBases.delete(payload.remove);
            defaultMarkets = Immutable.Map(
                this._getDefaultMarkets(preferredBases, state.chainMarkets)
            );
        } else if ("add" in payload) {
            /* Add new */
            preferredBases = preferredBases.push(payload.add);
            defaultMarkets = Immutable.Map(
                this._getDefaultMarkets(preferredBases, state.chainMarkets)
            );
        }

        reduxStore.dispatch(patchState({preferredBases, defaultMarkets}));
        ss.set(state.basesKey, preferredBases.toArray());
    }

    onUpdateUnits() {
        const defaults = this.getState().defaults;
        defaults.unit = (getUnits as any)();
        let settings = this.getState().settings;
        if (defaults.unit.indexOf(settings.get("unit")) === -1) {
            settings = settings.set("unit", defaults.unit[0]);
            settings = settings.set("fee_asset", defaults.unit[0]);
        }
        reduxStore.dispatch(patchState({defaults, settings}));
    }

    onHideNewsHeadline(payload: any) {
        // Preserved verbatim, not fixed: `.indexOf(payload)` is truthy
        // whenever `payload` is NOT in the list (-1, truthy) or found at
        // any index other than 0 (0 is falsy) - the opposite of the
        // apparent intent ("only add if not already present"). A
        // pre-existing bug in the original, not introduced here.
        const hiddenNewsHeadline = this.getState().hiddenNewsHeadline;
        if (payload && hiddenNewsHeadline.indexOf(payload)) {
            const newHiddenNewsHeadline = hiddenNewsHeadline.push(payload);
            reduxStore.dispatch(
                patchState({hiddenNewsHeadline: newHiddenNewsHeadline})
            );
            ss.set("hiddenNewsHeadline", newHiddenNewsHeadline.toJS());
        }
    }

    onAddChartLayout(value: any) {
        if (value.name) {
            value.enabled = true;
            let chartLayouts = this.getState().chartLayouts;
            const index = chartLayouts.findIndex(
                (item: any) =>
                    item.name === value.name && item.symbol === value.symbol
            );
            if (index !== -1) {
                chartLayouts = chartLayouts.delete(index);
            }
            chartLayouts = chartLayouts.map((item: any) => {
                if (item.symbol === value.symbol) item.enabled = false;
                return item;
            });
            chartLayouts = chartLayouts.push(value);
            reduxStore.dispatch(patchState({chartLayouts}));
            ss.set("chartLayouts", chartLayouts.toJS());
        }
    }

    onDeleteChartLayout(name: string) {
        if (name) {
            let chartLayouts = this.getState().chartLayouts;
            const index = chartLayouts.findIndex((item: any) => item.name === name);
            if (index !== -1) {
                chartLayouts = chartLayouts.delete(index);
            }
            reduxStore.dispatch(patchState({chartLayouts}));
            ss.set("chartLayouts", chartLayouts.toJS());
        }
    }
}

export default new SettingsStoreFacade();
