// TypeScript/functional-component port of the legacy PeriodSelector.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";
import FloatingDropdown from "./FloatingDropdown";

interface PeriodSelectorProps {
    label?: string; // a translation key for the label
    placeholder?: string;
    onChange?: (value: {amount: any; type: any}) => void;
    tabIndex?: number;
    error?: string;
    scroll_length?: number;
    disabled?: boolean;
    style?: React.CSSProperties;
    inputValue?: any;
    values?: any;
    entries?: any;
    periodType?: any;
}

export default function PeriodSelector({
    label,
    placeholder,
    onChange,
    tabIndex = 0,
    scroll_length,
    disabled = false,
    style,
    inputValue,
    values,
    entries,
    periodType
}: PeriodSelectorProps) {
    const getNumericEventValue = (e: any) => {
        let input: any = null;
        if (
            e.target.value == "" ||
            e.target.value == null ||
            e.target.value < 0
        ) {
            return "";
        } else if (e.target.value === 0) {
            return 0;
        } else if (parseFloat(e.target.value) == e.target.value) {
            input = e.target.value.trim();
        } else {
            input =
                parseFloat(e.target.value.trim().replace(/[^\d.-]/g, "")) || 0;
        }
        return input;
    };

    const onInputChange = (e: any) => {
        if (onChange) {
            onChange({
                amount: getNumericEventValue(e),
                type: periodType
            });
        }
    };

    const onTypeChange = (type: any) => {
        if (onChange) {
            onChange({
                amount: inputValue,
                type: type
            });
        }
    };

    return (
        <div className="amount-selector" style={style}>
            <Translate className="left-label" component="label" content={label} />
            <div className="inline-label input-wrapper">
                <span className="input-addon-before">Each</span>
                <input
                    disabled={disabled}
                    type="number"
                    value={inputValue || ""}
                    placeholder={placeholder}
                    onChange={onInputChange}
                    tabIndex={tabIndex}
                    style={{paddingLeft: "70px"}}
                />

                <div className="form-label select floating-dropdown">
                    <FloatingDropdown
                        entries={entries}
                        values={values}
                        value={periodType && periodType.name}
                        onChange={onTypeChange}
                        scroll_length={scroll_length}
                    />
                </div>
            </div>
        </div>
    );
}
