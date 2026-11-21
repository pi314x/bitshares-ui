// Under the recipient of the Send dialog: the address book at hand. Pick who to pay from the book (the memo that goes
// with them comes along), see who the typed account is when the book knows it (its label and what is noted
// about it), and save a recipient the book does not know yet. An entry that is for one asset is the one used when
// that asset is the one being sent (a withdrawal of it): the memo follows the asset chosen in the dialog.
//
// An entry that was PICKED (here, or by "Send" on the address book page, which hands its id over as `entryId`) is the
// entry, by its id: two entries can be for one account (an exchange takes a tag for each asset) or carry one label, and
// the account and the asset alone cannot say which of them was meant - the first would always win. The choice is let
// go only when another account is typed: changing the asset of the dialog does not move it (the drop-down keeps the
// entry, and its memo stays; a note says when the entry is for another asset than the one sent). An entry that was
// only FOUND for the typed account, nothing picked, still follows the asset. A recipient can be saved as a new entry
// whether or not the book has the account. The user's own accounts (the wallet's, and the one the extension is
// connected as) are offered after the book: they are the wallet's, so nothing in them is saved.
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
import {useMemosVisible} from "./useMemosVisible";
import {useOwnAccounts} from "./useOwnAccounts";
import styles from "./AddressBook.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`address_book.${key}`, params) as string;

/** Marks the value of an own account's option: an address book entry's id never starts with it. */
const OWN = "own:";

export interface RecipientHelperProps {
    /** the recipient as typed */
    toName: string;
    /** the memo as typed */
    memo: string;
    /** the symbol of the asset being sent (an entry for that asset is the one that counts) */
    asset?: string;
    /** the typed account exists on the chain (it is loaded) */
    known: boolean;
    /** the entry the dialog was opened for (the address book page's "Send"): it is the one chosen to begin with */
    entryId?: string;
    onPick: (entry: AddressEntry) => void;
    onUseMemo: (memo: string) => void;
}

export default function RecipientHelper({
    toName,
    memo,
    asset,
    known,
    entryId,
    onPick,
    onUseMemo
}: RecipientHelperProps): JSX.Element | null {
    const book = useAddressBook();
    const own = useOwnAccounts();
    const memosVisible = useMemosVisible();
    const [saving, setSaving] = React.useState(false);
    const typed = toName.trim().toLowerCase();

    // the entry that was picked, by its id (see the top)
    const [chosenId, setChosenId] = React.useState<string | null>(
        entryId || null
    );
    React.useEffect(() => {
        if (entryId) setChosenId(entryId);
    }, [entryId]);
    const chosen = chosenId ? book.find(e => e.id === chosenId) : undefined;
    // it holds while the recipient is the one it is for (the recipient is empty while the dialog is still setting itself up)
    const holds = !!chosen && (!typed || chosen.name === typed);
    const entry = holds ? chosen : findEntry(toName, book, asset);

    // another account was typed: the choice is let go (the asset moving does not let it go)
    React.useEffect(() => {
        if (chosen && typed && chosen.name !== typed) setChosenId(null);
    }, [typed, chosenId]);

    // The memo of an entry comes with it, once for each entry, when the memo box is empty or still holds the memo
    // an entry put there (the asset was changed): a memo that was typed is never replaced. While the wallet is locked
    // it does not come (the memo box would show it): it comes when the wallet is unlocked.
    const filledFor = React.useRef<string | null>(null);
    const filledMemo = React.useRef<string | null>(null);
    React.useEffect(() => {
        if (!entry) {
            filledFor.current = null;
            return;
        }
        if (!memosVisible) return;
        if (filledFor.current === entry.id) return;
        filledFor.current = entry.id;
        const ours = filledMemo.current !== null && memo === filledMemo.current;
        if ((!memo || ours) && entry.memo !== memo) {
            filledMemo.current = entry.memo;
            onUseMemo(entry.memo);
        }
        // (only when the entry changes, or the memos can be shown)
    }, [entry && entry.id, memosVisible]);

    const mine = own.find(a => a.name === typed);
    // the recipient can be saved as an entry of its own (for the asset that is sent, with the memo as typed), also when the
    // book has the account already: another asset or another memo is another entry
    const canSave = !mine && known && validAccountName(typed);
    // the picked entry is for another asset than the one being sent: its memo may not fit
    const otherAsset =
        !!entry && !!entry.asset && !!asset && entry.asset !== asset;
    if (!book.length && !own.length && !canSave) return null;

    return (
        <div className={styles.recipient}>
            {book.length || own.length ? (
                <Select
                    showSearch
                    placeholder={t("pick")}
                    value={
                        entry
                            ? entry.id
                            : mine
                            ? `${OWN}${mine.name}`
                            : undefined
                    }
                    onChange={(id: any) => {
                        const key = String(id);
                        const picked = book.find(e => e.id === key);
                        if (picked) {
                            setChosenId(picked.id);
                            onPick(picked);
                        }
                        const ours = own.find(a => `${OWN}${a.name}` === key);
                        // (an own account carries no memo and no asset: only who is paid changes)
                        if (ours) {
                            setChosenId(null);
                            onPick({
                                id: key,
                                name: ours.name,
                                label: "",
                                note: "",
                                memo: "",
                                asset: "",
                                at: 0
                            });
                        }
                    }}
                >
                    {book.map(e => (
                        <Select.Option key={e.id} value={e.id}>
                            {(e.label ? `${e.label} - ${e.name}` : e.name) +
                                (e.asset ? ` (${e.asset})` : "")}
                        </Select.Option>
                    ))}
                    {own.map(a => (
                        <Select.Option
                            key={`${OWN}${a.name}`}
                            value={`${OWN}${a.name}`}
                        >
                            {`${a.name} (${t(`mine_${a.source}`)})`}
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
                memosVisible ? (
                    <button
                        type="button"
                        className={styles.linkButton}
                        onClick={() => onUseMemo(entry.memo)}
                    >
                        {t("use_memo", {memo: entry.memo})}
                    </button>
                ) : (
                    <span className={styles.help}>{t("memo_locked")}</span>
                )
            ) : null}
            {otherAsset ? (
                <span className={styles.help}>
                    {t("entry_other_asset", {
                        entry: entry ? entry.asset : "",
                        sent: asset
                    })}
                </span>
            ) : null}
            {canSave ? (
                <button
                    type="button"
                    className={styles.linkButton}
                    onClick={() => setSaving(true)}
                >
                    {t(entry ? "save_as_new" : "save_recipient")}
                </button>
            ) : null}
            {saving ? (
                <EntryDialog
                    initial={{name: typed, memo, asset: asset || ""}}
                    onClose={() => setSaving(false)}
                    // the new entry is the one the drop-down shows from now on
                    onSaved={saved => setChosenId(saved.id)}
                />
            ) : null}
        </div>
    );
}
