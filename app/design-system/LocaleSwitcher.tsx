import * as React from "react";
import styles from "./LocaleSwitcher.module.scss";
import {useClickOutside} from "../next/hooks/useClickOutside";

// Display names for SettingsStore's defaults.locale codes. Kept local and
// small rather than importing a full i18n library for this - if a locale
// isn't in this map, its raw code is shown instead of a blank label.
const LOCALE_NAMES: {[code: string]: string} = {
    en: "English",
    zh: "中文",
    fr: "Français",
    ko: "한국어",
    de: "Deutsch",
    es: "Español",
    it: "Italiano",
    tr: "Türkçe",
    ru: "Русский",
    ja: "日本語"
};

export interface LocaleSwitcherProps {
    currentLocale: string | null;
    locales: string[];
    onSelect: (locale: string) => void;
}

export function LocaleSwitcher({
    currentLocale,
    locales,
    onSelect
}: LocaleSwitcherProps): JSX.Element {
    const [open, setOpen] = React.useState(false);
    const ref = useClickOutside<HTMLDivElement>(() => setOpen(false), open);

    return (
        <div className={styles.wrap} ref={ref}>
            <button
                type="button"
                className={styles.trigger}
                aria-haspopup="menu"
                aria-expanded={open}
                onClick={() => setOpen(o => !o)}
            >
                {(currentLocale && LOCALE_NAMES[currentLocale]) ||
                    currentLocale ||
                    "Language"}
                <span className={styles.caret} aria-hidden="true">
                    ▾
                </span>
            </button>
            {open ? (
                <div className={styles.menu} role="menu">
                    {locales.map(code => (
                        <button
                            key={code}
                            type="button"
                            role="menuitem"
                            className={`${styles.item} ${
                                code === currentLocale
                                    ? styles.itemActive
                                    : ""
                            }`}
                            onClick={() => {
                                onSelect(code);
                                setOpen(false);
                            }}
                        >
                            {LOCALE_NAMES[code] || code}
                        </button>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
