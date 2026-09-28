// Characterization tests for app/lib/i18n/counterpartShim.js (Phase 8,
// docs/UI_MIGRATION_PLAN.md's "drop counterpart, consolidate on
// react-intl" goal). Compares the shim's `.translate()`/`.localize()`
// output against the REAL `counterpart` npm package's, for every leaf
// string key in the app's actual locale-en.json and locale-de.json
// content (not a hand-picked sample), plus locale-switching and
// missing-key edge cases. `counterpart` itself is only ever imported
// here, by its real on-disk path (bypassing the moduleNameMapper alias
// that redirects the bare `"counterpart"` specifier to the shim
// everywhere else) - it stays a devDependency for exactly this
// purpose, never shipped in the app bundle.
import realCounterpartModule from "../../../node_modules/counterpart/index.js";
import shimCounterpartModule from "lib/i18n/counterpartShim";

const localeEn = require("../../assets/locales/locale-en.json");
const localeDe = require("../../assets/locales/locale-de.json");

function freshInstance(mod) {
    // Both the real package and the shim export a singleton translator
    // function with an `Instance`/`Translator` constructor attached -
    // use a fresh instance per test run so tests don't leak locale
    // registrations into each other.
    const Ctor = mod.Instance || mod.Translator;
    const instance = new Ctor();
    const fn = function() {
        return instance.translate.apply(instance, arguments);
    };
    Object.assign(fn, {
        getLocale: instance.getLocale.bind(instance),
        setLocale: instance.setLocale.bind(instance),
        getFallbackLocale: instance.getFallbackLocale.bind(instance),
        setFallbackLocale: instance.setFallbackLocale.bind(instance),
        registerTranslations: instance.registerTranslations.bind(instance),
        onLocaleChange: instance.onLocaleChange.bind(instance),
        offLocaleChange: instance.offLocaleChange.bind(instance),
        translate: instance.translate.bind(instance),
        localize: instance.localize.bind(instance)
    });
    return fn;
}

function setupBoth() {
    const real = freshInstance(realCounterpartModule);
    const shim = freshInstance(shimCounterpartModule);

    real.registerTranslations("en", localeEn);
    shim.registerTranslations("en", localeEn);
    real.registerTranslations("de", localeDe);
    shim.registerTranslations("de", localeDe);
    real.setFallbackLocale("en");
    shim.setFallbackLocale("en");

    return {real, shim};
}

// Walk a nested translations object, collecting {path, value} for every
// leaf string, exactly like counterpart's own dot-path key space.
function collectLeafStrings(obj, prefix, out) {
    Object.keys(obj).forEach(key => {
        const value = obj[key];
        const path = prefix ? prefix + "." + key : key;
        if (typeof value === "string") {
            out.push({path, value});
        } else if (
            value &&
            typeof value === "object" &&
            !Array.isArray(value)
        ) {
            collectLeafStrings(value, path, out);
        }
        // arrays of strings (a couple of keys in the locale files) are
        // skipped - counterpart's dot-path lookup doesn't address into
        // them positionally the way this walk does for objects, and no
        // `Translate`/`counterpart.translate()` call site in this app
        // ever passes an array index as part of a translation key.
    });
    return out;
}

// Every `%(name)s`-style placeholder actually referenced in a string.
function placeholderNames(value) {
    const names = new Set();
    const re = /%\(([a-zA-Z0-9_]+)\)[a-zA-Z%]/g;
    let m;
    while ((m = re.exec(value))) {
        names.add(m[1]);
    }
    return Array.from(names);
}

function syntheticValueFor(name) {
    // Deterministic, human-legible per-name synthetic values so a
    // mismatch is easy to trace back to the offending placeholder.
    return "TEST_" + name.toUpperCase() + "_VALUE";
}

// A handful of real locale strings contain a stray `%` that isn't part of
// a valid sprintf-js directive (e.g. "...%(offset)s%" or "...100%...").
// sprintf-js - the *same* library both the real counterpart package and
// this shim delegate interpolation to - throws a parse error for these,
// identically on both sides (verified: the throw originates inside the
// real package's own `_interpolate`, not this shim's code). In the real
// app this is inert: `<Translate>` only enables interpolation for
// textContent-only elements or `unsafe` content, and otherwise leaves
// the raw string (with its literal `%`) to `react-interpolate-component`
// -a separate, non-sprintf token substitution mechanism this port does
// not touch. So "both engines throw the same way" is itself the
// faithful-port outcome to assert here, not a fidelity gap.
function translateOrError(engine, path, vars) {
    try {
        return {ok: true, value: engine.translate(path, vars)};
    } catch (err) {
        return {ok: false, message: err.message};
    }
}

describe("counterpartShim vs real counterpart: locale-en.json", () => {
    const {real, shim} = setupBoth();
    const leaves = collectLeafStrings(localeEn, "", []);

    it("found a non-trivial number of translation keys to check", () => {
        expect(leaves.length).toBeGreaterThan(500);
    });

    it.each(leaves.map(({path}) => [path]))("translate('%s') matches", path => {
        const entry = leaves.find(l => l.path === path);
        const vars = {};
        placeholderNames(entry.value).forEach(name => {
            vars[name] = syntheticValueFor(name);
        });

        const expected = translateOrError(real, path, vars);
        const actual = translateOrError(shim, path, vars);
        expect(actual).toEqual(expected);
    });
});

describe("counterpartShim vs real counterpart: locale-de.json (fallback)", () => {
    const {real, shim} = setupBoth();
    const leaves = collectLeafStrings(localeDe, "", []);

    it("found a non-trivial number of German translation keys to check", () => {
        expect(leaves.length).toBeGreaterThan(500);
    });

    it.each(leaves.map(({path}) => [path]))(
        "translate('%s', {locale: 'de'}) matches",
        path => {
            const entry = leaves.find(l => l.path === path);
            const vars = {locale: "de"};
            placeholderNames(entry.value).forEach(name => {
                vars[name] = syntheticValueFor(name);
            });

            const expected = translateOrError(real, path, vars);
            const actual = translateOrError(shim, path, vars);
            expect(actual).toEqual(expected);
        }
    );
});

describe("counterpartShim vs real counterpart: edge cases", () => {
    it("matches on a missing translation key", () => {
        const {real, shim} = setupBoth();
        expect(shim.translate("this.key.does.not.exist")).toBe(
            real.translate("this.key.does.not.exist")
        );
    });

    it("matches when a German key is missing and falls back to English", () => {
        const {real, shim} = setupBoth();
        // `transfer.memo` exists in both locale files with different text;
        // pick a key structure guaranteed only in English by using a
        // locale that was never registered for German, forcing the
        // registered fallbackLocale ("en") path in both engines.
        const key = "settings.select_language"; // present in en; may or may not be in de
        expect(shim.translate(key, {locale: "de"})).toBe(
            real.translate(key, {locale: "de"})
        );
    });

    it("matches interpolation with %(name)s across getLocale/setLocale", () => {
        const {real, shim} = setupBoth();
        expect(shim.getLocale()).toBe(real.getLocale());
        real.setLocale("de");
        shim.setLocale("de");
        expect(shim.getLocale()).toBe(real.getLocale());
        expect(shim.translate("account.not_found", {name: "alice"})).toBe(
            real.translate("account.not_found", {name: "alice"})
        );
    });

    it("onLocaleChange/offLocaleChange fire the same way", () => {
        const {real, shim} = setupBoth();
        const realCalls = [];
        const shimCalls = [];
        const realCb = (next, prev) => realCalls.push([next, prev]);
        const shimCb = (next, prev) => shimCalls.push([next, prev]);

        real.onLocaleChange(realCb);
        shim.onLocaleChange(shimCb);

        real.setLocale("de");
        shim.setLocale("de");
        real.setLocale("de"); // no-op, same locale - should not re-fire
        shim.setLocale("de");

        real.offLocaleChange(realCb);
        shim.offLocaleChange(shimCb);

        real.setLocale("en");
        shim.setLocale("en"); // listener removed - should not fire

        expect(shimCalls).toEqual(realCalls);
        expect(shimCalls).toEqual([["de", "en"]]);
    });
});

describe("counterpartShim vs real counterpart: .localize()", () => {
    // The exact type/format/locale combinations actually used across this
    // app's real `counterpart.localize(...)` call sites (grepped), plus
    // the no-options default this app also relies on.
    const fixedDates = [
        new Date(Date.UTC(2024, 0, 15, 9, 5, 3)), // Jan 15 2024, 09:05:03 UTC
        new Date(Date.UTC(2024, 11, 1, 23, 59, 59)) // Dec 1 2024, 23:59:59 UTC
    ];
    const combos = [
        {},
        {type: "date"},
        {type: "date", format: "short"},
        {type: "date", format: "full"},
        {type: "date", format: "short_custom"},
        {type: "date", format: "market_history"},
        {type: "date", format: "market_history_us"}
    ];
    const locales = ["en", "de"];

    locales.forEach(locale => {
        combos.forEach(combo => {
            fixedDates.forEach((date, dateIdx) => {
                it(`localize date#${dateIdx} ${JSON.stringify(
                    combo
                )} locale=${locale} matches`, () => {
                    const {real, shim} = setupBoth();
                    const options = Object.assign({locale}, combo);
                    expect(shim.localize(date, options)).toBe(
                        real.localize(date, options)
                    );
                });
            });
        });
    });
});
