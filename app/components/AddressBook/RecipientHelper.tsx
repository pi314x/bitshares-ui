// Under the recipient of the Send dialog: the address book at hand. Pick who to pay from the book (the memo that goes
// with them comes along), see who the typed account is when the book knows it (its label and what is noted
// about it), and save a recipient the book does not know yet.
import * as React from "react";
import counterpart from "counterpart";
import {Select} from "../../design-system/Select";
import {
    AddressEntry,
    findEntry,
    useAddressBook,
    validAccountName
} from "../../lib/common/addressBook";
import EntryDialog from "./EntryDialog";
import styles from "./AddressBook.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`address_book.${key}`, params) as string;

export interface RecipientHelperProps {
    /** the recipient as typed */
    toName: string;
    /** the memo as typed */
    memo: string;
    /** the typed account exists on the chain (it is loaded) */
    known: boolean;
    onPick: (entry: AddressEntry) => void;
    onUseMemo: (memo: string) => void;
}

export default function RecipientHelper({
    toName,
    memo,
    known,
    onPick,
    onUseMemo
}: RecipientHelperProps): JSX.Element | null {
    const book = useAddressBook();
    const [saving, setSaving] = React.useState(false);
    const entry = findEntry(toName, book);

    // The memo of an entry comes with it, once for each recipient, when the memo box is empty: a memo that was
    // typed is never replaced.
    const filledFor = React.useRef<string | null>(null);
    React.useEffect(() => {
        if (!entry) {
            filledFor.current = null;
            return;
        }
        if (filledFor.current === entry.name) return;
        filledFor.current = entry.name;
        if (entry.memo && !memo) onUseMemo(entry.memo);
        // (only when the recipient changes)
    }, [entry && entry.name]);

    const typed = toName.trim().toLowerCase();
    const canSave = !entry && known && validAccountName(typed);
    if (!book.length && !canSave) return null;

    return (
        <div className={styles.recipient}>
            {book.length ? (
                <Select
                    showSearch
                    placeholder={t("pick")}
                    value={entry ? entry.id : undefined}
                    onChange={(id: any) => {
                        const picked = book.find(e => e.id === String(id));
                        if (picked) onPick(picked);
                    }}
                >
                    {book.map(e => (
                        <Select.Option key={e.id} value={e.id}>
                            {e.label ? `${e.label} - ${e.name}` : e.name}
                        </Select.Option>
                    ))}
                </Select>
            ) : null}
            {entry && (entry.label || entry.note) ? (
                <div className={styles.recipientInfo}>
                    {entry.label ? <strong>{entry.label}</strong> : null}
                    {entry.label && entry.note ? " - " : null}
                    {entry.note}
                </div>
            ) : null}
            {entry && entry.memo && memo !== entry.memo ? (
                <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => onUseMemo(entry.memo)}
                >
                    {t("use_memo", {memo: entry.memo})}
                </button>
            ) : null}
            {canSave ? (
                <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => setSaving(true)}
                >
                    {t("save_recipient")}
                </button>
            ) : null}
            {saving ? (
                <EntryDialog
                    initial={{name: typed, memo}}
                    onClose={() => setSaving(false)}
                />
            ) : null}
        </div>
    );
}
