// On a payment the account sent (the recent activity: a withdrawal to an exchange or a gateway is one): a button that
// saves who it went to in the address book, with the memo that went along (a deposit tag, an address) when it can
// be read - it is encrypted, so a locked wallet is asked to unlock first, and if that is cancelled the form simply
// opens without it. Where the book has the account already, it says so instead.
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
}

export default function AddToAddressBook({
    to,
    memo
}: AddToAddressBookProps): JSX.Element | null {
    const book = useAddressBook();
    const [form, setForm] = React.useState<{name: string; memo: string} | null>(
        null
    );
    const account: any = ChainStore.getAccount(to);
    const name: string | null = account ? account.get("name") : null;
    if (!name) return null;
    if (findEntry(name, book)) {
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
        setForm({name, memo: text});
    };

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
