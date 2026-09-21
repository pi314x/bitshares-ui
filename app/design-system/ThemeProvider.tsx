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
}

export function ThemeProvider({children}: ThemeProviderProps) {
    const [theme, setThemeState] = React.useState<ThemeName>(readStoredTheme);

    React.useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        try {
            window.localStorage.setItem(THEME_STORAGE_KEY, theme);
        } catch (e) {
            // Ignore: theme still applies for this session, just not persisted.
        }
    }, [theme]);

    const setTheme = React.useCallback((next: ThemeName) => {
        setThemeState(next);
    }, []);

    const toggleTheme = React.useCallback(() => {
        setThemeState(current => (current === "dark" ? "light" : "dark"));
    }, []);

    const value = React.useMemo(
        () => ({theme, setTheme, toggleTheme}),
        [theme, setTheme, toggleTheme]
    );

    return (
        <ThemeContext.Provider value={value}>
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
