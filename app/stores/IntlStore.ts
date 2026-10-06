// Redux-backed replacement for the Alt.js IntlStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 batch 9 - see
// `../store/reduxStore.ts`'s header for the overall migration approach).
//
// Part of a genuinely circular cluster that could not be split into
// smaller batches: `IntlActions.switchLocale` is bound by BOTH this
// store and `SettingsStore`; `SettingsActions.clearSettings` is bound by
// BOTH `SettingsStore` and this store. Alt's `bindListeners` requires
// the action reference to stay a real Alt action for as long as any
// store still binds to it directly - so `IntlStore`, `SettingsStore`,
// `WalletUnlockStore`, `AccountStore`, and `WalletManagerStore` (which
// cross-binds via `WalletActions.setWallet` with `AccountStore`) all had
// to migrate together in one commit. Cross-notifications are wired
// explicitly in `../actions/IntlActions.ts`/`../actions/SettingsActions.ts`,
// same pattern as every other cross-bound pair this migration has
// handled (first established by the `TransactionConfirmStore`/
// `BalanceClaimActiveStore` batch).
//
// Preserves the exact interface every call site relies on - `getState()
// .currentLocale`, `listen()`, `unlisten()`, plus `hasLocale`/
// `getCurrentLocale` (dead in practice, grep-confirmed, but preserved
// for interface completeness like every other migrated store) - and
// `onSwitchLocale`/`onGetLocale`/`onClearSettings`, now plain public
// methods (rather than bindListeners-private) so
// `../actions/IntlActions.ts`/`../actions/SettingsActions.ts` can call
// them directly.
import {reduxStore} from "../store/reduxStore";
import counterpart from "counterpart";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const locale_en = require("assets/locales/locale-en.json");

counterpart.registerTranslations("en", locale_en);
counterpart.setFallbackLocale("en");

import {addLocaleData} from "react-intl";

import localeCodes from "assets/locales";
for (const localeCode of localeCodes as any) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    addLocaleData(require(`react-intl/locale-data/${localeCode}`));
}

import {setCurrentLocale, addLocale, selectIntlState} from "../store/slices/intlSlice";

class IntlStoreFacade {
    private localesObject: any = {en: locale_en};
    private unsubscribers = new Map<() => void, () => void>();

    getState() {
        return selectIntlState(reduxStore.getState());
    }

    listen(callback: () => void) {
        let previous = selectIntlState(reduxStore.getState());
        const unsubscribe = reduxStore.subscribe(() => {
            const next = selectIntlState(reduxStore.getState());
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

    hasLocale(locale: string) {
        return this.getState().locales.indexOf(locale) !== -1;
    }

    getCurrentLocale() {
        return this.getState().currentLocale;
    }

    onSwitchLocale({locale, localeData}: {locale: string; localeData?: any}) {
        switch (locale) {
            case "en":
                (counterpart as any).registerTranslations(
                    "en",
                    this.localesObject.en
                );
                break;

            default:
                (counterpart as any).registerTranslations(locale, localeData);
                break;
        }

        (counterpart as any).setLocale(locale);
        reduxStore.dispatch(setCurrentLocale(locale));
    }

    onGetLocale(locale: string) {
        reduxStore.dispatch(addLocale(locale));
    }

    onClearSettings() {
        this.onSwitchLocale({locale: "en"});
    }
}

export default new IntlStoreFacade();
