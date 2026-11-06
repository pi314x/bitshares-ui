// The restrictions of a custom authority: rows of a field, a function and a value (what
// `lib/common/restrictions.ts` builds), and a JSON field for the restrictions the rows
// cannot say (`logical_or`, `variant_assert`). When the JSON field holds something it is
// the restrictions and the rows are ignored.
import * as React from "react";
import {Button} from "../../design-system/Button";
import {Input} from "../../design-system/Input";
import {Select} from "../../design-system/Select";
import {DialogField} from "../Utility/OperationDialog";
import {
    RestrictionFunction,
    RestrictionRow,
    functionsFor,
    restrictableFields
} from "../../lib/common/restrictions";
import {AreaField, t} from "./fields";
import styles from "./Advanced.module.scss";

export interface RestrictionEditorProps {
    operationName: string;
    rows: RestrictionRow[];
    onRows: (rows: RestrictionRow[]) => void;
    json: string;
    onJson: (text: string) => void;
    jsonError?: string | null;
    rowError?: string | null;
}

export default function RestrictionEditor(props: RestrictionEditorProps) {
    const fields = React.useMemo(
        () => restrictableFields(props.operationName),
        [props.operationName]
    );
    const [showJson, setShowJson] = React.useState(!!props.json.trim());
    const set = (index: number, change: Partial<RestrictionRow>) =>
        props.onRows(
            props.rows.map((r, i) => (i === index ? {...r, ...change} : r))
        );
    const jsonUsed = !!props.json.trim();

    return (
        <DialogField
            label={t("authority.restrictions")}
            help={t("authority.restrictions_help")}
            error={props.rowError}
        >
            <div className={styles.stack}>
                {props.rows.map((row, index) => {
                    const field =
                        fields.find(f => f.path === row.path) || fields[0];
                    const functions = field ? functionsFor(field) : [];
                    return (
                        <div className={styles.rowThree} key={index}>
                            <Select
                                value={row.path}
                                disabled={jsonUsed}
                                onChange={value => {
                                    const next = fields.find(
                                        f => f.path === value
                                    );
                                    set(index, {
                                        path: String(value),
                                        fn:
                                            next &&
                                            !functionsFor(next).includes(row.fn)
                                                ? "eq"
                                                : row.fn
                                    });
                                }}
                            >
                                {fields.map(f => (
                                    <Select.Option key={f.path} value={f.path}>
                                        {f.path}
                                    </Select.Option>
                                ))}
                            </Select>
                            <Select
                                value={row.fn}
                                disabled={jsonUsed}
                                onChange={value =>
                                    set(index, {
                                        fn: value as RestrictionFunction
                                    })
                                }
                            >
                                {functions.map(fn => (
                                    <Select.Option key={fn} value={fn}>
                                        {t(`authority.fn_${fn}`)}
                                    </Select.Option>
                                ))}
                            </Select>
                            <Input
                                value={row.value}
                                disabled={jsonUsed}
                                autoCapitalize="none"
                                spellCheck={false}
                                aria-label={t("authority.value")}
                                placeholder={
                                    row.fn === "in" || row.fn === "not_in"
                                        ? t("authority.value_list")
                                        : t("authority.value")
                                }
                                onChange={e =>
                                    set(index, {value: e.target.value})
                                }
                            />
                            <Button
                                size="small"
                                disabled={jsonUsed}
                                onClick={() =>
                                    props.onRows(
                                        props.rows.filter((_, i) => i !== index)
                                    )
                                }
                            >
                                {t("steps.remove")}
                            </Button>
                        </div>
                    );
                })}
                <div className={styles.inline}>
                    <Button
                        size="small"
                        disabled={jsonUsed || !fields.length}
                        onClick={() =>
                            props.onRows([
                                ...props.rows,
                                {path: fields[0].path, fn: "eq", value: ""}
                            ])
                        }
                    >
                        {t("authority.add_restriction")}
                    </Button>
                    <Button size="small" onClick={() => setShowJson(!showJson)}>
                        {t("authority.json_toggle")}
                    </Button>
                </div>
                {showJson ? (
                    <AreaField
                        label={t("authority.json")}
                        help={t("authority.json_help")}
                        rows={6}
                        value={props.json}
                        onChange={props.onJson}
                        error={props.jsonError}
                    />
                ) : null}
            </div>
        </DialogField>
    );
}
