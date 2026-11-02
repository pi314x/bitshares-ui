// The Timed transfer page's form: who gets it, what and how much, and from when it can be claimed - three cards, and
// beside them a summary with the one button. What happens is what the dialog did before (the same checks, the same
// transaction); it is only a page now: nothing opens over anything.
import * as React from "react";
import counterpart from "counterpart";
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
import {
    checkRelease,
    parseLocalDateTime,
    relativeFromNow
} from "../../lib/common/timedTransfer";
import RecipientHelper from "../AddressBook/RecipientHelper";
import {
    Field,
    HowItWorks,
    PaymentCard,
    PaymentPage,
    Picks,
    SummaryCard,
    paymentStyles
} from "../Payments/PaymentPage";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`timed_transfer.${key}`, params) as string;

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

/** A day count from now, at the hour: where the date picks put the release. */
function inDays(days: number): string {
    const date = new Date(Date.now() + days * 24 * 3600 * 1000);
    date.setMinutes(0, 0, 0);
    return toInputValue(date);
}

const DATE_PICKS = [
    {key: "7", days: 7},
    {key: "30", days: 30},
    {key: "91", days: 91},
    {key: "365", days: 365}
];
const AMOUNT_PICKS = [25, 50, 75, 100];

export interface TimedTransferFormProps {
    /** The sending account. */
    creator: AccountInfo;
    /** the way back (Cancel) */
    onCancel: () => void;
    /** a transfer was made */
    onDone: () => void;
    /** where a transfer sent to the account is claimed */
    claimLink?: React.ReactNode;
}

export default function TimedTransferForm({
    creator,
    onCancel,
    onDone,
    claimLink
}: TimedTransferFormProps) {
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

    // load the sender's balances, and start clean
    React.useEffect(() => {
        let cancelled = false;
        setRecipientName("");
        setRecipient(null);
        setRecipientState("idle");
        setAssetId("");
        setAmountText("");
        // a week from now, at the hour, as a starting point
        setReleaseText(inDays(7));
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
    }, [creator.id]);

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

    // what is missing, for the button that cannot be pressed yet
    const blocker = canSubmit
        ? null
        : !recipient || recipientError
        ? t("blocker_recipient")
        : !asset
        ? t("blocker_asset")
        : units === null || amountError || BigInt(units) <= BigInt(0)
        ? t("blocker_amount")
        : t("blocker_release");

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
            // page was opened, so a long-open page cannot shift the release
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

    // a share of the balance, down to the asset's own precision
    const pickAmount = (percent: number) => {
        if (!asset || !available) return;
        const share =
            (BigInt(available.amount) * BigInt(percent)) / BigInt(100);
        setAmountText(formatAmount(share, asset.precision).replace(/,/g, ""));
    };

    const locale = counterpart.getLocale() || "en";
    const releaseDate =
        releaseSec !== null && releaseCheck && releaseCheck.ok
            ? new Date(releaseSec * 1000)
            : null;

    return (
        <PaymentPage
            title={t("title")}
            lead={t("intro")}
            aside={
                <>
                    <SummaryCard
                        title={t("sum_title")}
                        emptyText={t("sum_empty")}
                        rows={[
                            {
                                label: t("sum_amount"),
                                big: true,
                                value:
                                    asset && units !== null && !amountError
                                        ? `${formatAmount(
                                              units,
                                              asset.precision
                                          )} ${asset.symbol}`
                                        : undefined
                            },
                            {
                                label: t("sum_to"),
                                value: recipient ? recipient.name : undefined,
                                detail: recipient ? recipient.id : undefined
                            },
                            {
                                label: t("sum_when"),
                                value: releaseDate
                                    ? releaseDate.toLocaleString()
                                    : undefined,
                                detail: releaseDate
                                    ? relativeFromNow(
                                          Math.floor(
                                              releaseDate.getTime() / 1000
                                          ),
                                          nowSec,
                                          locale
                                      )
                                    : undefined
                            }
                        ]}
                        notes={
                            <>
                                <Alert
                                    type="warning"
                                    message={t("irreversible")}
                                />
                                {error ? (
                                    <Alert type="error" message={error} />
                                ) : null}
                            </>
                        }
                        primary={{
                            label: submitting ? t("submitting") : t("submit"),
                            onClick: submit,
                            disabled: !canSubmit
                        }}
                        secondary={{
                            label: t("cancel"),
                            onClick: onCancel,
                            disabled: submitting
                        }}
                        blocker={blocker}
                    />
                    <HowItWorks
                        title={t("how_title")}
                        steps={[t("step1"), t("step2"), t("step3")]}
                    />
                    {claimLink ? (
                        <p className={paymentStyles.links}>{claimLink}</p>
                    ) : null}
                </>
            }
        >
            <PaymentCard
                step={1}
                title={t("step_recipient")}
                done={!!recipient && !recipientError}
            >
                <Field
                    label={t("recipient")}
                    error={recipientError}
                    ok={
                        recipient && !recipientError
                            ? t("found_account", {id: recipient.id})
                            : null
                    }
                >
                    <Input
                        value={recipientName}
                        autoComplete="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        aria-label={t("recipient")}
                        placeholder={t("recipient_placeholder")}
                        onChange={e =>
                            setRecipientName(e.target.value.toLowerCase())
                        }
                    />
                </Field>
                <RecipientHelper
                    toName={recipientName}
                    memo=""
                    known={!!recipient && !recipientError}
                    onPick={entry => setRecipientName(entry.name)}
                    onUseMemo={() => undefined}
                />
            </PaymentCard>

            <PaymentCard
                step={2}
                title={t("step_amount")}
                done={!!asset && units !== null && !amountError}
            >
                <Field
                    label={t("amount")}
                    error={amountError}
                    hint={
                        asset && available
                            ? t("available", {
                                  amount: `${formatAmount(
                                      available.amount,
                                      asset.precision
                                  )} ${asset.symbol}`
                              })
                            : null
                    }
                >
                    <div className={paymentStyles.amountRow}>
                        <Input
                            value={amountText}
                            inputMode="decimal"
                            autoComplete="off"
                            disabled={!asset}
                            aria-label={t("amount")}
                            placeholder="0"
                            onChange={e => setAmountText(e.target.value)}
                        />
                        <Select
                            showSearch
                            value={assetId}
                            placeholder={t("asset_placeholder")}
                            aria-label={t("asset")}
                            onChange={value => setAssetId(String(value))}
                        >
                            {balances
                                .filter(b => assets[b.asset_id])
                                .map(b => (
                                    <Select.Option
                                        key={b.asset_id}
                                        value={b.asset_id}
                                    >
                                        {`${
                                            assets[b.asset_id].symbol
                                        } - ${formatAmount(
                                            b.amount,
                                            assets[b.asset_id].precision
                                        )}`}
                                    </Select.Option>
                                ))}
                        </Select>
                    </div>
                </Field>
                <Picks
                    disabled={!asset || !available}
                    items={AMOUNT_PICKS.map(percent => ({
                        key: String(percent),
                        label: percent === 100 ? t("max") : `${percent}%`
                    }))}
                    onPick={key => pickAmount(Number(key))}
                />
            </PaymentCard>

            <PaymentCard step={3} title={t("step_when")} done={!!releaseDate}>
                <Field
                    label={t("release")}
                    error={releaseError}
                    help={t("release_help")}
                >
                    <Input
                        type="datetime-local"
                        value={releaseText}
                        aria-label={t("release")}
                        onChange={e => setReleaseText(e.target.value)}
                    />
                </Field>
                <Picks
                    items={DATE_PICKS.map(pick => ({
                        key: String(pick.days),
                        label: t(`pick_${pick.days}`)
                    }))}
                    onPick={key => setReleaseText(inDays(Number(key)))}
                />
            </PaymentCard>
        </PaymentPage>
    );
}
