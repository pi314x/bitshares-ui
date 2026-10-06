// Redux-backed replacement for the Alt.js SettingsActions
// (docs/UI_MIGRATION_PLAN.md, Phase 9 batch 9 - see
// `../stores/IntlStore.ts`'s header for the full cross-binding cluster
// explanation). `changeSetting` is bound by THREE stores under real Alt
// (`SettingsStore`, `WalletUnlockStore`, `AccountStore`) - calls all
// three directly. `clearSettings` is bound by `SettingsStore` AND
// `IntlStore` - calls both. Every other method is bound only by
// `SettingsStore`.
import settingsStore from "../stores/SettingsStore";
import walletUnlockStore from "../stores/WalletUnlockStore";
import accountStore from "../stores/AccountStore";
import intlStore from "../stores/IntlStore";

class SettingsActionsFacade {
    changeSetting(value: any) {
        (settingsStore as any).onChangeSetting(value);
        (walletUnlockStore as any).onChangeSetting(value);
        (accountStore as any).onChangeSetting(value);
        return value;
    }

    changeViewSetting(value: any) {
        (settingsStore as any).onChangeViewSetting(value);
        return value;
    }

    changeMarketDirection(value: any) {
        (settingsStore as any).onChangeMarketDirection(value);
        return value;
    }

    addStarMarket(quote: any, base: any) {
        (settingsStore as any).onAddStarMarket({quote, base});
        return {quote, base};
    }

    removeStarMarket(quote: any, base: any) {
        (settingsStore as any).onRemoveStarMarket({quote, base});
        return {quote, base};
    }

    clearStarredMarkets() {
        (settingsStore as any).onClearStarredMarkets();
        return true;
    }

    setUserMarket(quote: any, base: any, value: any) {
        (settingsStore as any).onSetUserMarket({quote, base, value});
        return {quote, base, value};
    }

    addWS(ws: any) {
        (settingsStore as any).onAddWS(ws);
        return ws;
    }

    removeWS(index: number) {
        (settingsStore as any).onRemoveWS(index);
        return index;
    }

    hideWS(url: string) {
        (settingsStore as any).onHideWS(url);
        return url;
    }

    showWS(url: string) {
        (settingsStore as any).onShowWS(url);
        return url;
    }

    hideAsset(id: any, status: any) {
        (settingsStore as any).onHideAsset({id, status});
        return {id, status};
    }

    hideMarket(id: any, status: any) {
        (settingsStore as any).onHideMarket({id, status});
        return {id, status};
    }

    clearSettings(): Promise<void> {
        // returned promise is deprecated
        return new Promise(resolve => {
            (settingsStore as any).onClearSettings(resolve);
            (intlStore as any).onClearSettings();
        });
    }

    updateLatencies(latencies: any) {
        (settingsStore as any).onUpdateLatencies(latencies);
        return latencies;
    }

    setExchangeLastExpiration(value: any) {
        (settingsStore as any).onSetExchangeLastExpiration(value);
        return value;
    }

    setExchangeTutorialShown(value: any) {
        (settingsStore as any).onSetExchangeTutorialShown(value);
        return value;
    }

    modifyPreferedBases(payload: any) {
        (settingsStore as any).onModifyPreferedBases(payload);
        return payload;
    }

    updateUnits() {
        (settingsStore as any).onUpdateUnits();
        return true;
    }

    setPriceAlert(value: any) {
        (settingsStore as any).onSetPriceAlert(value);
        return value;
    }

    hideNewsHeadline(value: any) {
        (settingsStore as any).onHideNewsHeadline(value);
        return value;
    }

    addChartLayout(value: any) {
        (settingsStore as any).onAddChartLayout(value);
        return value;
    }

    deleteChartLayout(value: any) {
        (settingsStore as any).onDeleteChartLayout(value);
        return value;
    }
}

export default new SettingsActionsFacade();
