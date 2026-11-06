// A local replacement for the part of `react-intl` (v2) this app uses: `IntlProvider` (a locale and named formats),
// `FormattedDate`, `FormattedNumber`, `FormattedRelative` and `addLocaleData`, on the browser's own `Intl` (which is what
// react-intl formats with, so the text of a date or a number is the same). The package's version 2 provides its locale
// to the components through React's LEGACY context, which React 18 reports in the console on every start
// ("IntlProvider uses the legacy childContextTypes API", and "contextTypes" for each of its components that renders).
// Nothing is read from a context but the one made here.
//
// Aliased in webpack.config.js and in Jest's `moduleNameMapper`. Characterised in app/__tests__/i18n/intlShim-test.js.
import * as React from "react";

const IntlContext = React.createContext({locale: "en", formats: {}});

export function IntlProvider(props) {
    const {locale, formats, children} = props;
    const value = React.useMemo(
        () => ({locale: locale || "en", formats: formats || {}}),
        [locale, formats]
    );
    return React.createElement(
        IntlContext.Provider,
        {value},
        React.Children.only(children)
    );
}

/** The locale data of react-intl 2 is not needed: the browser has its own. */
export function addLocaleData() {
    return undefined;
}

const DATE_OPTIONS = [
    "localeMatcher",
    "formatMatcher",
    "timeZone",
    "hour12",
    "weekday",
    "era",
    "year",
    "month",
    "day",
    "hour",
    "minute",
    "second",
    "timeZoneName"
];
const NUMBER_OPTIONS = [
    "localeMatcher",
    "style",
    "currency",
    "currencyDisplay",
    "useGrouping",
    "minimumIntegerDigits",
    "minimumFractionDigits",
    "maximumFractionDigits",
    "minimumSignificantDigits",
    "maximumSignificantDigits"
];

const pick = (props, keys) => {
    const out = {};
    keys.forEach(key => {
        if (props[key] !== undefined) out[key] = props[key];
    });
    return out;
};

// a locale code of the app ("zh", "ja", "en") the browser may not know: its own default is used then
function locales(locale) {
    try {
        return Intl.DateTimeFormat.supportedLocalesOf([locale]).length
            ? [locale]
            : undefined;
    } catch (e) {
        return undefined;
    }
}

function show(text, children) {
    return typeof children === "function"
        ? children(text)
        : React.createElement("span", null, text);
}

export function FormattedDate(props) {
    const {locale, formats} = React.useContext(IntlContext);
    const named =
        props.format && formats.date ? formats.date[props.format] : undefined;
    const options = Object.assign({}, named, pick(props, DATE_OPTIONS));
    const date = new Date(props.value);
    let text;
    try {
        text = new Intl.DateTimeFormat(locales(locale), options).format(date);
    } catch (e) {
        text = String(date);
    }
    return show(text, props.children);
}

export function FormattedNumber(props) {
    const {locale, formats} = React.useContext(IntlContext);
    const named =
        props.format && formats.number
            ? formats.number[props.format]
            : undefined;
    const options = Object.assign({}, named, pick(props, NUMBER_OPTIONS));
    let text;
    try {
        text = new Intl.NumberFormat(locales(locale), options).format(
            props.value
        );
    } catch (e) {
        text = String(props.value);
    }
    return show(text, props.children);
}

// the best unit for a distance in seconds (the way react-intl's "best fit" picks it)
function bestUnit(seconds) {
    const s = Math.abs(seconds);
    if (s < 60) return ["second", seconds];
    if (s < 60 * 60) return ["minute", seconds / 60];
    if (s < 60 * 60 * 24) return ["hour", seconds / 3600];
    if (s < 60 * 60 * 24 * 30) return ["day", seconds / 86400];
    if (s < 60 * 60 * 24 * 365) return ["month", seconds / (86400 * 30)];
    return ["year", seconds / (86400 * 365)];
}

export function FormattedRelative(props) {
    const {locale} = React.useContext(IntlContext);
    const [now, setNow] = React.useState(() =>
        props.initialNow !== undefined ? props.initialNow : Date.now()
    );
    const interval =
        props.updateInterval !== undefined ? props.updateInterval : 0;
    React.useEffect(() => {
        if (!interval) return undefined;
        const timer = setInterval(() => setNow(Date.now()), interval);
        return () => clearInterval(timer);
    }, [interval]);
    const [unit, amount] = bestUnit(
        (new Date(props.value).getTime() - now) / 1000
    );
    let text;
    try {
        text = new Intl.RelativeTimeFormat(locales(locale), {
            numeric: "auto"
        }).format(Math.round(amount), unit);
    } catch (e) {
        text = new Date(props.value).toString();
    }
    return show(text, props.children);
}

export default {
    IntlProvider,
    FormattedDate,
    FormattedNumber,
    FormattedRelative
};
