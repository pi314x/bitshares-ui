// TypeScript/function-component port of the legacy Icon.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical translation, no logic changes.
//
// This is a widely-used shared leaf component: grepped app-wide for every
// importer of "Icon/Icon" (any extensionless relative/absolute spelling -
// "../Icon/Icon", "./Icon/Icon", "components/Icon/Icon", etc.) - ~50
// files, and a further grep of every `<Icon ... />` usage inside exactly
// those files (not the unrelated `Icon` re-exported by
// `bitshares-ui-style-guide`/antd, which several other files import under
// the same local name) turned up nothing unusual: no `ref=` anywhere, and
// no caller ever actually sets `inverse` despite it being declared in the
// original's `propTypes`. The props interface below is therefore kept at
// least as permissive as the original's loose `propTypes` (every field
// optional, a permissive `size` union that still accepts any string, and
// an index signature for anything unforeseen) specifically so none of
// those ~50 existing call sites need any change - they already import
// this component via an extensionless path and just use it normally.
//
// - `shouldComponentUpdate` (compares `className`/`name`/`title`/`size`)
//   is a pure render-gate with no `componentDidUpdate` in this file to
//   replicate - dropped entirely per this migration's established
//   treatment of pure perf guards (a function component re-renders
//   whenever its parent does regardless; this never changed the
//   rendered *output*, only render frequency).
// - `defaultProps = {title: null}` is dropped: the only place `title` is
//   read is `if (this.props.title != null)`, a loose (`!=`) inequality
//   that already treats `undefined` and `null` identically, so an
//   absent `title` defaulting to `null` vs. staying `undefined` is not
//   an observable difference.
// - `PropTypes` runtime validation is dropped in favor of the `IconProps`
//   interface below (this migration's established class-`propTypes` ->
//   TS-interface treatment) - it was only ever a dev-time console
//   warning, never a behavioral role.
// - TS-forced adjustment: real callers (grepped) pass `null` for
//   `onClick` (e.g. `AccountPortfolioList.tsx`'s `onClick={isMyAccount ?
//   modalAction : null}`) and `string | null` for `className` (e.g.
//   `AccessSettings.tsx`'s `className={ping.color}`), so both are typed
//   to accept `null` on `IconProps`. The DOM `<span>`'s own `onClick`
//   JSX attribute type only accepts `undefined`, not `null`, so
//   `props.onClick || undefined` converts at that one boundary - no
//   behavioral difference (React treats a `null`/`undefined` handler
//   identically: no listener attached).
// - `counterpart` keeps using its existing aliased import (see
//   AGENTS.md's i18n section) - this call site needed no change.
import * as React from "react";
import counterpart from "counterpart";
import iconsMap from "../../assets/icons/icons-loader.js";

import "./icon.scss";

export interface IconProps {
    name: string;
    title?: string | null;
    size?: "1x" | "1_5x" | "2x" | "3x" | "4x" | "5x" | "10x" | string;
    inverse?: boolean;
    // `string | null` (not just `string`) because real callers (e.g.
    // `AccessSettings.tsx`) pass a `string | null` derived value through.
    className?: string | null;
    style?: React.CSSProperties;
    // `| null` because real callers (e.g. `AccountPortfolioList.tsx`)
    // conditionally pass `null` instead of omitting the prop.
    onClick?: ((event: React.MouseEvent) => void) | null;
    // Permissive on purpose - see header comment: keeps this at least as
    // loose as the original's `propTypes` for any caller passing
    // something not listed above.
    [key: string]: any;
}

export default function Icon(props: IconProps) {
    let classes = "icon ";
    if (props.name !== "warning") {
        // fixme remove warning, otherwise color is being overwritten. should be handled by adjusting the CSS instead
        classes = classes + props.name;
    }
    if (props.size) {
        classes += " icon-" + props.size;
    }
    if (props.className) {
        classes += " " + props.className;
    }
    if (props.title != null) {
        let title: any = props.title;
        if (typeof title === "string" && title.indexOf(".") > 0) {
            title = counterpart.translate(title);
        }
        return (
            <span
                title={title}
                className={classes}
                style={props.style || {}}
                dangerouslySetInnerHTML={{
                    __html: (iconsMap as any)[props.name]
                }}
                onClick={props.onClick || undefined}
            />
        );
    } else {
        return (
            <span
                className={classes}
                style={props.style || {}}
                dangerouslySetInnerHTML={{
                    __html: (iconsMap as any)[props.name]
                }}
                onClick={props.onClick || undefined}
            />
        );
    }
}
