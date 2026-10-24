// Design tokens for the new BitShares UI, sourced from the "BitShares Desk"
// reference design (see docs/UI_MIGRATION_PLAN.md, Phase 0/1). Dark is the
// default theme; light is an explicit opt-in, never a `prefers-color-scheme`
// fallback, per the reference design's rationale ("a terminal that flips to
// white because the laptop woke up in daylight mode is not a terminal").
//
// The values here must stay in sync with `_palette.scss`, the single source
// that `theme.scss` turns into CSS custom properties (and the legacy theme
// sheets derive their colours from). TypeScript can't generate SCSS, so this
// file is the typed reference and a Jest test
// (`__tests__/design-system/palette-test.ts`) fails when the two disagree.

export type ThemeName = "dark" | "light";

export interface ThemeTokens {
    ground: string;
    surface: string;
    raised: string;
    hover: string;
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
    // categorical chart colours, in the order they are assigned (validated as a
    // set: lightness band, CVD separation, contrast; `catOther` folds the tail)
    cat1: string;
    cat2: string;
    cat3: string;
    cat4: string;
    cat5: string;
    cat6: string;
    catOther: string;
}

export const themes: Record<ThemeName, ThemeTokens> = {
    dark: {
        ground: "#0B0F14",
        surface: "#11171F",
        raised: "#172029",
        hover: "#1E2935",
        line: "#232D3A",
        lineSoft: "#1A222D",
        ink: "#E9EEF5",
        ink2: "#B8C2D0",
        muted: "#8794A7",
        faint: "#627085",
        accent: "#16B8F3",
        accent2: "#4CC5F0",
        accentWash: "#0C202B",
        up: "#34C38F",
        down: "#EF5F6B",
        upWash: "#0F2A21",
        downWash: "#2D171B",
        warn: "#E0A93B",
        onAccent: "#04202B",
        cat1: "#3987E5",
        cat2: "#D95926",
        cat3: "#199E70",
        cat4: "#C98500",
        cat5: "#D55181",
        cat6: "#008300",
        catOther: "#627085"
    },
    light: {
        ground: "#F3F5F9",
        surface: "#FFFFFF",
        raised: "#F8FAFC",
        hover: "#EDF1F6",
        line: "#DDE3EC",
        lineSoft: "#E9EEF5",
        ink: "#111827",
        ink2: "#374151",
        muted: "#646E82",
        faint: "#98A2B3",
        accent: "#0074A6",
        accent2: "#005F89",
        accentWash: "#E1F3FB",
        up: "#157E53",
        down: "#C73845",
        upWash: "#E3F4EC",
        downWash: "#FBE9EB",
        warn: "#956309",
        onAccent: "#FFFFFF",
        cat1: "#2A78D6",
        cat2: "#EB6834",
        cat3: "#1BAF7A",
        cat4: "#EDA100",
        cat5: "#E87BA4",
        cat6: "#008300",
        catOther: "#98A2B3"
    }
};

export const DEFAULT_THEME: ThemeName = "dark";
export const THEME_STORAGE_KEY = "bts-ui-theme";

// IBM Plex is the only type family (open source, SIL Open Font License
// 1.1): IBM Plex Sans for all text, IBM Plex Mono for numbers/code.
// Self-hosted via @fontsource/* (imported in app/design-system/fonts.ts)
// rather than a CDN: the Electron build has no business depending on
// network access to render its own UI font.
export const typography = {
    fontDisplay:
        '"IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    fontSans:
        '"IBM Plex Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    fontMono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace'
};

export function isThemeName(value: unknown): value is ThemeName {
    return value === "dark" || value === "light";
}
