import * as React from "react";
import {Select} from "../../design-system/Select";
import AssetLabel from "../Utility/AssetLabel";
import styles from "./PoolAssetSelect.module.scss";

export interface PoolAssetSelectProps {
    /** what the filter is: "Asset", "Paired with", "Share Asset" */
    label: string;
    /** what the first choice says: "Any" */
    anyLabel: string;
    /** the chosen symbol, "" for any */
    value: string;
    /** the symbols to choose from */
    options: string[];
    onChange: (symbol: string) => void;
    /** what is said when what was typed matches nothing */
    notFound?: string;
}

// A filter of the pools' page: a drop-down of the assets that are in a pool, each with its
// logo, searched while typing. The closed field says which filter it is ("Paired with
// BTS"), so three of them in a row need no labels of their own.
export function PoolAssetSelect({
    label,
    anyLabel,
    value,
    options,
    onChange,
    notFound
}: PoolAssetSelectProps): JSX.Element {
    // what is chosen is always among the choices (the list may still be loading)
    const symbols =
        value && options.indexOf(value) === -1
            ? [value].concat(options)
            : options;
    return (
        <Select
            showSearch
            value={value}
            onChange={chosen => onChange(String(chosen))}
            className={styles.select}
            style={{width: "100%"}}
            notFoundContent={notFound}
            filterOption={(input, option) =>
                String(option.value)
                    .toLowerCase()
                    .indexOf(input.trim().toLowerCase()) !== -1
            }
        >
            <Select.Option
                key="__any"
                value=""
                triggerLabel={<span className={styles.label}>{label}</span>}
            >
                <span className={styles.any}>{anyLabel}</span>
            </Select.Option>
            {symbols.map(symbol => (
                <Select.Option
                    key={symbol}
                    value={symbol}
                    triggerLabel={
                        <span className={styles.chosen}>
                            <span className={styles.label}>{label}</span>
                            <AssetLabel symbol={symbol} />
                        </span>
                    }
                >
                    <AssetLabel symbol={symbol} />
                </Select.Option>
            ))}
        </Select>
    );
}
