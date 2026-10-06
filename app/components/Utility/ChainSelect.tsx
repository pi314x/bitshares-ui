// TypeScript/functional-component port of the legacy ChainSelect.jsx
// (default-exported as `ChainSelectView`) (Phase 8,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes.
import * as React from "react";
import Translate from "react-translate-component";
import {Select} from "../../design-system/Select";
import counterpart from "counterpart";
import {Map} from "immutable";

interface ChainSelectViewProps {
    chains?: any[];
    placeholder?: string | null;
    style?: React.CSSProperties;
    selectStyle?: React.CSSProperties;
    value?: any;
    onDropdownVisibleChange?: any;
    [key: string]: any;
}

function ChainSelectView({
    chains = ["BitShares Blockchain"],
    selectStyle = {},
    style = {},
    placeholder = null,
    value,
    onDropdownVisibleChange,
    ...remProps
}: ChainSelectViewProps) {
    const disableSelect =
        chains.filter(Map.isMap).length <= 1 && !onDropdownVisibleChange;

    if (!value) {
        value = chains[0];
    }

    // if onDropdownVisibleChange given we assume that lazy loading takes place
    const select = (
        <Select
            onDropdownVisibleChange={onDropdownVisibleChange}
            showArrow={disableSelect ? false : undefined}
            style={selectStyle}
            placeholder={
                <Translate
                    content={placeholder || "utility.asset_select_placeholder"}
                />
            }
            value={value}
            {...remProps}
            filterOption={(input: string, option: any) =>
                option.key.toLowerCase().indexOf(input.toLowerCase()) >= 0
            }
            disabled={disableSelect}
            notFoundContent={counterpart.translate("global.not_found")}
        >
            {chains.filter(Map.isMap).map(chain => {
                return (
                    <Select.Option
                        key={chain as any}
                        value={chain as any}
                    >
                        {chain}
                    </Select.Option>
                );
            })}
        </Select>
    );
    return (
        <div className={"chain-select"} style={style}>
            {select}
        </div>
    );
}

export default ChainSelectView;
