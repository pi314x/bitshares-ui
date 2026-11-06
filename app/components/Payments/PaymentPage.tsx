// The frame of a payment page (Send, Deposit, Withdraw, Timed transfer): the head, the form as numbered cards in a
// column, and beside them - on a desktop - a summary that stays in view and holds the page's one button. Nothing
// here knows what is paid: the pages put their own cards and their own summary in it.
import * as React from "react";
import {PageHead} from "../../design-system/PageHead";
import {Button} from "../../design-system/Button";
import styles from "./PaymentPage.module.scss";

export interface PaymentPageProps {
    title: React.ReactNode;
    lead?: React.ReactNode;
    /** the cards of the form */
    children: React.ReactNode;
    /** the summary (`SummaryCard`) and anything else for the side */
    aside?: React.ReactNode;
}

export function PaymentPage({
    title,
    lead,
    children,
    aside
}: PaymentPageProps): JSX.Element {
    return (
        <div className={styles.page}>
            <PageHead title={title} lead={lead} />
            <div className={styles.grid}>
                <div className={styles.main}>{children}</div>
                {aside ? <aside className={styles.aside}>{aside}</aside> : null}
            </div>
        </div>
    );
}

export interface PaymentCardProps {
    /** the number of the step, when the cards are steps */
    step?: number;
    title: React.ReactNode;
    /** the step is filled in (its number is filled) */
    done?: boolean;
    children: React.ReactNode;
}

/** One step of the form: a number, a title, and its fields. */
export function PaymentCard({
    step,
    title,
    done,
    children
}: PaymentCardProps): JSX.Element {
    return (
        <section
            className={[styles.card, done ? styles.done : ""]
                .filter(Boolean)
                .join(" ")}
        >
            <div className={styles.cardHead}>
                {step !== undefined ? (
                    <span className={styles.step} aria-hidden="true">
                        {step}
                    </span>
                ) : null}
                <h2 className={styles.cardTitle}>{title}</h2>
            </div>
            <div className={styles.cardBody}>{children}</div>
        </section>
    );
}

export interface FieldProps {
    label: React.ReactNode;
    /** at the end of the label's line: what is left, a balance */
    hint?: React.ReactNode;
    /** what the field is for, under it */
    help?: React.ReactNode;
    error?: React.ReactNode;
    /** what was found, under it (green) */
    ok?: React.ReactNode;
    children: React.ReactNode;
}

/** A labelled field with its help, its error and what was found - one look on every payment page. */
export function Field({
    label,
    hint,
    help,
    error,
    ok,
    children
}: FieldProps): JSX.Element {
    return (
        <div className={styles.field}>
            <div className={styles.label}>
                <span>{label}</span>
                {hint ? <span className={styles.hint}>{hint}</span> : null}
            </div>
            {children}
            {error ? (
                <span className={styles.error} role="alert">
                    {error}
                </span>
            ) : ok ? (
                <span className={styles.ok}>{ok}</span>
            ) : help ? (
                <span className={styles.help}>{help}</span>
            ) : null}
        </div>
    );
}

/** A row of small buttons that fill a field (25 %, 50 %, Max; 1 week, 1 month). */
export function Picks({
    items,
    onPick,
    disabled
}: {
    items: Array<{key: string; label: React.ReactNode}>;
    onPick: (key: string) => void;
    disabled?: boolean;
}): JSX.Element {
    return (
        <div className={styles.picks}>
            {items.map(item => (
                <Button
                    key={item.key}
                    size="small"
                    disabled={disabled}
                    onClick={() => onPick(item.key)}
                >
                    {item.label}
                </Button>
            ))}
        </div>
    );
}

export interface SummaryRowProps {
    label: React.ReactNode;
    /** nothing yet: the row shows a dash */
    value?: React.ReactNode;
    /** a smaller line under the value */
    detail?: React.ReactNode;
    /** the figure of the page (the amount): large, in the mono face */
    big?: boolean;
}

export interface SummaryCardProps {
    title: React.ReactNode;
    rows: SummaryRowProps[];
    /** said when no row has a value yet */
    emptyText?: React.ReactNode;
    /** warnings and notes under the rows (Alerts) */
    notes?: React.ReactNode;
    /** the page's one button, and the others */
    primary: {
        label: React.ReactNode;
        onClick: () => void;
        disabled?: boolean;
    };
    secondary?: {
        label: React.ReactNode;
        onClick: () => void;
        disabled?: boolean;
    };
    /** what is missing, said under a button that cannot be pressed yet */
    blocker?: React.ReactNode;
}

/** What is about to happen, in the words of the form, with the page's one button under it. */
export function SummaryCard({
    title,
    rows,
    emptyText,
    notes,
    primary,
    secondary,
    blocker
}: SummaryCardProps): JSX.Element {
    const anyValue = rows.some(
        row => row.value !== undefined && row.value !== null
    );
    return (
        <section className={styles.card} aria-label={String(title)}>
            <div className={styles.summaryHead}>
                <h2 className={styles.cardTitle}>{title}</h2>
            </div>
            {!anyValue && emptyText ? (
                <p className={styles.empty}>{emptyText}</p>
            ) : (
                <dl className={styles.rows}>
                    {rows.map((row, index) => {
                        const has =
                            row.value !== undefined && row.value !== null;
                        return (
                            <div className={styles.row} key={index}>
                                <dt>{row.label}</dt>
                                <dd
                                    className={[
                                        row.big ? styles.big : "",
                                        has ? "" : styles.empty
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                >
                                    {has ? row.value : "-"}
                                    {row.detail ? (
                                        <small>{row.detail}</small>
                                    ) : null}
                                </dd>
                            </div>
                        );
                    })}
                </dl>
            )}
            {notes ? <div className={styles.notes}>{notes}</div> : null}
            <div className={styles.actions}>
                <Button
                    variant="accent"
                    disabled={primary.disabled}
                    onClick={primary.onClick}
                >
                    {primary.label}
                </Button>
                {blocker && primary.disabled ? (
                    <p className={styles.blocker}>{blocker}</p>
                ) : null}
                {secondary ? (
                    <Button
                        disabled={secondary.disabled}
                        onClick={secondary.onClick}
                    >
                        {secondary.label}
                    </Button>
                ) : null}
            </div>
        </section>
    );
}

/** Short steps that say what the page does ("How it works"). */
export function HowItWorks({
    title,
    steps
}: {
    title: React.ReactNode;
    steps: React.ReactNode[];
}): JSX.Element {
    return (
        <section className={styles.card}>
            <div className={styles.how}>
                <h2 className={styles.cardTitle}>{title}</h2>
                <ol>
                    {steps.map((step, index) => (
                        <li key={index}>{step}</li>
                    ))}
                </ol>
            </div>
        </section>
    );
}

export {styles as paymentStyles};
