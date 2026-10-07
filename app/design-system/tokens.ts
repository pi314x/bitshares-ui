// Design tokens for the new BitShares UI, sourced from the "BitShares Desk"
// reference design (see docs/UI_MIGRATION_PLAN.md, Phase 0/1). Dark is the
// default theme; light is an explicit opt-in, never a `prefers-color-scheme`
// fallback, per the reference design's rationale ("a terminal that flips to
// white because the laptop woke up in daylight mode is not a terminal").
//
// The values here must stay in sync with `theme.scss`, which defines the
// same tokens as CSS custom properties for actual styling. TypeScript can't
// generate SCSS, so this file is the typed reference and `theme.scss` is
// kept aligned with it by hand until the design system has its own build
// step.

export type ThemeName = "dark" | "light";

export interface ThemeTokens {
    ground: string;
    surface: string;
    raised: string;
    line: string;
    lineSoft: string;
    ink: string;
    ink2: string;
    muted: string;
    faint: string;
    accent: string;
    accent2: string;
    accentWash: string;
    up: string;
    down: string;
    upWash: string;
    downWash: string;
    warn: string;
    onAccent: string;
}

export const themes: Record<ThemeName, ThemeTokens> = {
    dark: {
        ground: "#0E1218",
        surface: "#151A22",
        raised: "#1A212B",
        line: "#262E3A",
        lineSoft: "#1F262F",
        ink: "#E7ECF3",
        ink2: "#B6C0CE",
        muted: "#8792A4",
        faint: "#646E7E",
        accent: "#16B8F3",
        accent2: "#4CC5F0",
        accentWash: "#0F2029",
        up: "#46B487",
        down: "#E0666E",
        upWash: "#14271F",
        downWash: "#2A1719",
        warn: "#D9A227",
        onAccent: "#06222C"
    },
    light: {
        ground: "#F4F6F9",
        surface: "#FFFFFF",
        raised: "#FBFCFD",
        line: "#DFE4EC",
        lineSoft: "#EBEFF5",
        ink: "#131820",
        ink2: "#3C4657",
        muted: "#6B7688",
        faint: "#98A2B3",
        accent: "#0079AD",
        accent2: "#04719F",
        accentWash: "#E3F4FC",
        up: "#2E8F65",
        down: "#C24A52",
        upWash: "#E6F2EC",
        downWash: "#F8E9EA",
        warn: "#B07B14",
        onAccent: "#FFFFFF"
    }
};

export const DEFAULT_THEME: ThemeName = "dark";
export const THEME_STORAGE_KEY = "bts-ui-theme";

// The three type families from the reference "BitShares Desk" mockup, all
// open source (SIL Open Font License 1.1): Archivo for headings/display,
// IBM Plex Sans for body text, IBM Plex Mono for numbers/code. Self-hosted
// via @fontsource/* (imported in app/next/NextShell.tsx) rather than the
// Google Fonts CDN the mockup used: the Electron build has no business
// depending on network access to render its own UI font.
export const typography = {
    fontDisplay:
        'Archivo, "IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    fontSans:
        '"IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    fontMono:
        '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
};

export function isThemeName(value: unknown): value is ThemeName {
    return value === "dark" || value === "light";
}
