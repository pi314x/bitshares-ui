import * as React from "react";
import styles from "./Slider.module.scss";

// Twenty-second component of the design system's bitshares-ui-style-guide
// replacement (docs/UI_MIGRATION_PLAN.md), following `InputNumber`'s
// precedent (also built during the call-site migration phase rather
// than in the original twenty). Replaces `bitshares-ui-style-guide`'s
// `Slider` (antd v3).
//
// Grepped every real call site: only one, `Modal/View/BorrowModalView
// .tsx`'s target-collateral-ratio slider - `step`/`min`/`max`/`value`/
// `onChange` only, always controlled (no `defaultValue`/`range`/`marks`/
// `tooltipVisible` anywhere). Renders a native `<input type="range">`,
// matching `InputNumber`'s "native form element, no animation" approach.
export interface SliderProps {
    value: number;
    onChange?: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    disabled?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

export function Slider({
    value,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    disabled,
    className,
    style
}: SliderProps): JSX.Element {
    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (onChange) onChange(Number(e.target.value));
    }

    return (
        <input
            type="range"
            className={[styles.slider, className].filter(Boolean).join(" ")}
            style={style}
            value={value}
            min={min}
            max={max}
            step={step}
            disabled={disabled}
            onChange={handleChange}
        />
    );
}
