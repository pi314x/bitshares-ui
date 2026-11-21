// /address-book: the accounts the user pays - who they are, what to know about them, the memo to send. A card for
// each (a phone is the first screen) with its account, memo and asset in that order, a search over all of it, "Send" that opens the Send page with the
// recipient (and its asset) in, and the book as a file (export, import). An entry for an asset also shows what
// the account holds of that asset. Above the book stand the user's own accounts - those of the wallet, and the one
// the wallet extension is connected as - so the book is linked to the wallet: to pay one's other account is one press.
// They are not entries (they are not kept in the book, nor in its file): they are the wallet's.
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
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectAccountState} from "../../store/slices/accountSlice";
import EntryDialog from "./EntryDialog";
import HeldBalance from "./HeldBalance";
import {useMemosVisible} from "./useMemosVisible";
import {useOwnAccounts} from "./useOwnAccounts";
import styles from "./AddressBook.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`address_book.${key}`, params) as string;

const TypedLink = Link as React.ComponentType<any>;

/**
 * Whether an entry matches what was typed in the search (any part of what it says). The memo is part of it only while the
 * memos are shown: a search must not tell a locked screen what a memo says.
 */
export function matches(
    entry: AddressEntry,
    query: string,
    memosVisible = true
): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [
        entry.name,
        entry.asset,
        entry.label,
        entry.note,
        memosVisible ? entry.memo : ""
    ].some(text => text.toLowerCase().includes(q));
}

export default function AddressBookPage(): JSX.Element {
    const book = useAddressBook();
    const own = useOwnAccounts();
    const memosVisible = useMemosVisible();
    const current = useReduxState<{currentAccount: string | null}>(
        selectAccountState
    ).currentAccount;
    const navigate = useNavigate();
    const [query, setQuery] = React.useState("");
    const [editing, setEditing] = React.useState<AddressEntry | "new" | null>(
        null
    );
    // the entry whose "Delete" was pressed once: the second press deletes
    const [asked, setAsked] = React.useState<string | null>(null);
    const fileInput = React.useRef<HTMLInputElement>(null);

    const shown = book.filter(entry => matches(entry, query, memosVisible));
    const q = query.trim().toLowerCase();
    const ownShown = own.filter(
        a =>
            !q ||
            a.name.includes(q) ||
            t(`mine_${a.source}`)
                .toLowerCase()
                .includes(q)
    );

    // the Send page opens with the recipient, the entry that was pressed (two entries can be for one account: it is the
    // pressed one whose memo comes along) and, for an entry that is for one asset, that asset
    const send = (entry: AddressEntry) =>
        navigate("/send", {
            state: entry.asset
                ? {toName: entry.name, asset: entry.asset, entryId: entry.id}
                : {toName: entry.name, entryId: entry.id}
        });

    const exportBook = () => {
        // the file has the memos
        if (!memosVisible) return;
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
                <Button
                    onClick={exportBook}
                    disabled={!book.length || !memosVisible}
                    title={memosVisible ? undefined : t("export_locked")}
                >
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

            {ownShown.length ? (
                <>
                    <h2 className={styles.section}>{t("mine")}</h2>
                    <ul className={styles.list} data-testid="own-accounts">
                        {ownShown.map(a => (
                            <li
                                key={a.name}
                                className={styles.card}
                                data-own={a.source}
                            >
                                <div className={styles.head}>
                                    <span className={styles.who}>{a.name}</span>
                                    <span className={styles.badge}>
                                        {t(`mine_${a.source}`)}
                                    </span>
                                </div>
                                {a.name !== current ? (
                                    <div className={styles.actions}>
                                        <Button
                                            variant="accent"
                                            onClick={() =>
                                                navigate("/send", {
                                                    state: {toName: a.name}
                                                })
                                            }
                                        >
                                            {t("send")}
                                        </Button>
                                    </div>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                    <h2 className={styles.section}>{t("contacts")}</h2>
                </>
            ) : null}

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
                                    {memosVisible ? (
                                        <code>{entry.memo}</code>
                                    ) : (
                                        <>
                                            {/* a fixed mask: not the memo's length */}
                                            <code>••••••</code>{" "}
                                            <span className={styles.help}>
                                                {t("memo_locked")}
                                            </span>
                                        </>
                                    )}
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
