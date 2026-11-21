import * as React from "react";
import styles from "./Steps.module.scss";

// Twentieth component of the design system's bitshares-ui-style-guide
// replacement (docs/UI_MIGRATION_PLAN.md), following `Modal`/`Tooltip`/
// `Input`/`Form`/`Select`/`Icon`/`Notification`/`Table`/`Row`/`Col`/
// `Radio`/`Switch`/`Card`/`Popover`/`Checkbox`/`Alert`/`Tabs`/
// `BodyClassName`/`Progress`'s precedent. Replaces
// `bitshares-ui-style-guide`'s `Steps`/`Steps.Step` (antd v3). One real
// call site (`Showcases/Borrow.tsx`): `progressDot` + `current` on
// `Steps`, `title` on each `Steps.Step`. No `status`/`icon`/
// `description` overrides on an individual step anywhere.
//
// `Steps.Step` follows `Select.Option`/`Tabs.TabPane`'s established
// compound-component pattern: never actually rendered, `Steps` reads
// each child's `key`/`title` directly.
export interface StepProps {
    title?: React.ReactNode;
}

const Step: React.FC<StepProps> = () => null;

interface StepEntry {
    key: string;
    title: React.ReactNode;
}

function collectSteps(children: React.ReactNode): StepEntry[] {
    const steps: StepEntry[] = [];
    React.Children.forEach(children, child => {
        if (!React.isValidElement(child) || child.type !== Step) return;
        const props = child.props as StepProps;
        steps.push({key: String(child.key), title: props.title});
    });
    return steps;
}

export interface StepsProps {
    /** 0-based index of the active step. */
    current?: number;
    /** The one real call site always sets this; genuinely toggles
     * between a small dot and a numbered circle per step, rather than
     * being accepted-but-ignored. */
    progressDot?: boolean;
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
}

function StepsBase({
    current = 0,
    progressDot,
    className,
    style,
    children
}: StepsProps): JSX.Element {
    const steps = collectSteps(children);

    return (
        <div
            className={[styles.steps, className].filter(Boolean).join(" ")}
            style={style}
        >
            {steps.map((step, index) => {
                const status =
                    index < current
                        ? "finish"
                        : index === current
                        ? "process"
                        : "wait";
                return (
                    <div
                        key={step.key}
                        className={[styles.step, styles[status]].join(" ")}
                    >
                        <div className={styles.row}>
                            <span className={styles.iconWrap}>
                                {progressDot ? (
                                    <span className={styles.dot} />
                                ) : (
                                    <span className={styles.number}>
                                        {index + 1}
                                    </span>
                                )}
                            </span>
                            {index < steps.length - 1 ? (
                                <span className={styles.line} />
                            ) : null}
                        </div>
                        <div className={styles.title}>{step.title}</div>
                    </div>
                );
            })}
        </div>
    );
}

export const Steps = Object.assign(StepsBase, {Step});
