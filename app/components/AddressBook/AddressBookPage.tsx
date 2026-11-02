// /address-book: the accounts the user pays - who they are, what to know about them, the memo to send. A card for
// each (a phone is the first screen) with its account, memo and asset in that order, a search over all of it, "Send" that opens the Send page with the
// recipient (and its asset) in, and the book as a file (export, import). An entry for an asset also shows what
// the account holds of that asset.
import * as React from "react";
import {Link, useNavigate} from "react-router-dom";
import counterpart from "counterpart";
import {Button} from "../../design-system/Button";
import {Input} from "../../design-system/Input";
import {Notification} from "../../design-system/Notification";
import {PageHead} from "../../design-system/PageHead";
import {
    AddressEntry,
    exportAddressBook,
    importAddressBook,
    removeEntry,
    useAddressBook
} from "../../lib/common/addressBook";
import {saveAs} from "file-saver";
import EntryDialog from "./EntryDialog";
import HeldBalance from "./HeldBalance";
import styles from "./AddressBook.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`address_book.${key}`, params) as string;

const TypedLink = Link as React.ComponentType<any>;

/** Whether an entry matches what was typed in the search (any part of what it says). */
export function matches(entry: AddressEntry, query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [
        entry.name,
        entry.asset,
        entry.label,
        entry.note,
        entry.memo
    ].some(text => text.toLowerCase().includes(q));
}

export default function AddressBookPage(): JSX.Element {
    const book = useAddressBook();
    const navigate = useNavigate();
    const [query, setQuery] = React.useState("");
    const [editing, setEditing] = React.useState<AddressEntry | "new" | null>(
        null
    );
    // the entry whose "Delete" was pressed once: the second press deletes
    const [asked, setAsked] = React.useState<string | null>(null);
    const fileInput = React.useRef<HTMLInputElement>(null);

    const shown = book.filter(entry => matches(entry, query));

    // the Send page opens with the recipient and, for an entry that is for one asset, that asset
    const send = (entry: AddressEntry) =>
        navigate("/send", {
            state: entry.asset
                ? {toName: entry.name, asset: entry.asset}
                : {toName: entry.name}
        });

    const exportBook = () => {
        saveAs(
            new Blob([exportAddressBook()], {type: "application/json"}),
            "address-book.json"
        );
    };

    const importFile = (file: File | undefined) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            const result = importAddressBook(String(reader.result || ""));
            if (!result) {
                Notification.error({message: t("import_bad"), duration: 5});
            } else {
                Notification.success({
                    message: t("import_done", {
                        added: result.added,
                        skipped: result.skipped
                    }),
                    duration: 5
                });
            }
        };
        reader.readAsText(file);
        // the same file can be chosen again
        if (fileInput.current) fileInput.current.value = "";
    };

    return (
        <div className={styles.page}>
            <PageHead
                title={t("title")}
                lead={t("lead")}
                action={
                    <Button variant="accent" onClick={() => setEditing("new")}>
                        {t("add")}
                    </Button>
                }
            />

            <div className={styles.tools}>
                <Input
                    value={query}
                    placeholder={t("search")}
                    aria-label={t("search")}
                    onChange={(e: any) => setQuery(e.target.value)}
                />
                <Button onClick={exportBook} disabled={!book.length}>
                    {t("export")}
                </Button>
                <Button onClick={() => fileInput.current?.click()}>
                    {t("import")}
                </Button>
                <input
                    ref={fileInput}
                    type="file"
                    accept="application/json,.json"
                    className={styles.hidden}
                    aria-label={t("import")}
                    onChange={e => importFile(e.target.files?.[0])}
                />
            </div>

            {!book.length ? (
                <p className={styles.empty}>{t("empty")}</p>
            ) : !shown.length ? (
                <p className={styles.empty}>{t("none_found")}</p>
            ) : (
                <ul className={styles.list}>
                    {shown.map(entry => (
                        <li key={entry.id} className={styles.card}>
                            <div className={styles.head}>
                                <span className={styles.who}>
                                    {entry.label || entry.name}
                                </span>
                                <TypedLink
                                    className={styles.account}
                                    to={`/account/${entry.name}`}
                                >
                                    {entry.name}
                                </TypedLink>
                            </div>
                            {entry.memo ? (
                                <p className={styles.memo}>
                                    <span className={styles.memoLabel}>
                                        {t("memo")}
                                    </span>{" "}
                                    <code>{entry.memo}</code>
                                </p>
                            ) : null}
                            {entry.asset ? (
                                <p className={styles.memo}>
                                    <span className={styles.memoLabel}>
                                        {t("asset")}
                                    </span>{" "}
                                    <code>{entry.asset}</code>
                                </p>
                            ) : null}
                            {/* an entry for an asset: what the account holds of it, to withdraw */}
                            {entry.asset ? (
                                <HeldBalance symbol={entry.asset} />
                            ) : null}
                            {entry.note ? (
                                <p className={styles.note}>{entry.note}</p>
                            ) : null}
                            <div className={styles.actions}>
                                <Button
                                    variant="accent"
                                    onClick={() => send(entry)}
                                >
                                    {t("send")}
                                </Button>
                                <Button onClick={() => setEditing(entry)}>
                                    {t("edit")}
                                </Button>
                                {asked === entry.id ? (
                                    <Button
                                        onClick={() => {
                                            removeEntry(entry.id);
                                            setAsked(null);
                                        }}
                                    >
                                        {t("delete_sure")}
                                    </Button>
                                ) : (
                                    <Button onClick={() => setAsked(entry.id)}>
                                        {t("delete")}
                                    </Button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {editing ? (
                <EntryDialog
                    entry={editing === "new" ? null : editing}
                    onClose={() => setEditing(null)}
                />
            ) : null}
        </div>
    );
}
