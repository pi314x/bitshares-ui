// TypeScript/function-component port of the legacy Showcase.jsx (Phase 8,
// docs/UI_MIGRATION_PLAN.md, `Showcases/` batch 3). Mechanical, no logic
// changes.
//
// Presentational-only leaf: no state, no lifecycle methods, no store
// subscriptions, not security-sensitive (verified by reading the whole
// file - it only renders a clickable tile via `<Icon>`/`<Translate>`, with
// a `Tooltip` wrapper for the disabled/coming-soon variant). Its only
// caller is `Showcases/ShowcaseGrid.jsx` (out of scope for this task, held
// back for the orchestrating session), which passes `target`, `title`,
// `description`, `icon`, and optionally `disabled`/`comingSoon`.
//
// - `static propTypes`/`defaultProps` -> a `ShowcaseProps` interface with
//   `disabled` defaulted to `false` via a default parameter, same as every
//   other converted leaf component in this migration.
// - `disabled` is declared as `PropTypes.bool` in the original, but
//   `render()` also branches on `typeof this.props.disabled == "string"`
//   (using a truthy string as the Tooltip's title instead of the default
//   "Coming soon" text) - a pre-existing quirk, not exercised by
//   `ShowcaseGrid.jsx`'s current call sites (which only ever pass a
//   `bool`), but preserved verbatim rather than "fixed": `disabled` is
//   typed as `boolean | string` to keep that branch alive and type-check.
// - The class's empty `constructor()` (calling only `super()`, no state,
//   no bindings) is dropped - purely mechanical, nothing to replicate.
// - No refs, no imperative API anywhere in this file.
// - TS-forced adjustment: both `tabIndex={"0"}` (a string) in the original
//   become `tabIndex={0}` (a number) - React's `tabIndex` prop type is
//   `number`, and TypeScript's JSX typings reject a string literal there;
//   the rendered `tabindex="0"` DOM attribute is identical either way, so
//   this is not a behavior change.
import * as React from "react";
import Icon from "../Icon/Icon";
import Translate from "react-translate-component";
import {Tooltip} from "bitshares-ui-style-guide";

interface ShowcaseProps {
    target: () => void;
    title: string;
    description: string;
    icon: string;
    disabled?: boolean | string;
    comingSoon?: boolean;
}

export default function Showcase({
    target,
    title,
    description,
    icon,
    disabled = false,
    comingSoon
}: ShowcaseProps) {
    if (!!disabled || !!comingSoon) {
        return (
            <Tooltip
                title={typeof disabled == "string" ? disabled : "Coming soon"}
            >
                <div
                    className="showcases-grid--wrapper--item--wrapper--disabled disabled"
                    onClick={() => {}}
                    tabIndex={0}
                >
                    <h2 className={"no-margin"}>
                        {!!comingSoon && (
                            <Icon
                                style={{float: "right"}}
                                name={"coming_soon"}
                                size={"4x"}
                            />
                        )}
                        <Translate content={title} />
                    </h2>
                    <div
                        className={
                            "showcases-grid--wrapper--item--wrapper--content disabled"
                        }
                    >
                        <Icon name={icon} size={"5x"} />
                        <span
                            className={
                                "padding showcases-grid--wrapper--item--wrapper--content--description disabled"
                            }
                        >
                            <Translate content={description} />
                        </span>
                    </div>
                </div>
            </Tooltip>
        );
    } else {
        return (
            <div
                className="showcases-grid--wrapper--item--wrapper"
                onClick={target}
                tabIndex={0}
            >
                <Translate
                    content={title}
                    className={"no-margin"}
                    component={"h2"}
                />
                <div
                    className={
                        "showcases-grid--wrapper--item--wrapper--content"
                    }
                >
                    <Icon name={icon} size={"5x"} />
                    <span
                        className={
                            "padding showcases-grid--wrapper--item--wrapper--content--description"
                        }
                    >
                        <Translate content={description} />
                    </span>
                </div>
            </div>
        );
    }
}
