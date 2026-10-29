// What the account has really paid in network fees, and what a Lifetime membership would have given
// back of it: the exact total since the account was created (the chain's own count), whether the
// membership would have paid for itself, and the recent pace from the operations the node still keeps.
// An estimate of what would have been kept, not a promise. Read only.
import * as React from "react";
import counterpart from "counterpart";
import {MembershipInfo} from "../../lib/chain/membershipData";
import {OwnFeesInfo, loadOwnFees} from "../../lib/chain/feesPaid";
import {amountText, paceOf, savingsOf} from "../../lib/common/membership";
import styles from "./LifetimeBreakEven.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`membership_breakeven.${key}`, params) as string;

/** The account's fees, read when the page opens (and again for another account). */
function useOwnFees(accountName: string | null) {
    const [data, setData] = React.useState<OwnFeesInfo | null>(null);
    const [failed, setFailed] = React.useState(false);
    React.useEffect(() => {
        setData(null);
        setFailed(false);
        if (!accountName) return undefined;
        let cancelled = false;
        loadOwnFees(accountName)
            .then(result => {
                if (!cancelled) setData(result);
            })
            .catch(() => {
                if (!cancelled) setFailed(true);
            });
        return () => {
            cancelled = true;
        };
    }, [accountName]);
    return {data, failed};
}

export default function OwnFees(props: {
    accountName: string | null;
    info: MembershipInfo;
}): JSX.Element {
    const {info} = props;
    const {data, failed} = useOwnFees(props.accountName);
    const {precision, symbol} = info.core;
    const money = (units: bigint) =>
        `${amountText(units, precision)} ${symbol}`;
    const percent = String(100 - info.networkBp / 100);
    const member = info.status === "lifetime";

    let body: React.ReactNode;
    if (!props.accountName) {
        body = <p className={styles.muted}>{t("own_login")}</p>;
    } else if (failed) {
        body = <p className={styles.error}>{t("own_failed")}</p>;
    } else if (!data) {
        body = <p className={styles.muted}>{t("own_loading")}</p>;
    } else {
        const saved = savingsOf(
            data.lifetimeFees,
            info.lifetimeFee,
            info.networkBp
        );
        const recent = data.recent;
        const days = recent ? recent.days : 0;
        const pace =
            recent && days > 0
                ? paceOf({
                      fees: recent.fees.coreUnits,
                      days,
                      lifetimeFee: info.lifetimeFee,
                      networkBp: info.networkBp
                  })
                : null;
        const dayText = (n: number) =>
            n < 10 ? n.toFixed(1) : amountText(BigInt(Math.round(n)), 0);
        body = (
            <>
                <ul className={styles.results}>
                    <li>
                        {member
                            ? t("own_member", {
                                  fees: money(data.lifetimeFees),
                                  percent
                              })
                            : t("own_total", {
                                  fees: money(data.lifetimeFees),
                                  ops: amountText(BigInt(data.totalOps), 0)
                              })}
                    </li>
                    {member ? null : (
                        <>
                            <li>
                                {t("own_lost", {
                                    percent,
                                    back: money(saved.cashback)
                                })}
                            </li>
                            <li>
                                {saved.paysOff
                                    ? t("own_ahead", {
                                          cost: money(info.lifetimeFee),
                                          ahead: money(saved.net)
                                      })
                                    : t("own_short", {
                                          cost: money(info.lifetimeFee),
                                          short: money(-saved.net)
                                      })}
                            </li>
                        </>
                    )}
                    {recent && recent.fees.ops > 0 && days > 0 ? (
                        <li>
                            {t("own_recent", {
                                days: dayText(days),
                                entries: amountText(BigInt(recent.entries), 0),
                                ops: amountText(BigInt(recent.fees.ops), 0),
                                fees: money(recent.fees.coreUnits),
                                trading: money(recent.fees.trading)
                            })}
                        </li>
                    ) : null}
                    {pace ? (
                        <li>
                            {member
                                ? t("own_pace_member", {
                                      month: money(pace.perMonth),
                                      back: money(pace.cashbackPerMonth)
                                  })
                                : t("own_pace", {
                                      month: money(pace.perMonth),
                                      back: money(pace.cashbackPerMonth),
                                      months:
                                          pace.months === null
                                              ? "-"
                                              : pace.months.toFixed(1)
                                  })}
                        </li>
                    ) : null}
                </ul>
                {recent && recent.fees.unpriced > 0 ? (
                    <p className={styles.muted}>
                        {t("own_unpriced", {count: recent.fees.unpriced})}
                    </p>
                ) : null}
                <p className={styles.muted}>{t("own_note")}</p>
            </>
        );
    }

    return (
        <section className={styles.card}>
            <div className={styles.head}>
                <div className={styles.cardTitle} role="heading" aria-level={2}>
                    {t("own_title")}
                </div>
            </div>
            <div className={styles.body}>{body}</div>
        </section>
    );
}
