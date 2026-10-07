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
// than reimplementing antd's hundreds-strong icon font: 22 distinct
// glyphs are used in total, 3 of them (`question-circle`, `info-circle`,
// `star`) with `theme="filled"` (all three are plain outline elsewhere,
// so only those three got a filled variant drawn - every other glyph
// has outline only, since no real call site asks for a filled version of
// it).
//
// `star`/`user`/`plus-circle`/`file-search` were added in a second pass,
// during the call-site migration phase rather than this component's
// original build: the initial grep covered every `<Icon type=...>`
// call site importing this component directly, but missed these four,
// used via a local `Icon as AntIcon` import alias at their call sites
// (`Account/AccountSelector.tsx`, `Account/CreditOffer/{Create,Edit}Modal.tsx`,
// `Blockchain/{ProposedOperation,Transaction}.tsx`) - a second,
// alias-inclusive grep (`type="[a-z-]*"` near the word "icon", not just
// `<Icon`/`<AntIcon` literally) is what actually surfaced them.
//
// `lock`/`unlock` were added in a third pass, for the same reason: real
// at exactly one call site (`Utility/AmountSelectorStyleGuide.tsx`'s
// amount-field lock toggle, via a dynamic `type={!lockStatus ? "unlock"
// : "lock"}` ternary), missed by both earlier grep passes since this
// file imports `Icon` directly (no alias) but the glyph name is
// computed, not a literal string.
//
// `line-chart` was added in a fourth pass: real at exactly one call
// site (`Explorer/Assets.tsx`'s link to the exchange), a plain literal
// `type={"line-chart"}` with no alias and no dynamic expression - this
// one simply fell outside whatever file set the original grep covered.
//
// `download` was added in a fifth pass, alongside `Button`'s new
// `icon` prop: real at `Transfer/PrintReceiptButton.tsx`'s print
// button (antd's `<Button icon="download">`). Several other real call
// sites pass other icon names to the same antd `Button.icon` prop
// (`message`/`deployment-unit`/`plus-circle-o`/`minus-circle-o`,
// across `Showcases/Barter.tsx`/`Modal/HtlcModal.tsx`/
// `Transfer/InvoiceRequest.tsx`) - left unadded until each of those
// files is itself migrated, rather than speculatively drawing glyphs
// nothing yet needs.
//
// `message` was added in a sixth pass, alongside `Button`'s new
// `size="small"` - both real at the same `Showcases/Barter.tsx` call
// sites (3 icon-only memo-field toggle buttons). `deployment-unit`/
// `plus-circle-o`/`minus-circle-o` (`Modal/HtlcModal.tsx`/
// `Transfer/InvoiceRequest.tsx`) are still left unadded, for the same
// reason as above.
//
// `dollar` was added in a seventh pass: real at the "repay this debt"
// row-action icon in `Account/CreditOffer/CreditDebtList.tsx`/
// `CreditOfferPage.tsx` (both via an `Icon as AntIcon` import alias).
//
// `edit`/`poweroff`/`reload` were added in an eighth pass, for
// `CreditOfferList.tsx`'s row-action icons (edit/enable-disable/
// delete a credit offer) - `edit` is also real at
// `Account/AccountSelector.tsx` (not yet migrated), `poweroff`/
// `reload` only here, the latter via a dynamic `type={row.enabled ?
// "poweroff" : "reload"}` ternary.
//
// `bell` was added in a ninth pass: real at `Exchange/ExchangeHeader
// .tsx`'s price-alert toggle icon.
//
// `tool`/`up`/`down`/`area-chart`/`caret-left`/`caret-right` were added
// in a tenth pass, for `Exchange/Exchange.tsx`'s chart-controls row
// (chart tools toggle, increase/decrease chart height, market-depth/
// price-chart switch, and the left/right panel collapse carets, the
// last two via dynamic `type={activePanels.includes(...) ? "caret-left"
// : "caret-right"}` ternaries).
//
// `deployment-unit` was added in an eleventh pass, for `Modal/
// HtlcModal.tsx`'s "generate a random preimage" button (`Button icon=
// "deployment-unit"`) - the fifth-pass comment above left it unadded
// pending this file's own migration; `plus-circle-o`/`minus-circle-o`
// (`Transfer/InvoiceRequest.tsx`) are still unadded, that file still
// blocked on the managed-form-API rewrite.
//
// `close-circle` was added in a twelfth pass, for `Account/CreditOffer/
// {Create,Edit}Modal.tsx`'s remove-row-item buttons (2 call sites each,
// via the `Icon as AntIcon` alias).
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
    | "bar-chart"
    | "star"
    | "user"
    | "plus-circle"
    | "file-search"
    | "lock"
    | "unlock"
    | "line-chart"
    | "download"
    | "message"
    | "dollar"
    | "edit"
    | "poweroff"
    | "reload"
    | "bell"
    | "tool"
    | "up"
    | "down"
    | "area-chart"
    | "caret-left"
    | "caret-right"
    | "deployment-unit"
    | "close-circle";

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
    "bar-chart": <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
    star: (
        <path d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6z" />
    ),
    user: (
        <>
            <circle cx="12" cy="8" r="4" />
            <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
        </>
    ),
    "plus-circle": (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v8M8 12h8" />
        </>
    ),
    "file-search": (
        <>
            <path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V8l-4-5z" />
            <path d="M14 3v5h4" />
            <circle cx="10.5" cy="14.5" r="2.25" />
            <path d="M12.4 16.4L14 18" />
        </>
    ),
    lock: (
        <>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </>
    ),
    unlock: (
        <>
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 9.9-1" />
        </>
    ),
    "line-chart": <path d="M3 3v18h18M7 14l4-4 3 3 5-6" />,
    download: <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />,
    message: (
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    ),
    dollar: (
        <>
            <path d="M12 2v20" />
            <path d="M17 6.5c0-1.5-2-2.5-5-2.5s-5 1.3-5 3 2 2.5 5 3 5 1.3 5 3-2 3-5 3-5-1-5-2.5" />
        </>
    ),
    edit: (
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.1 2.1 0 0 1 3 3L12 15l-4 1 1-4z" />
    ),
    poweroff: (
        <>
            <path d="M18.4 6.6a9 9 0 1 1-12.77.04" />
            <path d="M12 2v10" />
        </>
    ),
    reload: (
        <path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6" />
    ),
    bell: (
        <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
    ),
    tool: (
        <path d="M14.7 6.3a4 4 0 0 0-5.6 5.6L2 19l3 3 7.1-7.1a4 4 0 0 0 5.6-5.6l-3 3-2-2z" />
    ),
    "deployment-unit": (
        <>
            <rect x="7" y="7" width="10" height="10" rx="1" />
            <path d="M9 7V3M15 7V3M9 21v-4M15 21v-4M7 9H3M7 15H3M21 9h-4M21 15h-4" />
        </>
    ),
    "close-circle": (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M9.5 9.5l5 5m0-5l-5 5" />
        </>
    ),
    up: <path d="M12 19V5M5 12l7-7 7 7" />,
    down: <path d="M12 5v14M5 12l7 7 7-7" />,
    "area-chart": (
        <path d="M4 20V10M10 20V4M16 20v-7M22 20H2M4 10l6-6 6 7 6-6" />
    ),
    "caret-left": <path d="M15 6l-6 6 6 6" fill="currentColor" />,
    "caret-right": <path d="M9 6l6 6-6 6" fill="currentColor" />
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
    ),
    star: (
        <path
            d="M12 3l2.6 5.6 6.1.6-4.6 4.1 1.3 6-5.4-3.2-5.4 3.2 1.3-6-4.6-4.1 6.1-.6z"
            fill="currentColor"
            stroke="none"
        />
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
