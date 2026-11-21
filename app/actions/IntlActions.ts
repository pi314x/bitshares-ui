// Redux-backed replacement for the Alt.js IntlActions
// (docs/UI_MIGRATION_PLAN.md, Phase 9 batch 9 - see
// `../stores/IntlStore.ts`'s header for the full cross-binding cluster
// explanation). `switchLocale` is bound by BOTH `IntlStore` and
// `SettingsStore` under real Alt - calls both stores' `onSwitchLocale`
// directly, at the exact point Alt's dispatcher would have (synchronously
// for the "en"/Electron-preloaded cases, after the fetch resolves for
// the web case). `getLocale` is only ever bound by `IntlStore` (dead in
// practice - grep-confirmed no real call site - but preserved for
// interface completeness).
import intlStore from "../stores/IntlStore";
import settingsStore from "../stores/SettingsStore";
import localeCodes from "assets/locales";

const locales: {[key: string]: any} = {};
if (__ELECTRON__) {
    (localeCodes as any).forEach((locale: string) => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        locales[locale] = require(`assets/locales/locale-${locale}.json`);
    });
}

class IntlActionsFacade {
    switchLocale(locale: string) {
        if (locale === "en") {
            this._notify({locale});
            return {locale};
        }
        if (__ELECTRON__) {
            const payload = {locale, localeData: locales[locale]};
            this._notify(payload);
            return payload;
        } else {
            fetch(`${__BASE_URL__}locale-${locale}.json`)
                .then(reply => {
                    return reply.json().then(result => {
                        this._notify({locale, localeData: result});
                    });
                })
                .catch(err => {
                    console.log("fetch locale error:", err);
                    // Preserved verbatim, not fixed: the original's
                    // catch handler *returns* a thunk function
                    // (`dispatch => {...}`) instead of calling it -
                    // under real Alt this was also never invoked by
                    // anyone, so the "fall back to English" branch was
                    // always dead code. No fallback dispatch happens
                    // here either, matching that exactly.
                });
        }
    }

    getLocale(locale: string) {
        (intlStore as any).onGetLocale(locale);
        return locale;
    }

    private _notify(payload: {locale: string; localeData?: any}) {
        (intlStore as any).onSwitchLocale(payload);
        (settingsStore as any).onSwitchLocale(payload);
    }
}

export default new IntlActionsFacade();
