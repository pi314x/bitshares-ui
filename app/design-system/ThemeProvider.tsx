import * as React from "react";
import {DEFAULT_THEME, isThemeName, THEME_STORAGE_KEY, ThemeName} from "./tokens";

interface ThemeContextValue {
    theme: ThemeName;
    setTheme: (theme: ThemeName) => void;
    toggleTheme: () => void;
}

const ThemeContext = React.createContext<ThemeContextValue | null>(null);

function readStoredTheme(): ThemeName {
    try {
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
        return isThemeName(stored) ? stored : DEFAULT_THEME;
    } catch (e) {
        // Private window / storage blocked: fall back to the default theme.
        return DEFAULT_THEME;
    }
}

interface ThemeProviderProps {
    children: React.ReactNode;
    /**
     * Controlled mode: pass both `value` and `onChange` to have some outer
     * source of truth drive the theme (e.g. `NextShellContainer` mapping it
     * onto the legacy SettingsStore's `themes` setting) instead of this
     * component's own local/localStorage state. Omit both for the
     * uncontrolled default, used by the standalone preview harness, which
     * has no such outer store to defer to.
     */
    value?: ThemeName;
    onChange?: (theme: ThemeName) => void;
}

export function ThemeProvider({children, value, onChange}: ThemeProviderProps) {
    const isControlled = value !== undefined;
    const [uncontrolledTheme, setUncontrolledTheme] = React.useState<ThemeName>(
        readStoredTheme
    );
    const theme = isControlled ? (value as ThemeName) : uncontrolledTheme;

    React.useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        if (!isControlled) {
            try {
                window.localStorage.setItem(THEME_STORAGE_KEY, theme);
            } catch (e) {
                // Ignore: theme still applies for this session, just not persisted.
            }
        }
    }, [theme, isControlled]);

    const setTheme = React.useCallback(
        (next: ThemeName) => {
            if (isControlled) {
                if (onChange) onChange(next);
            } else {
                setUncontrolledTheme(next);
            }
        },
        [isControlled, onChange]
    );

    const toggleTheme = React.useCallback(() => {
        setTheme(theme === "dark" ? "light" : "dark");
    }, [theme, setTheme]);

    const contextValue = React.useMemo(
        () => ({theme, setTheme, toggleTheme}),
        [theme, setTheme, toggleTheme]
    );

    return (
        <ThemeContext.Provider value={contextValue}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme(): ThemeContextValue {
    const ctx = React.useContext(ThemeContext);
    if (!ctx) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return ctx;
}
