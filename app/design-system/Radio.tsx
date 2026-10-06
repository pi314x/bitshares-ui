import * as React from "react";
import styles from "./Radio.module.scss";

// Eleventh component of the design system's bitshares-ui-style-guide
// replacement (docs/UI_MIGRATION_PLAN.md), following `Modal`/`Tooltip`/
// `Input`/`Form`/`Select`/`Icon`/`Notification`/`Table`/`Row`/`Col`'s
// precedent. Replaces `bitshares-ui-style-guide`'s `Radio`/`Radio.Group`
// (antd v3).
//
// Grepped every real call site before designing this: every real
// `onChange` handler reads `e.target.value` (and, for the one standalone
// `<Radio>` used outside a `Group` - `Modal/SetDefaultFeeAssetModal.tsx`,
// inside a `Table` column `render` - also `e.target.checked`). No
// `Radio.Button`/`buttonStyle` usage anywhere.
//
// `e.target.value` matters more than it looks: real `value`s are often
// numbers (`value={1}`, `value={0}`) or non-string constants
// (`SCALED_ORDER_ACTION_TYPES.BUY`), and a handler like
// `onPriceChanged(e.target.value)` expects to get that exact original
// value back, not a stringified DOM attribute. A naive native
// `<input type="radio">` can't do this - the DOM coerces `value` to a
// string. Checked against antd's own source rather than assumed: antd's
// `Radio` wraps `rc-checkbox`, which constructs its change event as
// `{target: {...props, checked: e.target.checked}}` (`rc-checkbox`'s
// `Checkbox.js`) - i.e. `target.value` is the original, unstringified
// `value` prop. This port does the same: the native input's `onChange`
// is intercepted and a plain `{target: {value, checked}}` object (not a
// real native-input-shaped event) is what real call sites' handlers
// actually receive.
export interface RadioChangeEvent {
    target: {
        value: any;
        checked: boolean;
    };
}

interface RadioGroupContextValue {
    name: string;
    value: any;
    onChange: (e: RadioChangeEvent) => void;
    disabled?: boolean;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue | null>(
    null
);

let nextGroupId = 0;
function useStableName(): string {
    const ref = React.useRef<string>();
    if (ref.current === undefined) {
        ref.current = `radio-group-${++nextGroupId}`;
    }
    return ref.current;
}

export interface RadioProps {
    value?: any;
    checked?: boolean;
    disabled?: boolean;
    onChange?: (e: RadioChangeEvent) => void;
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
}

function RadioBase({
    value,
    checked,
    disabled,
    onChange,
    className,
    style,
    children
}: RadioProps): JSX.Element {
    const group = React.useContext(RadioGroupContext);
    const isChecked = group ? group.value === value : !!checked;
    const isDisabled = disabled ?? group?.disabled ?? false;

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const event: RadioChangeEvent = {
            target: {value, checked: e.target.checked}
        };
        if (group) {
            group.onChange(event);
        } else if (onChange) {
            onChange(event);
        }
    }

    return (
        <label
            className={[
                styles.radio,
                isDisabled ? styles.disabled : "",
                className
            ]
                .filter(Boolean)
                .join(" ")}
            style={style}
        >
            <input
                type="radio"
                className={styles.input}
                name={group?.name}
                checked={isChecked}
                disabled={isDisabled}
                onChange={handleChange}
            />
            {children !== undefined ? (
                <span className={styles.label}>{children}</span>
            ) : null}
        </label>
    );
}

export interface RadioGroupProps {
    value?: any;
    defaultValue?: any;
    onChange?: (e: RadioChangeEvent) => void;
    disabled?: boolean;
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
}

function RadioGroup({
    value,
    defaultValue,
    onChange,
    disabled,
    className,
    style,
    children
}: RadioGroupProps): JSX.Element {
    const [uncontrolledValue, setUncontrolledValue] = React.useState(
        defaultValue
    );
    const name = useStableName();
    const currentValue = value !== undefined ? value : uncontrolledValue;

    function handleChange(e: RadioChangeEvent) {
        if (value === undefined) setUncontrolledValue(e.target.value);
        if (onChange) onChange(e);
    }

    return (
        <RadioGroupContext.Provider
            value={{name, value: currentValue, onChange: handleChange, disabled}}
        >
            <div
                className={[styles.group, className].filter(Boolean).join(" ")}
                style={style}
            >
                {children}
            </div>
        </RadioGroupContext.Provider>
    );
}

export const Radio = Object.assign(RadioBase, {Group: RadioGroup});
