// A list of operations written as JSON, each with its name: the operations that go into
// the transaction beside the one a dialog builds (between a flash loan's borrow and
// repay, after an assertion). The text is checked as it is typed, with the library that
// will serialize it.
import * as React from "react";
import {Button} from "../../design-system/Button";
import {Select} from "../../design-system/Select";
import {DialogField} from "../Utility/OperationDialog";
import {
    Step,
    operationTemplate,
    parseOperationJson,
    sendableOperations
} from "../../lib/common/opJson";
import {AreaField, errorText, t} from "./fields";
import styles from "./Advanced.module.scss";

export interface OperationStepsProps {
    label: React.ReactNode;
    help?: React.ReactNode;
    steps: Step[];
    onChange: (steps: Step[]) => void;
}

/** The operation names, once: the list is the same for every field. */
let names: Array<[number, string]> | null = null;
const operationNames = () => names || (names = sendableOperations());

export default function OperationSteps({
    label,
    help,
    steps,
    onChange
}: OperationStepsProps) {
    const set = (index: number, change: Partial<Step>) =>
        onChange(steps.map((s, i) => (i === index ? {...s, ...change} : s)));

    return (
        <DialogField label={label} help={help}>
            <div className={styles.stack}>
                {steps.map((step, index) => {
                    const built = step.text.trim()
                        ? parseOperationJson(step.name, step.text)
                        : null;
                    return (
                        <div className={styles.step} key={index}>
                            <div className={styles.row}>
                                <Select
                                    value={step.name}
                                    showSearch
                                    onChange={value =>
                                        set(index, {
                                            name: String(value),
                                            text: operationTemplate(
                                                String(value)
                                            )
                                        })
                                    }
                                >
                                    {operationNames().map(([id, name]) => (
                                        <Select.Option key={id} value={name}>
                                            {`${id} ${name}`}
                                        </Select.Option>
                                    ))}
                                </Select>
                                <Button
                                    size="small"
                                    onClick={() =>
                                        onChange(
                                            steps.filter((_, i) => i !== index)
                                        )
                                    }
                                >
                                    {t("steps.remove")}
                                </Button>
                            </div>
                            <AreaField
                                label={t("steps.fields", {
                                    name: step.name
                                })}
                                value={step.text}
                                rows={6}
                                onChange={text => set(index, {text})}
                                error={
                                    built && !built.ok ? errorText(built) : null
                                }
                            />
                        </div>
                    );
                })}
                <div className={styles.inline}>
                    <Button
                        size="small"
                        onClick={() =>
                            onChange([
                                ...steps,
                                {
                                    name: "transfer",
                                    text: operationTemplate("transfer")
                                }
                            ])
                        }
                    >
                        {t("steps.add")}
                    </Button>
                </div>
            </div>
        </DialogField>
    );
}
