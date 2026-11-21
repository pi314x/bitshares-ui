// On a payment the account sent (the recent activity: a withdrawal to an exchange or a gateway is one): a button that
// saves who it went to in the address book, for the asset that was paid (a withdrawal of it), with the memo that went
// along (a deposit tag, an address) when it can be read - it is encrypted, so a locked wallet is asked to unlock
// first, and if that is cancelled the form simply opens without it. Where the book has the account for that asset
// already, it says so instead - and when the payment's memo is readable (the wallet is open, nobody is asked) and is not
// the saved memo, it says that too, with a button that saves the memo of the payment.
import * as React from "react";
import counterpart from "counterpart";
import {ChainStore} from "bitsharesjs";
import PrivateKeyStore from "stores/PrivateKeyStore";
import WalletDb from "stores/WalletDb";
import WalletUnlockActions from "../../actions/WalletUnlockActions";
import {Button} from "../../design-system/Button";
import {
    MAX_MEMO,
    findEntry,
    useAddressBook
} from "../../lib/common/addressBook";
import EntryDialog from "./EntryDialog";
import styles from "./AddressBook.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`address_book.${key}`, params) as string;

/** The memo of a payment as text, or "" when it has none or cannot be read (it is only handed to the form, never logged). */
function readMemo(memo: any): string {
    if (!memo) return "";
    try {
        const decoded = (PrivateKeyStore as any).decodeMemo(memo);
        return decoded && typeof decoded.text === "string"
            ? decoded.text.trim().slice(0, MAX_MEMO)
            : "";
    } catch (e) {
        return "";
    }
}

export interface AddToAddressBookProps {
    /** the id of the account that was paid */
    to: string;
    /** the memo of the payment, as the chain has it (encrypted) */
    memo?: any;
    /** the id of the asset that was paid: the entry is for it */
    assetId?: string;
}

export default function AddToAddressBook({
    to,
    memo,
    assetId
}: AddToAddressBookProps): JSX.Element | null {
    const book = useAddressBook();
    const [form, setForm] = React.useState<{
        name: string;
        memo: string;
        asset: string;
    } | null>(null);
    const account: any = ChainStore.getAccount(to);
    const name: string | null = account ? account.get("name") : null;
    const paid: any = assetId ? ChainStore.getAsset(assetId) : null;
    const asset: string = paid ? paid.get("symbol") : "";
    // The memo of the payment, to set against the saved one: only read while the wallet is open (it is never asked to
    // unlock for this), and only a payment that had a memo has one.
    const locked = !!(WalletDb as any).isLocked();
    const paidMemo = React.useMemo(
        () => (memo && !locked ? readMemo(memo) : ""),
        [memo, locked]
    );
    // (the account and the asset are shown by the row itself, so they are there at once)
    if (!name || (assetId && !asset)) return null;
    const saved = findEntry(name, book, asset);
    if (saved && (!paidMemo || paidMemo === saved.memo)) {
        return <span className={styles.saved}>{t("in_book")}</span>;
    }

    const open = async () => {
        let text = readMemo(memo);
        // an encrypted memo of ours needs the wallet to be open
        if (memo && !text && (WalletDb as any).isLocked()) {
            try {
                await (WalletUnlockActions as any).unlock();
                text = readMemo(memo);
            } catch (e) {
                // cancelled: the form opens without the memo
            }
        }
        setForm({name, memo: text, asset});
    };

    if (saved) {
        // Same account and asset, another memo: the saved entry takes the memo of the payment - except an entry for any
        // asset, which a payment of one asset must not change for all: that asset gets an entry of its own.
        const own = !!saved.asset || !asset;
        return (
            <div className={styles.activityAction}>
                <span className={styles.saved}>{t("in_book_other_memo")}</span>
                <Button
                    size="small"
                    onClick={() => setForm({name, memo: paidMemo, asset})}
                >
                    {t("update_memo")}
                </Button>
                {form ? (
                    own ? (
                        <EntryDialog
                            entry={{...saved, memo: paidMemo}}
                            onClose={() => setForm(null)}
                        />
                    ) : (
                        <EntryDialog
                            initial={form}
                            onClose={() => setForm(null)}
                        />
                    )
                ) : null}
            </div>
        );
    }

    return (
        <div className={styles.activityAction}>
            <Button size="small" onClick={open}>
                {t("add_from_activity")}
            </Button>
            {form ? (
                <EntryDialog initial={form} onClose={() => setForm(null)} />
            ) : null}
        </div>
    );
}
