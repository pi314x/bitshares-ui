// Create / update / delete dialogs for SameT funds. Each one validates what the
// user typed with the exact (BigInt/string based, never floating point)
// helpers in `lib/common/sametFunds.ts`, shows the problem next to the field,
// and only enables the submit button for input that builds a valid operation.
// The transaction itself goes through `SametFundActions` ->
// `WalletDb.process_transaction`, which asks for the wallet unlock.
import * as React from "react";
import counterpart from "counterpart";
import {Modal} from "../../../design-system/Modal";
import {Button} from "../../../design-system/Button";
import {Input} from "../../../design-system/Input";
import {Select} from "../../../design-system/Select";
import {Alert} from "../../../design-system/Alert";
import {Notification} from "../../../design-system/Notification";
import SametFundActions, {
    AccountInfo,
    AssetInfo,
    BalanceInfo
} from "../../../actions/SametFundActions";
import {
    SametFund,
    formatAmount,
    formatFeeRate,
    parseAmount,
    parseFeeRate
} from "../../../lib/common/sametFunds";
import styles from "./SametFundsPage.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`samet.${key}`, params);

/** The reason a transaction failed, as text. The wallet-unlock dialog being
 * cancelled and node rejections arrive as strings, Errors or plain objects. */
export function describeError(error: any): string {
    if (!error) return t("failed");
    if (typeof error === "string") return error;
    if (error.message) return String(error.message);
    return t("failed");
}

interface FormShellProps {
    visible: boolean;
    title: string;
    submitLabel: string;
    canSubmit: boolean;
    submitting: boolean;
    error: string | null;
    onSubmit: () => void;
    onCancel: () => void;
    children: React.ReactNode;
}

function FormShell(props: FormShellProps) {
    return (
        <Modal
            visible={props.visible}
            title={props.title}
            onCancel={props.onCancel}
            width={480}
            footer={
                <div className={styles.footer}>
                    <Button
                        onClick={props.onCancel}
                        disabled={props.submitting}
                    >
                        {t("cancel")}
                    </Button>
                    <Button
                        variant="accent"
                        onClick={props.onSubmit}
                        disabled={!props.canSubmit || props.submitting}
                        loading={props.submitting}
                    >
                        {props.submitLabel}
                    </Button>
                </div>
            }
        >
            <div className={styles.form}>
                {props.children}
                {props.error ? (
                    <Alert type="error" showIcon message={props.error} />
                ) : null}
            </div>
        </Modal>
    );
}

function Field(props: {
    label: string;
    help?: React.ReactNode;
    error?: string | null;
    children: React.ReactNode;
}) {
    return (
        <div className={styles.field}>
            <span className={styles.label}>{props.label}</span>
            {props.children}
            {props.error ? (
                <span className={styles.fieldError}>{props.error}</span>
            ) : props.help ? (
                <span className={styles.help}>{props.help}</span>
            ) : null}
        </div>
    );
}

/** Run a transaction, report the outcome, and tell the caller when it is
 * done. Keeps the three dialogs' submit handlers identical. */
function useSubmit(visible: boolean, onDone: () => void, successKey: string) {
    const [submitting, setSubmitting] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const mounted = React.useRef(true);
    // A reopened dialog starts without the previous attempt's error.
    React.useEffect(() => {
        if (visible) setError(null);
    }, [visible]);
    React.useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const run = React.useCallback(
        (action: () => Promise<any>) => {
            setSubmitting(true);
            setError(null);
            action()
                .then(() => {
                    Notification.success({message: t(successKey)});
                    if (mounted.current) setSubmitting(false);
                    onDone();
                })
                .catch(err => {
                    if (!mounted.current) return;
                    setSubmitting(false);
                    setError(describeError(err));
                });
        },
        [onDone, successKey]
    );

    return {submitting, error, run};
}

// ---- Create -----------------------------------------------------------------

export interface CreateFundModalProps {
    visible: boolean;
    owner: AccountInfo;
    onCancel: () => void;
    onDone: () => void;
}

export function CreateFundModal({
    visible,
    owner,
    onCancel,
    onDone
}: CreateFundModalProps) {
    const [balances, setBalances] = React.useState<BalanceInfo[]>([]);
    const [assets, setAssets] = React.useState<Record<string, AssetInfo>>({});
    const [assetId, setAssetId] = React.useState<string>("");
    const [amountText, setAmountText] = React.useState("");
    const [rateText, setRateText] = React.useState("");
    const [loadError, setLoadError] = React.useState<string | null>(null);
    const {submitting, error, run} = useSubmit(visible, onDone, "created");

    React.useEffect(() => {
        if (!visible) return;
        let cancelled = false;
        setAssetId("");
        setAmountText("");
        setRateText("");
        setLoadError(null);
        SametFundActions.getBalances(owner.id)
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
                if (!cancelled) setLoadError(describeError(err));
            });
        return () => {
            cancelled = true;
        };
    }, [visible, owner.id]);

    const asset = assetId ? assets[assetId] : undefined;
    const available = balances.find(b => b.asset_id === assetId);
    const units = asset ? parseAmount(amountText, asset.precision) : null;
    const feeRate = parseFeeRate(rateText);

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
    const rateError =
        rateText.trim() !== "" && feeRate === null ? t("err_fee_rate") : null;
    const canSubmit =
        !!asset &&
        units !== null &&
        BigInt(units) > BigInt(0) &&
        !amountError &&
        feeRate !== null;

    const submit = () => {
        if (!asset || units === null || feeRate === null) return;
        run(() =>
            SametFundActions.create({
                owner: owner.id,
                assetId: asset.id,
                balance: units,
                feeRate
            })
        );
    };

    return (
        <FormShell
            visible={visible}
            title={t("create_title")}
            submitLabel={t("submit_create")}
            canSubmit={canSubmit}
            submitting={submitting}
            error={error || loadError}
            onSubmit={submit}
            onCancel={onCancel}
        >
            <Field label={t("asset")}>
                <Select
                    value={assetId}
                    placeholder={t("asset_placeholder")}
                    onChange={value => setAssetId(String(value))}
                >
                    {balances
                        .filter(b => assets[b.asset_id])
                        .map(b => (
                            <Select.Option key={b.asset_id} value={b.asset_id}>
                                {assets[b.asset_id].symbol}
                            </Select.Option>
                        ))}
                </Select>
            </Field>
            <Field
                label={t("amount")}
                error={amountError}
                help={
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
                <Input
                    value={amountText}
                    inputMode="decimal"
                    autoComplete="off"
                    disabled={!asset}
                    addonAfter={asset ? asset.symbol : undefined}
                    onChange={e => setAmountText(e.target.value)}
                />
            </Field>
            <Field
                label={t("fee_rate")}
                error={rateError}
                help={t("fee_rate_help")}
            >
                <Input
                    value={rateText}
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.03"
                    onChange={e => setRateText(e.target.value)}
                />
            </Field>
            <p className={styles.modalNote}>{t("create_note")}</p>
        </FormShell>
    );
}

// ---- Update -----------------------------------------------------------------

type Mode = "none" | "add" | "withdraw";

export interface FundModalProps {
    visible: boolean;
    fund: SametFund | null;
    asset: AssetInfo | undefined;
    owner: AccountInfo;
    onCancel: () => void;
    onDone: () => void;
}

export function UpdateFundModal({
    visible,
    fund,
    asset,
    owner,
    onCancel,
    onDone
}: FundModalProps) {
    const [mode, setMode] = React.useState<Mode>("none");
    const [amountText, setAmountText] = React.useState("");
    const [rateText, setRateText] = React.useState("");
    const [available, setAvailable] = React.useState<string | null>(null);
    const {submitting, error, run} = useSubmit(visible, onDone, "updated");

    React.useEffect(() => {
        if (!visible || !fund) return;
        let cancelled = false;
        setMode("none");
        setAmountText("");
        setRateText(formatFeeRate(fund.fee_rate).replace("%", ""));
        setAvailable(null);
        SametFundActions.getBalances(owner.id)
            .then(rows => {
                if (cancelled) return;
                const row = rows.find(r => r.asset_id === fund.asset_type);
                setAvailable(row ? row.amount : "0");
            })
            .catch(() => {
                if (!cancelled) setAvailable(null);
            });
        return () => {
            cancelled = true;
        };
    }, [visible, fund, owner.id]);

    if (!fund) return null;

    const precision = asset ? asset.precision : 0;
    const symbol = asset ? asset.symbol : fund.asset_type;
    const units = mode === "none" ? null : parseAmount(amountText, precision);
    const feeRate = parseFeeRate(rateText);

    let amountError: string | null = null;
    if (mode !== "none" && amountText.trim() !== "") {
        if (units === null) {
            amountError = t("err_amount", {precision});
        } else if (BigInt(units) <= BigInt(0)) {
            amountError = t("err_amount_zero");
        } else if (
            mode === "add" &&
            available !== null &&
            BigInt(units) > BigInt(available)
        ) {
            amountError = t("err_over_balance");
        } else if (
            mode === "withdraw" &&
            BigInt(units) > BigInt(fund.balance)
        ) {
            amountError = t("err_over_fund");
        }
    }
    const rateError =
        rateText.trim() !== "" && feeRate === null ? t("err_fee_rate") : null;

    const hasDelta =
        mode !== "none" &&
        units !== null &&
        BigInt(units) > BigInt(0) &&
        !amountError;
    const rateChanged = feeRate !== null && feeRate !== fund.fee_rate;
    const canSubmit =
        !!asset &&
        feeRate !== null &&
        (mode === "none" || hasDelta) &&
        (hasDelta || rateChanged);
    const nothingChanged =
        !!asset && feeRate !== null && mode === "none" && !rateChanged;

    const submit = () => {
        if (!asset || feeRate === null || !canSubmit) return;
        run(() =>
            SametFundActions.update({
                owner: owner.id,
                fundId: fund.id,
                deltaAmount:
                    hasDelta && units !== null
                        ? {
                              assetId: fund.asset_type,
                              amount: (mode === "withdraw" ? "-" : "") + units
                          }
                        : undefined,
                newFeeRate: rateChanged ? feeRate : undefined
            })
        );
    };

    const modes: Array<[Mode, string]> = [
        ["none", t("change_none")],
        ["add", t("change_add")],
        ["withdraw", t("change_withdraw")]
    ];

    return (
        <FormShell
            visible={visible}
            title={t("update_title", {id: fund.id})}
            submitLabel={t("submit_update")}
            canSubmit={canSubmit}
            submitting={submitting}
            error={error}
            onSubmit={submit}
            onCancel={onCancel}
        >
            <Field
                label={t("balance_change")}
                help={t("current", {
                    value: `${formatAmount(fund.balance, precision)} ${symbol}`
                })}
            >
                <div className={styles.modes}>
                    {modes.map(([value, label]) => (
                        <button
                            key={value}
                            type="button"
                            className={
                                mode === value
                                    ? `${styles.mode} ${styles.modeActive}`
                                    : styles.mode
                            }
                            onClick={() => setMode(value)}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </Field>
            {mode !== "none" ? (
                <Field
                    label={t("change_amount")}
                    error={amountError}
                    help={
                        mode === "add" && available !== null
                            ? t("available", {
                                  amount: `${formatAmount(
                                      available,
                                      precision
                                  )} ${symbol}`
                              })
                            : null
                    }
                >
                    <Input
                        value={amountText}
                        inputMode="decimal"
                        autoComplete="off"
                        addonAfter={symbol}
                        onChange={e => setAmountText(e.target.value)}
                    />
                </Field>
            ) : null}
            <Field
                label={t("new_fee_rate")}
                error={rateError}
                help={t("current", {value: formatFeeRate(fund.fee_rate)})}
            >
                <Input
                    value={rateText}
                    inputMode="decimal"
                    autoComplete="off"
                    onChange={e => setRateText(e.target.value)}
                />
            </Field>
            {nothingChanged ? (
                <span className={styles.help}>{t("nothing_changed")}</span>
            ) : null}
        </FormShell>
    );
}

// ---- Delete -----------------------------------------------------------------

export function DeleteFundModal({
    visible,
    fund,
    asset,
    owner,
    onCancel,
    onDone
}: FundModalProps) {
    const {submitting, error, run} = useSubmit(visible, onDone, "deleted");
    if (!fund) return null;
    const precision = asset ? asset.precision : 0;
    const symbol = asset ? asset.symbol : fund.asset_type;
    return (
        <FormShell
            visible={visible}
            title={t("delete_title", {id: fund.id})}
            submitLabel={t("submit_delete")}
            canSubmit={true}
            submitting={submitting}
            error={error}
            onSubmit={() =>
                run(() =>
                    SametFundActions.delete({owner: owner.id, fundId: fund.id})
                )
            }
            onCancel={onCancel}
        >
            <p className={styles.modalNote}>
                {t("delete_confirm", {
                    amount: `${formatAmount(fund.balance, precision)} ${symbol}`
                })}
            </p>
        </FormShell>
    );
}
