import * as React from "react";
import styles from "./Input.module.scss";

// Third component of the design system's bitshares-ui-style-guide
// replacement (docs/UI_MIGRATION_PLAN.md), following `Modal.tsx`/
// `Tooltip.tsx`'s precedent: grep every real call site's prop usage
// before deciding the API's scope, rather than reimplementing antd v3's
// `Input` in full. Real usage: plain `<input>` props (`value`, `type`,
// `onChange`, `placeholder`, `disabled`, `maxLength`, `autoComplete`,
// etc. - all already covered by extending
// `React.InputHTMLAttributes`), `addonAfter` (an element rendered
// inline after the input, inside the same bordered box - e.g. a search
// icon), `addonBefore` (its mirror, before the input - added during the
// call-site migration phase once 3 real call sites turned up using it,
// missed by this component's original grep), `suffix` (an element
// inside the input's own padding, before its border - rarer, 2 real
// call sites), `onPressEnter` (antd's convenience for "Enter key only"),
// and `Input.Group`/`Input.TextArea` as the two real compound-component
// usages (no `Input.Password`/`Input.Search` anywhere in the app).
export interface InputProps
    extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> {
    addonBefore?: React.ReactNode;
    addonAfter?: React.ReactNode;
    suffix?: React.ReactNode;
    onPressEnter?: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

function handlePressEnter(
    event: React.KeyboardEvent<HTMLInputElement>,
    onKeyDown: InputProps["onKeyDown"],
    onPressEnter: InputProps["onPressEnter"]
) {
    if (onKeyDown) onKeyDown(event);
    if (event.key === "Enter" && onPressEnter) onPressEnter(event);
}

// With an addon or a suffix the control is a wrapper around the field. The
// layout part of `style` (width, margins, flex) belongs to that wrapper - as in
// antd, which this replaces - otherwise `style={{width: 200}}` narrowed the
// field inside a full-width wrapper and left the addon (a search button) at the
// far edge of the row. Everything else (text-align, colour, ...) stays on the
// field.
const WRAPPER_STYLE_KEYS = [
    "width",
    "minWidth",
    "maxWidth",
    "margin",
    "marginTop",
    "marginRight",
    "marginBottom",
    "marginLeft",
    "flex",
    "flexGrow",
    "flexShrink",
    "flexBasis",
    "alignSelf",
    "order"
];

export function splitStyle(
    style: React.CSSProperties | undefined
): {wrapper: React.CSSProperties; field: React.CSSProperties} {
    const wrapper: any = {};
    const field: any = {};
    Object.keys(style || {}).forEach(key => {
        const target = WRAPPER_STYLE_KEYS.includes(key) ? wrapper : field;
        target[key] = (style as any)[key];
    });
    return {wrapper, field};
}

const InputBase = React.forwardRef<HTMLInputElement, InputProps>(function Input(
    {
        addonBefore,
        addonAfter,
        suffix,
        onPressEnter,
        onKeyDown,
        className,
        ...rest
    },
    ref
) {
    const hasWrapper = !!(addonBefore || addonAfter || suffix);
    const {wrapper: wrapperStyle, field: fieldStyle} = hasWrapper
        ? splitStyle((rest as any).style)
        : {wrapper: undefined, field: undefined};
    const inputProps: any = hasWrapper ? {...rest, style: fieldStyle} : rest;
    const input = (
        <input
            ref={ref}
            className={[
                styles.input,
                addonBefore ? styles.hasAddonBefore : "",
                addonAfter ? styles.hasAddonAfter : "",
                className
            ]
                .filter(Boolean)
                .join(" ")}
            onKeyDown={event =>
                handlePressEnter(event, onKeyDown, onPressEnter)
            }
            {...inputProps}
        />
    );

    if (!hasWrapper) return input;

    return (
        <span className={styles.wrap} style={wrapperStyle}>
            {addonBefore ? (
                <span className={styles.addonBefore}>{addonBefore}</span>
            ) : null}
            {suffix ? (
                <span className={styles.withSuffix}>
                    {input}
                    <span className={styles.suffix}>{suffix}</span>
                </span>
            ) : (
                input
            )}
            {addonAfter ? (
                <span className={styles.addonAfter}>{addonAfter}</span>
            ) : null}
        </span>
    );
});

export interface TextAreaProps
    extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    onPressEnter?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(
    function TextArea({onPressEnter, onKeyDown, className, ...rest}, ref) {
        return (
            <textarea
                ref={ref}
                className={[styles.input, styles.textarea, className]
                    .filter(Boolean)
                    .join(" ")}
                onKeyDown={event => {
                    if (onKeyDown) onKeyDown(event);
                    if (event.key === "Enter" && onPressEnter)
                        onPressEnter(event);
                }}
                {...rest}
            />
        );
    }
);

export interface InputGroupProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Removes the gap and rounds only the outer corners between
     * adjacent children, so a run of inputs/addons reads as one box -
     * antd's `compact` option, the only `Input.Group` mode any real
     * call site uses. */
    compact?: boolean;
}

function InputGroup({compact, className, ...rest}: InputGroupProps) {
    return (
        <div
            className={[styles.group, compact ? styles.compact : "", className]
                .filter(Boolean)
                .join(" ")}
            {...rest}
        />
    );
}

export const Input = Object.assign(InputBase, {
    TextArea,
    Group: InputGroup
});
