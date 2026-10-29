import * as React from "react";
import counterpart from "counterpart";
import {Modal} from "../../design-system/Modal";
import {Button} from "../../design-system/Button";
import {Input} from "../../design-system/Input";
import {Select} from "../../design-system/Select";
import {Alert} from "../../design-system/Alert";
import {Notification} from "../../design-system/Notification";
import SametFundActions, {
    AccountInfo,
    AssetInfo,
    BalanceInfo
} from "../../actions/SametFundActions";
import TimedTransferActions from "../../actions/TimedTransferActions";
import {formatAmount, parseAmount} from "../../lib/common/sametFunds";
import {checkRelease, parseLocalDateTime} from "../../lib/common/timedTransfer";
import styles from "./TimedTransferModal.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`timed_transfer.${key}`, params);

function describeError(error: any): string {
    if (!error) return t("failed");
    if (typeof error === "string") return error;
    if (error.message) return String(error.message);
    return t("failed");
}

const pad = (n: number) => String(n).padStart(2, "0");

/** `datetime-local` value for a Date, in local time. */
function toInputValue(date: Date): string {
    return (
        `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
            date.getDate()
        )}` + `T${pad(date.getHours())}:${pad(date.getMinutes())}`
    );
}

export interface TimedTransferModalProps {
    visible: boolean;
    /** The sending account. */
    creator: AccountInfo;
    onCancel: () => void;
    onDone: () => void;
}

export default function TimedTransferModal({
    visible,
    creator,
    onCancel,
    onDone
}: TimedTransferModalProps) {
    const [balances, setBalances] = React.useState<BalanceInfo[]>([]);
    const [assets, setAssets] = React.useState<Record<string, AssetInfo>>({});
    const [recipientName, setRecipientName] = React.useState("");
    const [recipient, setRecipient] = React.useState<AccountInfo | null>(null);
    const [recipientState, setRecipientState] = React.useState<
        "idle" | "looking" | "missing"
    >("idle");
    const [assetId, setAssetId] = React.useState("");
    const [amountText, setAmountText] = React.useState("");
    const [releaseText, setReleaseText] = React.useState("");
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const mounted = React.useRef(true);

    React.useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    // load the sender's balances each time the dialog opens, and start clean
    React.useEffect(() => {
        if (!visible) return;
        let cancelled = false;
        setRecipientName("");
        setRecipient(null);
        setRecipientState("idle");
        setAssetId("");
        setAmountText("");
        // a week from now, at the hour, as a starting point
        const soon = new Date(Date.now() + 7 * 24 * 3600 * 1000);
        soon.setMinutes(0, 0, 0);
        setReleaseText(toInputValue(soon));
        setError(null);
        SametFundActions.getBalances(creator.id)
            .then(rows =>
                SametFundActions.getAssets(rows.map(r => r.asset_id)).then(
                    infos => {
                        if (cancelled) return;
                        setBalances(rows);
                        setAssets(infos);
                    }
                )
            )
            .catch(err => {
                if (!cancelled) setError(describeError(err));
            });
        return () => {
            cancelled = true;
        };
    }, [visible, creator.id]);

    // resolve the recipient's name once typing pauses
    React.useEffect(() => {
        const name = recipientName.trim();
        if (!name) {
            setRecipient(null);
            setRecipientState("idle");
            return;
        }
        setRecipientState("looking");
        let cancelled = false;
        const timer = setTimeout(() => {
            SametFundActions.getAccountByName(name)
                .then(account => {
                    if (cancelled) return;
                    setRecipient(account);
                    setRecipientState(account ? "idle" : "missing");
                })
                .catch(() => {
                    if (cancelled) return;
                    setRecipient(null);
                    setRecipientState("missing");
                });
        }, 350);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [recipientName]);

    const asset = assetId ? assets[assetId] : undefined;
    const available = balances.find(b => b.asset_id === assetId);
    const units = asset ? parseAmount(amountText, asset.precision) : null;
    const nowSec = Math.floor(Date.now() / 1000);
    const releaseSec = parseLocalDateTime(releaseText);
    const releaseCheck =
        releaseSec === null ? null : checkRelease(nowSec, releaseSec);

    let amountError: string | null = null;
    if (asset && amountText.trim() !== "") {
        if (units === null) {
            amountError = t("err_amount", {precision: asset.precision});
        } else if (BigInt(units) <= BigInt(0)) {
            amountError = t("err_amount_zero");
        } else if (available && BigInt(units) > BigInt(available.amount)) {
            amountError = t("err_over_balance");
        }
    }
    let releaseError: string | null = null;
    if (releaseText.trim() !== "") {
        if (releaseSec === null) releaseError = t("err_release_format");
        else if (releaseCheck && !releaseCheck.ok)
            releaseError = t(`err_release_${releaseCheck.reason}`);
    }
    const recipientError =
        recipientState === "missing"
            ? t("err_recipient_missing")
            : recipient && recipient.id === creator.id
            ? t("err_recipient_self")
            : null;

    const canSubmit =
        !!asset &&
        units !== null &&
        BigInt(units) > BigInt(0) &&
        !amountError &&
        !!recipient &&
        !recipientError &&
        releaseSec !== null &&
        !!releaseCheck &&
        releaseCheck.ok &&
        !submitting;

    const submit = () => {
        if (!canSubmit || !asset || units === null || !recipient) return;
        if (releaseSec === null) return;
        setSubmitting(true);
        setError(null);
        TimedTransferActions.create({
            creator: creator.id,
            owner: recipient.id,
            assetId: asset.id,
            amount: units,
            // "now" is taken again at the moment of signing, not when the
            // dialog was opened, so a long-open dialog cannot shift the release
            nowSec: Math.floor(Date.now() / 1000),
            releaseSec
        })
            .then(() => {
                Notification.success({message: t("created")});
                if (mounted.current) setSubmitting(false);
                onDone();
            })
            .catch(err => {
                if (!mounted.current) return;
                setSubmitting(false);
                setError(describeError(err));
            });
    };

    const summary =
        asset && units !== null && recipient && releaseSec !== null
            ? t("summary", {
                  amount: `${formatAmount(units, asset.precision)} ${
                      asset.symbol
                  }`,
                  recipient: recipient.name,
                  date: new Date(releaseSec * 1000).toLocaleString()
              })
            : null;

    return (
        <Modal
            visible={visible}
            title={t("title")}
            onCancel={onCancel}
            width={500}
            footer={
                <div className={styles.footer}>
                    <Button onClick={onCancel} disabled={submitting}>
                        {t("cancel")}
                    </Button>
                    <Button
                        variant="accent"
                        onClick={submit}
                        disabled={!canSubmit}
                    >
                        {submitting ? t("submitting") : t("submit")}
                    </Button>
                </div>
            }
        >
            <div className={styles.form}>
                <p className={styles.help}>{t("intro")}</p>

                <div className={styles.field}>
                    <span className={styles.label}>{t("recipient")}</span>
                    <Input
                        value={recipientName}
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        placeholder={t("recipient_placeholder")}
                        onChange={e =>
                            setRecipientName(e.target.value.toLowerCase())
                        }
                    />
                    {recipientError ? (
                        <span className={styles.error}>{recipientError}</span>
                    ) : recipient ? (
                        <span className={styles.help}>{recipient.id}</span>
                    ) : null}
                </div>

                <div className={styles.field}>
                    <span className={styles.label}>{t("asset")}</span>
                    <Select
                        value={assetId}
                        placeholder={t("asset_placeholder")}
                        onChange={value => setAssetId(String(value))}
                    >
                        {balances
                            .filter(b => assets[b.asset_id])
                            .map(b => (
                                <Select.Option
                                    key={b.asset_id}
                                    value={b.asset_id}
                                >
                                    {assets[b.asset_id].symbol}
                                </Select.Option>
                            ))}
                    </Select>
                </div>

                <div className={styles.field}>
                    <span className={styles.label}>{t("amount")}</span>
                    <Input
                        value={amountText}
                        inputMode="decimal"
                        autoComplete="off"
                        disabled={!asset}
                        addonAfter={asset ? asset.symbol : undefined}
                        onChange={e => setAmountText(e.target.value)}
                    />
                    {amountError ? (
                        <span className={styles.error}>{amountError}</span>
                    ) : asset && available ? (
                        <span className={styles.help}>
                            {t("available", {
                                amount: `${formatAmount(
                                    available.amount,
                                    asset.precision
                                )} ${asset.symbol}`
                            })}
                        </span>
                    ) : null}
                </div>

                <div className={styles.field}>
                    <span className={styles.label}>{t("release")}</span>
                    <Input
                        type="datetime-local"
                        value={releaseText}
                        onChange={e => setReleaseText(e.target.value)}
                    />
                    {releaseError ? (
                        <span className={styles.error}>{releaseError}</span>
                    ) : (
                        <span className={styles.help}>{t("release_help")}</span>
                    )}
                </div>

                {summary ? <p className={styles.summary}>{summary}</p> : null}

                <Alert type="warning" message={t("irreversible")} />

                {error ? <Alert type="error" message={error} /> : null}
            </div>
        </Modal>
    );
}
