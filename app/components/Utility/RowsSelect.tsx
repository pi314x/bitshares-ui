import * as React from "react";
import counterpart from "counterpart";
import {Select} from "../../design-system/Select";

const DEFAULT_OPTIONS = [10, 25, 50, 100, 200];

export interface RowsSelectProps {
    value: string | number;
    onChange: (value: string) => void;
    options?: number[];
}

// "10 rows / 25 rows / ..." - the page-size select of the explorer's lists.
export default function RowsSelect({
    value,
    onChange,
    options = DEFAULT_OPTIONS
}: RowsSelectProps): JSX.Element {
    return (
        <Select
            style={{width: "132px"}}
            value={String(value)}
            onChange={next => onChange(String(next))}
        >
            {options.map(count => (
                <Select.Option key={count} value={String(count)}>
                    {counterpart.translate("toolbar.rows", {count})}
                </Select.Option>
            ))}
        </Select>
    );
}
