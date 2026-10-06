import * as React from "react";
import styles from "./Icon.module.scss";

// Sixth component of the design system's bitshares-ui-style-guide
// replacement (docs/UI_MIGRATION_PLAN.md), following `Modal`/`Tooltip`/
// `Input`/`Form`/`Select`'s precedent. NOT to be confused with this
// app's existing, separate `components/Icon/Icon.tsx` (a custom SVG
// sprite loader for BitShares' own icon set, ~50 importers, already
// dependency-free, nothing to replace there) - this component only
// replaces `bitshares-ui-style-guide`'s `Icon`, a thin wrapper around
// antd's built-in icon-font glyph set (`type="search"`,
// `type="question-circle"`, etc. - generic UI icons, not BitShares'
// own). Grepped every real `type=`/`theme=` value in the app rather
// than reimplementing antd's hundreds-strong icon font: exactly 18
// distinct glyphs are ever used, 2 of them (`question-circle`,
// `info-circle`) with `theme="filled"` (both are plain outline
// elsewhere, so only those two got a filled variant drawn - every
// other glyph has outline only, since no real call site asks for a
// filled version of it).
//
// Hand-authored inline SVG paths (24x24 viewBox, 1.5px stroke,
// `currentColor` - no icon-font/icon-library dependency, matching this
// design system's "no extra deps for a solved-by-CSS/SVG problem"
// pattern already set by `Modal`'s portal and `Tooltip`'s positioning)
// rather than vendoring an icon package for 18 glyphs.
export type IconType =
    | "question-circle"
    | "search"
    | "info-circle"
    | "warning"
    | "close"
    | "setting"
    | "plus"
    | "loading"
    | "link"
    | "key"
    | "global"
    | "eye"
    | "exclamation-circle"
    | "delete"
    | "caret-up"
    | "caret-down"
    | "camera"
    | "bar-chart";

export type IconTheme = "outlined" | "filled";

const OUTLINE_PATHS: Record<IconType, React.ReactNode> = {
    "question-circle": (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7" />
            <circle cx="12" cy="17" r="0.1" fill="currentColor" />
        </>
    ),
    search: (
        <>
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
        </>
    ),
    "info-circle": (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v6" />
            <circle cx="12" cy="7.5" r="0.1" fill="currentColor" />
        </>
    ),
    warning: <path d="M12 3L2 21h20L12 3zM12 10v5M12 18h.01" />,
    close: <path d="M5 5l14 14M19 5L5 19" />,
    setting: (
        <>
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    loading: (
        <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
    ),
    link: (
        <path d="M10 14a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11.5 5.5M14 10a5 5 0 0 0-7.07 0L4.1 12.83a5 5 0 0 0 7.07 7.07L12.5 18.5" />
    ),
    key: (
        <>
            <circle cx="7.5" cy="15.5" r="4.5" />
            <path d="M10.6 12.4L20 3M20 3h-4M20 3v4M17 6l2 2" />
        </>
    ),
    global: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z" />
        </>
    ),
    eye: (
        <>
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
            <circle cx="12" cy="12" r="3" />
        </>
    ),
    "exclamation-circle": (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v7M12 17h.01" />
        </>
    ),
    delete: (
        <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0l-1 14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 6h16z" />
    ),
    "caret-up": <path d="M6 15l6-6 6 6" fill="currentColor" />,
    "caret-down": <path d="M6 9l6 6 6-6" fill="currentColor" />,
    camera: (
        <>
            <path d="M4 7h3l2-2h6l2 2h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
            <circle cx="12" cy="13" r="3.5" />
        </>
    ),
    "bar-chart": <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
};

const FILLED_PATHS: Partial<Record<IconType, React.ReactNode>> = {
    "question-circle": (
        <>
            <circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" />
            <path
                d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7"
                stroke="var(--surface)"
            />
            <circle cx="12" cy="17" r="0.1" fill="var(--surface)" />
        </>
    ),
    "info-circle": (
        <>
            <circle cx="12" cy="12" r="9" fill="currentColor" stroke="none" />
            <path d="M12 11v6" stroke="var(--surface)" />
            <circle cx="12" cy="7.5" r="0.1" fill="var(--surface)" />
        </>
    )
};

export interface IconProps extends React.SVGAttributes<SVGSVGElement> {
    type: IconType;
    theme?: IconTheme;
}

export function Icon({
    type,
    theme = "outlined",
    className,
    ...rest
}: IconProps): JSX.Element {
    const body =
        (theme === "filled" && FILLED_PATHS[type]) || OUTLINE_PATHS[type];
    const spinning = type === "loading";

    return (
        <svg
            viewBox="0 0 24 24"
            width="1em"
            height="1em"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            className={[styles.icon, spinning ? styles.spin : "", className]
                .filter(Boolean)
                .join(" ")}
            aria-hidden="true"
            {...rest}
        >
            {body}
        </svg>
    );
}
