// The form that adds an address book entry, or changes one: the account, the asset it is for (a withdrawal of it),
// who it is, what to know about it, and the memo to send with a payment to it. Opened by the address book page,
// by the Send dialog ("save this recipient") and by the recent activity (a payment that was sent).
import * as React from "react";
import counterpart from "counterpart";
import {Button} from "../../design-system/Button";
import {Input} from "../../design-system/Input";
import {Modal} from "../../design-system/Modal";
import {
    AddressEntry,
    MAX_ASSET,
    MAX_LABEL,
    MAX_MEMO,
    MAX_NOTE,
    normalizeAsset,
    saveEntry,
    validAccountName,
    validAssetSymbol
} from "../../lib/common/addressBook";
import styles from "./AddressBook.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`address_book.${key}`, params) as string;

export interface EntryDialogProps {
    /** the entry being changed (none: a new one) */
    entry?: AddressEntry | null;
    /** what a new entry starts with (the recipient of a payment that is being typed) */
    initial?: {name?: string; memo?: string; asset?: string};
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
    const [asset, setAsset] = React.useState(
        entry ? entry.asset : (initial && initial.asset) || ""
    );
    const [error, setError] = React.useState<string | null>(null);

    const typed = name.trim().toLowerCase();
    const nameOk = validAccountName(typed);
    // the asset is optional: empty is any asset; what is typed must be a symbol
    const typedAsset = asset.trim().toUpperCase();
    const assetOk = !typedAsset || validAssetSymbol(typedAsset);

    const save = () => {
        if (!nameOk) return setError(t("error_name"));
        if (!assetOk) return setError(t("error_asset"));
        const result = saveEntry({
            id: entry ? entry.id : undefined,
            name: typed,
            asset: normalizeAsset(typedAsset),
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
                    <Button
                        variant="accent"
                        disabled={!nameOk || !assetOk}
                        onClick={save}
                    >
                        {t("save")}
                    </Button>
                </div>
            }
        >
            <div className={styles.form}>
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="address-name">
                        {t("name")}
                    </label>
                    <Input
                        id="address-name"
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
                </div>
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="address-asset">
                        {t("asset")}
                    </label>
                    <Input
                        id="address-asset"
                        value={asset}
                        maxLength={MAX_ASSET}
                        autoComplete="off"
                        spellCheck={false}
                        aria-label={t("asset")}
                        onChange={(e: any) => {
                            setAsset(e.target.value);
                            setError(null);
                        }}
                    />
                    {assetOk ? (
                        <span className={styles.help}>{t("asset_help")}</span>
                    ) : (
                        <span className={styles.error} role="alert">
                            {t("error_asset")}
                        </span>
                    )}
                </div>
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="address-label">
                        {t("label")}
                    </label>
                    <Input
                        id="address-label"
                        value={label}
                        maxLength={MAX_LABEL}
                        aria-label={t("label")}
                        onChange={(e: any) => setLabel(e.target.value)}
                    />
                </div>
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="address-note">
                        {t("note")}
                    </label>
                    <Input.TextArea
                        id="address-note"
                        rows={3}
                        value={note}
                        maxLength={MAX_NOTE}
                        aria-label={t("note")}
                        onChange={(e: any) => setNote(e.target.value)}
                    />
                </div>
                <div className={styles.field}>
                    <label className={styles.label} htmlFor="address-memo">
                        {t("memo")}
                    </label>
                    <Input
                        id="address-memo"
                        value={memo}
                        maxLength={MAX_MEMO}
                        autoComplete="off"
                        aria-label={t("memo")}
                        onChange={(e: any) => setMemo(e.target.value)}
                    />
                    <span className={styles.help}>{t("memo_help")}</span>
                </div>
                {error ? (
                    <p className={styles.error} role="alert">
                        {error}
                    </p>
                ) : null}
            </div>
        </Modal>
    );
}
