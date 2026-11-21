// A local replacement for `react-translate-component` (and the `react-interpolate-component` it renders with): the same
// component for the same props - `content`, `component`, `unsafe`, `with`, `attributes`, `count`, `locale`, `fallback`,
// and any other prop, which is a value to interpolate when the text names it as %(name)s and an attribute of the element
// when it does not - written as a function component. The package is a class made with `createReactClass` that reads the
// translator from React's LEGACY context (`contextTypes`), which React 18 reports in the console of every page that
// uses it ("uses the legacy contextTypes API which is no longer supported"). It is the translator of `counterpart` (the
// local shim, lib/i18n/counterpartShim.js, by the build's alias) that it always used: nothing here reads a context.
//
// Aliased in webpack.config.js and in Jest's `moduleNameMapper`, so that no import changes. Characterised against the
// package in app/__tests__/i18n/translateShim-test.js.
import * as React from "react";
import translator from "counterpart";

const REGEXP = /%\((.+?)\)s/;
const OMITTED = ["children", "format", "component", "unsafe", "with"];
const TEXT_CONTENT_COMPONENTS = ["title", "option", "textarea"];

const isString = value =>
    Object.prototype.toString.call(value) === "[object String]";

function except(object, keys) {
    const out = {};
    Object.keys(object).forEach(key => {
        if (keys.indexOf(key) === -1) out[key] = object[key];
    });
    return out;
}

// what `react-interpolate-component` renders: the text with %(name)s replaced by the values of the props (and of `with`)
function interpolate(props, format) {
    const unsafe = props.unsafe === true;
    const interpolations = Object.assign({}, props, props.with);
    const matches = [];
    const children = [];
    let rest = except(props, OMITTED);
    const parent = props.component || "span";
    if (!isString(format)) {
        throw new Error(
            "Interpolate expects either a format string as only child or a `format` prop with a string value"
        );
    }
    if (unsafe) {
        const html = format.split(REGEXP).reduce((memo, match, index) => {
            let piece;
            if (index % 2 === 0) {
                piece = match;
            } else {
                piece = interpolations[match];
                matches.push(match);
            }
            if (React.isValidElement(piece)) {
                throw new Error(
                    "cannot interpolate a React component into unsafe text"
                );
            }
            return memo + piece;
        }, "");
        rest.dangerouslySetInnerHTML = {__html: html};
    } else {
        format.split(REGEXP).forEach((match, index) => {
            if (index % 2 === 0) {
                if (match.length === 0) return;
                children.push(match);
            } else {
                children.push(interpolations[match]);
                matches.push(match);
            }
        });
    }
    rest = except(rest, matches);
    return React.createElement.apply(React, [parent, rest].concat(children));
}

export default function Translate(given) {
    const props = Object.assign({component: "span"}, given);
    const [locale, setLocale] = React.useState(() => translator.getLocale());
    const fixed = !!props.locale;
    React.useEffect(() => {
        if (fixed) return undefined;
        // (the locale may have changed between the first render and now)
        setLocale(translator.getLocale());
        translator.onLocaleChange(setLocale);
        return () => translator.offLocaleChange(setLocale);
    }, [fixed]);

    const textContent = TEXT_CONTENT_COMPONENTS.indexOf(props.component) > -1;
    const interpolating = textContent || props.unsafe === true;
    const interpolations = props.with;
    const attributeOptions = Object.assign(
        {locale: locale, scope: undefined},
        props,
        interpolations,
        {interpolate: true}
    );
    const contentOptions = Object.assign({}, attributeOptions, {
        interpolate: interpolating
    });

    const element = Object.assign({}, props);
    delete element.locale;
    delete element.scope;
    delete element.count;
    delete element.with;
    delete element.fallback;

    if (element.attributes) {
        Object.keys(element.attributes).forEach(name => {
            const key = element.attributes[name];
            if (key)
                element[name] = translator.translate(key, attributeOptions);
        });
        delete element.attributes;
    }

    if (element.content) {
        const translation = translator.translate(
            element.content,
            contentOptions
        );
        const forInterpolation = Object.assign({}, element, {
            with: interpolations
        });
        delete forInterpolation.content;
        delete forInterpolation.children;
        return interpolate(forInterpolation, translation);
    }
    const component = element.component;
    delete element.component;
    delete element.unsafe;
    return React.createElement(component, element);
}

Translate.textContentComponents = TEXT_CONTENT_COMPONENTS;
Translate.translate = (key, options) =>
    React.createElement(Translate, Object.assign({}, options, {content: key}));
Translate.getLocale = translator.getLocale.bind(translator);
Translate.setLocale = translator.setLocale.bind(translator);
Translate.onLocaleChange = translator.onLocaleChange.bind(translator);
Translate.offLocaleChange = translator.offLocaleChange.bind(translator);
Translate.registerTranslations = translator.registerTranslations.bind(
    translator
);
