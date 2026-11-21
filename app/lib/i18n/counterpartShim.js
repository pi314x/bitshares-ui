// Local replacement for the `counterpart` npm package, as part of Phase
// 8's "drop counterpart, consolidate on react-intl" goal
// (docs/UI_MIGRATION_PLAN.md). See docs/UI_MIGRATION_PLAN.md's Phase 8
// progress notes for the full design rationale.
//
// This is NOT a rewrite of the app's ~2,900 `Translate`/`counterpart
// .translate()` call sites (react-translate-component's `Translate`
// component and every direct `import counterpart from "counterpart"`
// keep working completely unchanged) - it is a drop-in reimplementation
// of the specific subset of counterpart's public API this app actually
// calls (verified by grepping every `counterpart.<method>` call site:
// `translate`, `localize`, `getLocale`, `setLocale`, `getFallbackLocale`,
// `setFallbackLocale`, `registerTranslations`, `onLocaleChange`,
// `offLocaleChange` - nothing else, e.g. no pluralization, no `scope`
// prefixing, no `withLocale`/`withScope`, no fallback-key resolution,
// are ever used anywhere in this codebase). Wired in via a build-time
// module alias (webpack `resolve.alias` + Jest `moduleNameMapper`, both
// pointing the `"counterpart"` import specifier at this file) so it also
// transparently replaces `counterpart` for `react-translate-component`'s
// own internal `require("counterpart")` - no third-party package source
// is modified.
//
// The real `counterpart` package's actual algorithm (read directly from
// node_modules/counterpart/index.js during design) is followed closely:
// dot-path locale->scope->key lookup into a registry of deep-merged
// per-locale translation trees, `sprintf-js`'s real `sprintf()` for
// `%(name)s`-style interpolation (the exact interpolation library
// counterpart itself uses internally - reused here directly rather than
// reimplemented, so all of its real-world edge-case behavior, e.g. a
// bare trailing `%` after a directive, is inherited exactly), and a
// vendored copy of counterpart's `strftime.js` for `.localize()`
// (see strftime.js's own header).
//
// Preserved verbatim (a real, if perhaps unintended, characteristic of
// the existing app - not something this port introduces or "fixes"):
// none of this app's 10 locale JSON files (app/assets/locales/locale-*
// .json) register a `counterpart.names` entry for any language - only
// `en` ever gets one (from this shim's own built-in English data, the
// same data the real counterpart package's own locales/en.js ships) -
// so `.localize()` renders month/day names in English regardless of the
// active UI locale, today and after this port alike. Characterization
// tests (app/__tests__/i18n/counterpartShim-test.js) compare this
// shim's `.translate()`/`.localize()` output against the real
// `counterpart` package's for a large sample of this app's actual
// locale-en.json keys/params and every `.localize()` call site's real
// type/format/locale combination, to verify this rewrite is faithful
// rather than merely plausible.
"use strict";

var sprintf = require("sprintf-js").sprintf;
var strftime = require("./strftime");

var ENGLISH_NAMES = strftime.defaultNames;

var ENGLISH_DEFAULT_FORMATS = {
    date: {
        default: "%a, %e %b %Y",
        long: "%A, %B %o, %Y",
        short: "%b %e"
    },
    time: {
        default: "%H:%M",
        long: "%H:%M:%S %z",
        short: "%H:%M"
    },
    datetime: {
        default: "%a, %e %b %Y %H:%M",
        long: "%A, %B %o, %Y %H:%M:%S %z",
        short: "%e %b %H:%M"
    }
};

function isPlainObject(val) {
    if (val === null || typeof val !== "object") return false;
    return Object.prototype.toString.call(val) === "[object Object]";
}

function deepMerge(target, source) {
    if (!isPlainObject(source)) return source;
    Object.keys(source).forEach(function(key) {
        if (isPlainObject(source[key])) {
            if (!isPlainObject(target[key])) target[key] = {};
            deepMerge(target[key], source[key]);
        } else {
            target[key] = source[key];
        }
    });
    return target;
}

function getEntry(translations, keys) {
    return keys.reduce(function(result, key) {
        if (
            isPlainObject(result) &&
            Object.prototype.hasOwnProperty.call(result, key)
        ) {
            return result[key];
        }
        return null;
    }, translations);
}

function normalizeKey(key, separator) {
    if (Array.isArray(key)) {
        return key.reduce(function(acc, k) {
            return acc.concat(normalizeKey(k, separator));
        }, []);
    }
    if (key === undefined || key === null) return [];
    return String(key)
        .split(separator)
        .filter(function(k) {
            return k !== "";
        });
}

function CounterpartShim() {
    this._locale = "en";
    this._fallbackLocales = [];
    this._translations = {};
    this._localeChangeListeners = [];

    // Matches the real counterpart package's own constructor, which
    // always registers its built-in English `counterpart.formats`/
    // `counterpart.names` before any app code runs.
    this.registerTranslations("en", {
        counterpart: {
            formats: ENGLISH_DEFAULT_FORMATS,
            names: ENGLISH_NAMES
        }
    });
}

CounterpartShim.prototype.getLocale = function() {
    return this._locale;
};

CounterpartShim.prototype.setLocale = function(value) {
    var previous = this._locale;
    if (previous !== value) {
        this._locale = value;
        this._localeChangeListeners.slice().forEach(function(cb) {
            cb(value, previous);
        });
    }
    return previous;
};

CounterpartShim.prototype.getFallbackLocale = function() {
    return this._fallbackLocales;
};

CounterpartShim.prototype.setFallbackLocale = function(value) {
    var previous = this._fallbackLocales;
    this._fallbackLocales = [].concat(value || []);
    return previous;
};

CounterpartShim.prototype.registerTranslations = function(locale, data) {
    this._translations[locale] = this._translations[locale] || {};
    deepMerge(this._translations[locale], data);
    return this._translations;
};

CounterpartShim.prototype.onLocaleChange = CounterpartShim.prototype.addLocaleChangeListener = function(
    callback
) {
    this._localeChangeListeners.push(callback);
};

CounterpartShim.prototype.offLocaleChange = CounterpartShim.prototype.removeLocaleChangeListener = function(
    callback
) {
    var idx = this._localeChangeListeners.indexOf(callback);
    if (idx !== -1) this._localeChangeListeners.splice(idx, 1);
};

CounterpartShim.prototype.translate = function(key, options) {
    var isArrayKey = Array.isArray(key);
    if ((!isArrayKey && typeof key !== "string") || !key.length) {
        throw new Error("invalid argument: key");
    }

    options = Object.assign({}, options);

    var locale = options.locale || this._locale;
    delete options.locale;

    var scope = options.scope || null;
    delete options.scope;

    var separator = options.separator || ".";
    delete options.separator;

    var fallbackLocales = [].concat(
        options.fallbackLocale || this._fallbackLocales
    );
    delete options.fallbackLocale;
    delete options.fallback;

    var baseKeys = normalizeKey(scope, separator).concat(
        normalizeKey(key, separator)
    );
    var keys = normalizeKey(locale, separator).concat(baseKeys);
    var entry = getEntry(this._translations, keys);

    if (
        entry === null &&
        fallbackLocales.length > 0 &&
        fallbackLocales.indexOf(locale) === -1
    ) {
        for (var i = 0; i < fallbackLocales.length; i++) {
            var fallbackKeys = normalizeKey(
                fallbackLocales[i],
                separator
            ).concat(baseKeys);
            var fallbackEntry = getEntry(this._translations, fallbackKeys);
            if (fallbackEntry !== null) {
                entry = fallbackEntry;
                break;
            }
        }
    }

    if (entry === null) {
        entry = "missing translation: " + keys.join(separator);
    }

    var interpolate = options.interpolate;
    delete options.interpolate;

    if (interpolate !== false && typeof entry === "string") {
        entry = sprintf(entry, options);
    }

    return entry;
};

CounterpartShim.prototype.localize = function(date, options) {
    if (!(date instanceof Date)) {
        throw new Error("invalid argument: object must be a date");
    }

    options = Object.assign({}, options);

    var locale = options.locale || this._locale;
    var scope = options.scope || "counterpart";
    var type = options.type || "datetime";
    var format = options.format || "default";

    var lookupOptions = {locale: locale, scope: scope, interpolate: false};
    var formatString = this.translate(
        ["formats", type, format],
        Object.assign({}, lookupOptions)
    );
    var names = this.translate("names", Object.assign({}, lookupOptions));

    return strftime(
        date,
        typeof formatString === "string" ? formatString : String(formatString),
        isPlainObject(names) ? names : undefined
    );
};

var instance = new CounterpartShim();

function translate() {
    return instance.translate.apply(instance, arguments);
}

Object.assign(translate, {
    Instance: CounterpartShim,
    Translator: CounterpartShim,
    getLocale: instance.getLocale.bind(instance),
    setLocale: instance.setLocale.bind(instance),
    getFallbackLocale: instance.getFallbackLocale.bind(instance),
    setFallbackLocale: instance.setFallbackLocale.bind(instance),
    registerTranslations: instance.registerTranslations.bind(instance),
    onLocaleChange: instance.onLocaleChange.bind(instance),
    offLocaleChange: instance.offLocaleChange.bind(instance),
    addLocaleChangeListener: instance.onLocaleChange.bind(instance),
    removeLocaleChangeListener: instance.offLocaleChange.bind(instance),
    translate: instance.translate.bind(instance),
    localize: instance.localize.bind(instance)
});

module.exports = translate;
