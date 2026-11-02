// The form that adds an address book entry, or changes one: the account, who it is, what to know about it, and
// the memo to send with a payment to it. Opened by the address book page and by the Send dialog ("save this
// recipient").
import * as React from "react";
import counterpart from "counterpart";
import {Button} from "../../design-system/Button";
import {Input} from "../../design-system/Input";
import {Modal} from "../../design-system/Modal";
import {
    AddressEntry,
    MAX_LABEL,
    MAX_MEMO,
    MAX_NOTE,
    saveEntry,
    validAccountName
} from "../../lib/common/addressBook";
import styles from "./AddressBook.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`address_book.${key}`, params) as string;

export interface EntryDialogProps {
    /** the entry being changed (none: a new one) */
    entry?: AddressEntry | null;
    /** what a new entry starts with (the recipient of a payment that is being typed) */
    initial?: {name?: string; memo?: string};
    onClose: () => void;
    onSaved?: (entry: AddressEntry) => void;
}

export default function EntryDialog({
    entry,
    initial,
    onClose,
    onSaved
}: EntryDialogProps): JSX.Element {
    const [name, setName] = React.useState(
        entry ? entry.name : (initial && initial.name) || ""
    );
    const [label, setLabel] = React.useState(entry ? entry.label : "");
    const [note, setNote] = React.useState(entry ? entry.note : "");
    const [memo, setMemo] = React.useState(
        entry ? entry.memo : (initial && initial.memo) || ""
    );
    const [error, setError] = React.useState<string | null>(null);

    const typed = name.trim().toLowerCase();
    const nameOk = validAccountName(typed);

    const save = () => {
        if (!nameOk) return setError(t("error_name"));
        const result = saveEntry({
            id: entry ? entry.id : undefined,
            name: typed,
            label,
            note,
            memo
        });
        if (!result.ok) return setError(t(`error_${result.error}`));
        if (onSaved) onSaved(result.entry);
        onClose();
    };

    return (
        <Modal
            visible
            title={t(entry ? "edit_title" : "add_title")}
            onCancel={onClose}
            width={480}
            footer={
                <div className={styles.dialogFoot}>
                    <Button onClick={onClose}>{t("cancel")}</Button>
                    <Button variant="accent" disabled={!nameOk} onClick={save}>
                        {t("save")}
                    </Button>
                </div>
            }
        >
            <div className={styles.form}>
                <label className={styles.field}>
                    <span className={styles.label}>{t("name")}</span>
                    <Input
                        value={name}
                        autoComplete="off"
                        spellCheck={false}
                        aria-label={t("name")}
                        onChange={(e: any) => {
                            setName(e.target.value);
                            setError(null);
                        }}
                    />
                    <span className={styles.help}>{t("name_help")}</span>
                </label>
                <label className={styles.field}>
                    <span className={styles.label}>{t("label")}</span>
                    <Input
                        value={label}
                        maxLength={MAX_LABEL}
                        aria-label={t("label")}
                        onChange={(e: any) => setLabel(e.target.value)}
                    />
                </label>
                <label className={styles.field}>
                    <span className={styles.label}>{t("note")}</span>
                    <Input.TextArea
                        rows={3}
                        value={note}
                        maxLength={MAX_NOTE}
                        aria-label={t("note")}
                        onChange={(e: any) => setNote(e.target.value)}
                    />
                </label>
                <label className={styles.field}>
                    <span className={styles.label}>{t("memo")}</span>
                    <Input
                        value={memo}
                        maxLength={MAX_MEMO}
                        autoComplete="off"
                        aria-label={t("memo")}
                        onChange={(e: any) => setMemo(e.target.value)}
                    />
                    <span className={styles.help}>{t("memo_help")}</span>
                </label>
                {error ? (
                    <p className={styles.error} role="alert">
                        {error}
                    </p>
                ) : null}
            </div>
        </Modal>
    );
}
