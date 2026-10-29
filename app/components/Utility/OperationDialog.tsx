// The dialog every "send one operation" screen is: a title, fields (a label above,
// help or the problem under), the node's reason when it fails, and Cancel / Submit
// in the foot. The wallet-unlock prompt and the signing are the action's
// (`WalletDb.process_transaction`); this only runs it and reports the outcome.
import * as React from "react";
import counterpart from "counterpart";
import {Modal} from "../../design-system/Modal";
import {Button} from "../../design-system/Button";
import {Alert} from "../../design-system/Alert";
import {Notification} from "../../design-system/Notification";
import styles from "./OperationDialog.module.scss";

/** The reason a transaction failed, as text (strings, Errors and plain objects arrive). */
export function describeTxError(error: any): string {
    if (!error)
        return counterpart.translate("operation_dialog.failed") as string;
    if (typeof error === "string") return error;
    if (error.message) return String(error.message);
    return counterpart.translate("operation_dialog.failed") as string;
}

export interface OperationDialogProps {
    visible: boolean;
    title: string;
    submitLabel: string;
    canSubmit: boolean;
    submitting: boolean;
    error: string | null;
    onSubmit: () => void;
    onCancel: () => void;
    width?: number;
    children: React.ReactNode;
}

export function OperationDialog({
    visible,
    title,
    submitLabel,
    canSubmit,
    submitting,
    error,
    onSubmit,
    onCancel,
    width = 480,
    children
}: OperationDialogProps) {
    return (
        <Modal
            visible={visible}
            title={title}
            onCancel={onCancel}
            width={width}
            footer={
                <div className={styles.footer}>
                    <Button onClick={onCancel} disabled={submitting}>
                        {counterpart.translate("operation_dialog.cancel")}
                    </Button>
                    <Button
                        variant="accent"
                        onClick={onSubmit}
                        disabled={!canSubmit || submitting}
                        loading={submitting}
                    >
                        {submitLabel}
                    </Button>
                </div>
            }
        >
            <div className={styles.form}>
                {children}
                {error ? <Alert type="error" showIcon message={error} /> : null}
            </div>
        </Modal>
    );
}

export function DialogField(props: {
    label: React.ReactNode;
    help?: React.ReactNode;
    error?: string | null;
    children: React.ReactNode;
}) {
    return (
        <div className={styles.field}>
            <span className={styles.label}>{props.label}</span>
            {props.children}
            {props.error ? (
                <span className={styles.fieldError}>{props.error}</span>
            ) : props.help ? (
                <span className={styles.help}>{props.help}</span>
            ) : null}
        </div>
    );
}

/** A line of plain context under the title ("Selling 10 BTS for 5 USD"). */
export function DialogNote(props: {children: React.ReactNode}) {
    return <p className={styles.note}>{props.children}</p>;
}

/**
 * Runs the action, shows the outcome and tells the caller when it is done. A
 * reopened dialog starts without the previous attempt's error.
 */
export function useOperationSubmit(
    visible: boolean,
    onDone: () => void,
    successMessage: string
) {
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const mounted = React.useRef(true);
    React.useEffect(() => {
        if (visible) setError(null);
    }, [visible]);
    React.useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const run = React.useCallback(
        (action: () => Promise<any>) => {
            setSubmitting(true);
            setError(null);
            action()
                .then(() => {
                    Notification.success({message: successMessage});
                    if (mounted.current) setSubmitting(false);
                    onDone();
                })
                .catch(err => {
                    if (!mounted.current) return;
                    setSubmitting(false);
                    setError(describeTxError(err));
                });
        },
        [onDone, successMessage]
    );

    return {submitting, error, run};
}
