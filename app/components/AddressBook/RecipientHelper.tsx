// Under the recipient of the Send dialog: the address book at hand. Pick who to pay from the book (the memo that goes
// with them comes along), see who the typed account is when the book knows it (its label and what is noted
// about it), and save a recipient the book does not know yet. An entry that is for one asset is the one used when
// that asset is the one being sent (a withdrawal of it): the memo follows the asset chosen in the dialog.
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
    /** the symbol of the asset being sent (an entry for that asset is the one that counts) */
    asset?: string;
    /** the typed account exists on the chain (it is loaded) */
    known: boolean;
    onPick: (entry: AddressEntry) => void;
    onUseMemo: (memo: string) => void;
}

export default function RecipientHelper({
    toName,
    memo,
    asset,
    known,
    onPick,
    onUseMemo
}: RecipientHelperProps): JSX.Element | null {
    const book = useAddressBook();
    const [saving, setSaving] = React.useState(false);
    const entry = findEntry(toName, book, asset);

    // The memo of an entry comes with it, once for each entry, when the memo box is empty or still holds the memo
    // an entry put there (the asset was changed): a memo that was typed is never replaced.
    const filledFor = React.useRef<string | null>(null);
    const filledMemo = React.useRef<string | null>(null);
    React.useEffect(() => {
        if (!entry) {
            filledFor.current = null;
            return;
        }
        if (filledFor.current === entry.id) return;
        filledFor.current = entry.id;
        const ours = filledMemo.current !== null && memo === filledMemo.current;
        if ((!memo || ours) && entry.memo !== memo) {
            filledMemo.current = entry.memo;
            onUseMemo(entry.memo);
        }
        // (only when the entry changes)
    }, [entry && entry.id]);

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
                            {(e.label ? `${e.label} - ${e.name}` : e.name) +
                                (e.asset ? ` (${e.asset})` : "")}
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
                    initial={{name: typed, memo, asset: asset || ""}}
                    onClose={() => setSaving(false)}
                />
            ) : null}
        </div>
    );
}
