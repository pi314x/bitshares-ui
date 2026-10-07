import * as React from "react";
import styles from "./Form.module.scss";

// Fourth component of the design system's bitshares-ui-style-guide
// replacement (docs/UI_MIGRATION_PLAN.md), following `Modal`/`Tooltip`/
// `Input`'s precedent. Scoped from real usage, not antd v3's full `Form`
// surface: only 2 of ~35 files using `<Form>`/`Form.Item` anywhere
// (`Transfer/InvoiceRequest.tsx`, `Exchange/ScaledOrderTab.tsx`) use
// antd's managed-form API (`Form.create()`/`getFieldDecorator` -
// HOC-injected field state/validation wiring); every other call site
// uses `Form`/`Form.Item` purely as a *layout* primitive (label +
// content + help/error text), with the actual `value`/`onChange`
// wired directly to each field by the caller, same as this app already
// does everywhere else. Built for that - the overwhelmingly common
// case - not the managed-form API; a call site still relying on
// `Form.create()`/`getFieldDecorator` needs its own state management
// rewritten as part of its migration to this component, same as any
// other legacy pattern this whole project has been retiring.
//
// Scope boundary, documented rather than silently missing: antd's
// `Form.Item` also colors the *wrapped input's own border* based on
// `validateStatus` (via `cloneElement`-injected props, reaching into
// whatever `children` happens to be). This component only colors its
// own help text - it doesn't reach into arbitrary children. A call
// site that needs the input's border colored too should pass its own
// `className`/`style` to its `Input` directly (both already supported
// generically there), derived from the same `validateStatus` value.
export type FormLayout = "vertical" | "horizontal";

const FormLayoutContext = React.createContext<FormLayout>("vertical");

export interface FormProps
    extends Omit<React.FormHTMLAttributes<HTMLFormElement>, "onSubmit"> {
    layout?: FormLayout;
    onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
}

function FormBase({
    layout = "vertical",
    className,
    children,
    ...rest
}: FormProps) {
    return (
        <FormLayoutContext.Provider value={layout}>
            <form
                className={[styles.form, className].filter(Boolean).join(" ")}
                {...rest}
            >
                {children}
            </form>
        </FormLayoutContext.Provider>
    );
}

export interface ColSpan {
    /** Out of 24, matching antd's grid - the only unit any real call
     * site's `labelCol`/`wrapperCol` ever used. */
    span: number;
}

export type ValidateStatus =
    | "success"
    | "warning"
    | "error"
    | "validating"
    | "";

export interface FormItemProps {
    label?: React.ReactNode;
    help?: React.ReactNode;
    validateStatus?: ValidateStatus;
    /** Shows ":" after the label. Default true, matching antd. */
    colon?: boolean;
    /** Only meaningful under `<Form layout="horizontal">`. */
    labelCol?: ColSpan;
    wrapperCol?: ColSpan;
    className?: string;
    style?: React.CSSProperties;
    children?: React.ReactNode;
}

function FormItem({
    label,
    help,
    validateStatus = "",
    colon = true,
    labelCol,
    wrapperCol,
    className,
    style,
    children
}: FormItemProps) {
    const layout = React.useContext(FormLayoutContext);
    const horizontal = layout === "horizontal";

    const itemClasses = [
        styles.item,
        horizontal ? styles.horizontal : "",
        validateStatus ? styles[validateStatus] : "",
        className
    ]
        .filter(Boolean)
        .join(" ");

    const labelNode =
        label !== undefined ? (
            <label
                className={styles.label}
                style={
                    horizontal && labelCol
                        ? {flex: `0 0 ${(labelCol.span / 24) * 100}%`}
                        : undefined
                }
            >
                {label}
                {colon ? ":" : ""}
            </label>
        ) : null;

    return (
        <div className={itemClasses} style={style}>
            {labelNode}
            <div
                className={styles.control}
                style={
                    horizontal && wrapperCol
                        ? {flex: `0 0 ${(wrapperCol.span / 24) * 100}%`}
                        : undefined
                }
            >
                {children}
                {help !== undefined ? (
                    <div className={styles.help}>{help}</div>
                ) : null}
            </div>
        </div>
    );
}

export const Form = Object.assign(FormBase, {Item: FormItem});
