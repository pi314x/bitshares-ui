// Lifetime membership: after how many trades does it pay for itself? The fee of a Lifetime
// membership is paid once; a Lifetime member gets back everything of a network fee but the network's
// share (`lib/common/membership.ts`). The figures are the chain's own, read when the page opens; the
// fee of a trade can be changed. Read only: nothing here upgrades an account.
import * as React from "react";
import counterpart from "counterpart";
import {Input} from "../../design-system/Input";
import {PageHead} from "../../design-system/PageHead";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectAccountState} from "../../store/slices/accountSlice";
import {MembershipInfo, loadMembership} from "../../lib/chain/membershipData";
import {amountText, breakEven, parseAmount} from "../../lib/common/membership";
import OwnFees from "./OwnFees";
import styles from "./LifetimeBreakEven.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`membership_breakeven.${key}`, params) as string;

/** The chain's figures for the account, read when the page opens (and again for another account). */
function useMembership(accountName: string | null) {
    const [info, setInfo] = React.useState<MembershipInfo | null>(null);
    const [failed, setFailed] = React.useState(false);
    React.useEffect(() => {
        let cancelled = false;
        setFailed(false);
        loadMembership(accountName)
            .then(result => {
                if (!cancelled) setInfo(result);
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            });
        return () => {
            cancelled = true;
        };
    }, [accountName]);
    return {info, failed};
}

function Field(props: {
    label: string;
    help?: string;
    error?: string | null;
    children: React.ReactNode;
}) {
    return (
        <div className={styles.field}>
            <span className={styles.label}>{props.label}</span>
            {props.children}
            {props.error ? (
                <span className={styles.error}>{props.error}</span>
            ) : props.help ? (
                <span className={styles.help}>{props.help}</span>
            ) : null}
        </div>
    );
}

export default function LifetimeBreakEven(): JSX.Element {
    const account = useReduxState<any>(selectAccountState);
    const accountName: string | null =
        account.currentAccount || account.passwordAccount || null;
    const {info, failed} = useMembership(accountName);
    const [feeText, setFeeText] = React.useState("");
    const [perDayText, setPerDayText] = React.useState("20");

    const precision = info ? info.core.precision : 5;
    const symbol = info ? info.core.symbol : "BTS";
    const money = (units: bigint) =>
        `${amountText(units, precision)} ${symbol}`;
    // the fee of a trade: what was typed, else a limit order's
    const typedFee =
        feeText.trim() === "" ? null : parseAmount(feeText, precision);
    const defaultFee = info ? info.orderFee : null;
    const fee = typedFee !== null ? typedFee : defaultFee;
    const perDay = Number(perDayText.replace(",", "."));
    const perDayOk =
        perDayText.trim() !== "" && Number.isFinite(perDay) && perDay > 0;

    const result =
        info && fee !== null
            ? breakEven({
                  lifetimeFee: info.lifetimeFee,
                  feePerTrade: fee,
                  networkBp: info.networkBp,
                  tradesPerDay: perDayOk ? perDay : 0
              })
            : null;
    const percent = info ? String(100 - info.networkBp / 100) : "80";
    const days = (n: number) =>
        n < 10 ? n.toFixed(1) : amountText(BigInt(Math.ceil(n)), 0);

    return (
        <div className={styles.page}>
            <PageHead className={styles.pageHead} title={t("title")} />
            {info ? <OwnFees accountName={accountName} info={info} /> : null}
            <section className={styles.card}>
                <div className={styles.head}>
                    <div
                        className={styles.cardTitle}
                        role="heading"
                        aria-level={2}
                    >
                        {t("calc_title")}
                    </div>
                </div>
                <div className={styles.body}>
                    {failed ? (
                        <p className={styles.error}>{t("failed")}</p>
                    ) : !info ? (
                        <p className={styles.muted}>{t("loading")}</p>
                    ) : (
                        <>
                            <p className={styles.muted}>
                                {t("intro", {percent})}
                            </p>
                            <p className={styles.muted}>
                                {t(`status_${info.status}`)}
                            </p>
                            <div className={styles.fieldRow}>
                                <Field
                                    label={t("fee_label")}
                                    help={t("fee_help", {
                                        symbol,
                                        order: money(info.orderFee),
                                        pool: money(info.exchangeFee),
                                        route: money(
                                            info.exchangeFee * BigInt(3)
                                        )
                                    })}
                                    error={
                                        feeText.trim() !== "" &&
                                        typedFee === null
                                            ? t("amount_invalid")
                                            : null
                                    }
                                >
                                    <Input
                                        inputMode="decimal"
                                        autoComplete="off"
                                        placeholder={
                                            defaultFee !== null
                                                ? amountText(
                                                      defaultFee,
                                                      precision
                                                  )
                                                : "0"
                                        }
                                        value={feeText}
                                        suffix={symbol}
                                        aria-label={t("fee_label")}
                                        onChange={event =>
                                            setFeeText(event.target.value)
                                        }
                                    />
                                </Field>
                                <Field
                                    label={t("perday_label")}
                                    error={
                                        perDayOk ? null : t("perday_invalid")
                                    }
                                >
                                    <Input
                                        inputMode="decimal"
                                        autoComplete="off"
                                        value={perDayText}
                                        aria-label={t("perday_label")}
                                        onChange={event =>
                                            setPerDayText(event.target.value)
                                        }
                                    />
                                </Field>
                            </div>
                            {result && fee !== null ? (
                                <ul className={styles.results}>
                                    <li>
                                        {t("cost", {
                                            fee: money(info.lifetimeFee)
                                        })}
                                    </li>
                                    <li>
                                        {t("cashback", {
                                            amount: money(result.cashback),
                                            fee: money(fee),
                                            percent
                                        })}
                                    </li>
                                    <li>
                                        {info.status === "lifetime"
                                            ? t("member_gets", {
                                                  amount: money(result.cashback)
                                              })
                                            : result.trades === null
                                            ? t("never")
                                            : result.days !== null
                                            ? t("breakeven_days", {
                                                  trades: amountText(
                                                      BigInt(result.trades),
                                                      0
                                                  ),
                                                  days: days(result.days),
                                                  per_day: String(perDay)
                                              })
                                            : t("breakeven", {
                                                  trades: amountText(
                                                      BigInt(result.trades),
                                                      0
                                                  )
                                              })}
                                    </li>
                                </ul>
                            ) : null}
                            <p className={styles.muted}>
                                {t("note", {
                                    threshold: money(info.vestingThreshold),
                                    days: String(info.vestingDays)
                                })}
                            </p>
                        </>
                    )}
                </div>
            </section>
        </div>
    );
}
