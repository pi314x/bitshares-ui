// TypeScript/functional-component port of the legacy HelpContent.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
//
// `UNSAFE_componentWillMount` populated the module-scope `HelpData` cache
// *synchronously before the first render*, so that same first render's
// `HelpData[locale][path]` read would already see it - a `useEffect`
// (which runs *after* the first render/paint) would read `HelpData` too
// early and show a blank/error flash before catching up. Replicated with
// a synchronous check-and-run directly in the render body, gated by a
// `useRef` flag so it still only actually runs once per mount (matching
// `UNSAFE_componentWillMount`'s once-before-first-render semantics)
// rather than on every re-render.
//
// The constructor's `window._onClickLink = this.onClickLink.bind(this)`
// is a real pre-existing bug, preserved verbatim (not "fixed"): it's a
// single *global* variable, so when multiple `HelpContent` instances are
// mounted at once (routine - this component is used pervasively), each
// mount overwrites it, and only the most-recently-mounted instance's
// navigation actually receives clicks on any rendered help-content link
// anywhere on the page. Replicated with a mount-only `useEffect` (its
// exact ordering relative to first paint doesn't matter here, since a
// user can't click a link before the page has painted). A `navigateRef`
// keeps the assigned handler reading the *current* navigate function,
// same as the original's `this.props.history` always doing so via
// `this` (Phase 9, react-router v6 migration: `withRouter`'s injected
// `history` prop no longer exists - `useNavigate()` replaces it).
import * as React from "react";
import {zipObject} from "lodash-es";
import counterpart from "counterpart";
import utils from "common/utils";
import {useNavigate} from "react-router-dom";

const req = (require as any).context("../../help", true, /\.md/);
const HelpData: {[locale: string]: {[key: string]: any}} = {};

function endsWith(str: string, suffix: string) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}

function split_into_sections(str: string): any {
    const sections: any[] = str.split(/\[#\s?(.+?)\s?\]/);
    if (sections.length === 1) return sections[0];
    if (sections[0].length < 4) sections.splice(0, 1);

    for (let i = sections.length - 1; i >= 1; i -= 2) {
        // remove extra </p> and <p>
        sections[i] = sections[i].replace(/(^<\/p>|<p>$)/g, "");
        sections[i - 1] = [sections[i - 1], sections[i]];
        sections.splice(i, 1);
    }

    return zipObject(sections as any);
}

function adjust_links(str: string) {
    return str.replace(/\<a\shref\=\"(.+?)\"/gi, (match, text) => {
        text = utils.sanitize(text);

        if (text.indexOf((__HASH_HISTORY__ ? "#" : "") + "/") === 0)
            return `<a href="${text}" onclick="_onClickLink(event)"`;
        if (text.indexOf("http") === 0)
            return `<a href="${text}" rel="noopener noreferrer" class="external-link" target="_blank"`;
        let page = endsWith(text, ".md")
            ? text.substr(0, text.length - 3)
            : text;
        if (page.startsWith("/borrow")) {
            // pass
        } else if (!page.startsWith("/help")) {
            page = "/help/" + page;
        } else if (page.startsWith("help")) {
            page = "/" + page;
        }
        return `<a href="${
            __HASH_HISTORY__ ? "#" : ""
        }${page}" onclick="_onClickLink(event)"`;
    });
}

function loadHelpData(locale: string) {
    // Only load helpData for the current locale as well as the fallback 'en'
    req.keys()
        .filter((a: string) => {
            return a.indexOf(`/${locale}/`) !== -1 || a.indexOf("/en/") !== -1;
        })
        .forEach(function(filename: string) {
            const res = filename.match(/\/(.+?)\/(.+)\./) as RegExpMatchArray;
            const fileLocale = res[1];
            const key = res[2];
            let help_locale = HelpData[fileLocale];
            if (!help_locale) HelpData[fileLocale] = help_locale = {};
            const content = req(filename).default;
            help_locale[key] = split_into_sections(adjust_links(content));
        });
}

function setVars(props: any, str: string, hideIssuer: any) {
    if (hideIssuer == "true") {
        str = str.replace(/<p>[^<]*{issuer}[^<]*<\/p>/gm, "");
    }

    return str.replace(/(\{.+?\})/gi, (match, text) => {
        const key = text.substr(1, text.length - 2);
        let value = props[key] !== undefined ? props[key] : text;
        if (value && typeof value === "string") value = utils.sanitize(value);
        if (value.amount && value.asset)
            value = utils.format_asset(value.amount, value.asset, false, false);
        if (value.date) value = utils.format_date(value.date);
        if (value.time) value = utils.format_time(value.time);

        return value;
    });
}

interface HelpContentProps {
    path: string;
    section?: string;
    alt_path?: string;
    locale?: string;
    style?: React.CSSProperties;
    hide_issuer?: any;
    [key: string]: any;
}

function HelpContent(props: HelpContentProps) {
    const {
        path,
        section,
        alt_path,
        locale: localeProp,
        style,
        hide_issuer = "false"
    } = props;
    const locale = localeProp || counterpart.getLocale() || "en";

    const initRef = React.useRef(false);
    if (!initRef.current) {
        initRef.current = true;
        loadHelpData(locale);
    }

    const navigate = useNavigate();
    const navigateRef = React.useRef(navigate);
    navigateRef.current = navigate;

    React.useEffect(() => {
        (window as any)._onClickLink = (e: any) => {
            e.preventDefault();
            const clickedPath = (
                __HASH_HISTORY__ ? e.target.hash : e.target.pathname
            )
                .split("/")
                .filter((p: string) => p && p !== "#");
            if (clickedPath.length === 0) return false;
            const route = "/" + clickedPath.join("/");
            navigateRef.current(route);
            return false;
        };
    }, []);

    let effectiveLocale = locale;
    if (!HelpData[effectiveLocale]) {
        console.error(
            `missing locale '${effectiveLocale}' help files, rolling back to 'en'`
        );
        effectiveLocale = "en";
    }

    let value = HelpData[effectiveLocale][path];

    if (!value && alt_path) {
        console.warn(
            `missing path '${path}' for locale '${effectiveLocale}' help files, rolling back to alt_path '${alt_path}'`
        );
        value = HelpData[effectiveLocale][alt_path];
    }

    if (!value && effectiveLocale !== "en") {
        console.warn(
            `missing path '${path}' for locale '${effectiveLocale}' help files, rolling back to 'en'`
        );
        value = HelpData["en"][path];
    }

    if (!value && alt_path && effectiveLocale != "en") {
        console.warn(
            `missing alt_path '${alt_path}' for locale '${effectiveLocale}' help files, rolling back to 'en'`
        );
        value = HelpData["en"][alt_path];
    }

    if (!value) {
        console.error(
            `help file not found '${path}' for locale '${effectiveLocale}'`
        );
        // Original literally returned `!null` (i.e. `true`) here, not
        // `null` - almost certainly an unintentional `!` typo, but since
        // React renders a boolean the same as `null` (nothing visible),
        // the observable output is identical either way; simplified to
        // `null` to satisfy the type checker without changing behavior.
        return null;
    }

    if (section) {
        /* The previously used remarkable-loader parsed the md properly as an object, the new one does not */
        for (const key in value) {
            if (!!key.match(section)) {
                value = key.replace(new RegExp("^" + section + ","), "");
                break;
            }
        }
    }

    if (!value) {
        console.error(`help section not found ${path}#${section}`);
        return null;
    }

    if (typeof value === "object") {
        console.error(`help section content invalid ${path}#${section}`);
        return null;
    }

    return (
        <div
            style={style}
            className="help-content"
            dangerouslySetInnerHTML={{
                __html: setVars(props, value, hide_issuer)
            }}
        />
    );
}

export default HelpContent;
