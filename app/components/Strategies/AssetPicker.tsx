// A drop-down of assets for the strategy form: the ones the account holds and the usual markets' assets, with a search box in which
// any other symbol can be typed and chosen.
import * as React from "react";
import {Select} from "../../design-system/Select";
import {t} from "./text";

export function AssetPicker(props: {
    /** the symbol chosen */
    value: string;
    /** the symbols to choose from */
    options: string[];
    onChange: (symbol: string) => void;
    disabled?: boolean;
}) {
    const [typed, setTyped] = React.useState("");
    const list = React.useMemo(() => {
        const out = Array.from(
            new Set([props.value, ...props.options].filter(Boolean))
        );
        const word = typed.trim().toUpperCase();
        // a symbol that is typed and is not in the list can be chosen too
        if (word && !out.some(o => o.toUpperCase() === word)) {
            out.unshift(word);
        }
        return out;
    }, [props.value, props.options, typed]);
    return (
        <Select
            showSearch
            disabled={props.disabled}
            value={props.value}
            optionLabelProp="value"
            placeholder={t("asset_placeholder")}
            onSearch={setTyped}
            onDropdownVisibleChange={open => {
                if (!open) setTyped("");
            }}
            onChange={value => {
                setTyped("");
                props.onChange(String(value));
            }}
        >
            {list.map(symbol => (
                <Select.Option key={symbol} value={symbol}>
                    {props.options.includes(symbol) || symbol === props.value
                        ? symbol
                        : t("asset_use", {symbol})}
                </Select.Option>
            ))}
        </Select>
    );
}
