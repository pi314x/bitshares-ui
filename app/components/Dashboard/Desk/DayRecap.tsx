// "Last 24 hours": what happened to the account in the last day, in a few lines - transfers, order fills, orders, pool
// swaps, flash loans and the network fees - counted from its operation history (`lib/common/dayRecap.ts`). The history is
// the one the balance chart is drawn from, loaded in the background and kept, so the card fills while it loads.
import * as React from "react";
import counterpart from "counterpart";
import {ChainTypes} from "bitsharesjs";
import SametFundActions from "../../../actions/SametFundActions";
import {useBalanceHistory} from "../../../next/hooks/useBalanceHistory";
import {formatAssetAmount} from "../../../lib/common/fills";
import {
    Totals,
    isQuiet,
    largest,
    recapAssets,
    recapOf
} from "../../../lib/common/dayRecap";
import styles from "./DayRecap.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`day_recap.${key}`, params) as string;

/** How many assets a line names before "and N more". */
const SHOWN = 3;
/** How many tokens the gained-or-lost line names. */
const SHOWN_NET = 6;

/** The size of a change in whole units of its token (to put the largest first). */
const whole = (
    [id, units]: [string, bigint],
    assetOf: (id: string) => {precision: number} | null
): number => {
    const info = assetOf(id);
    return Math.abs(Number(units)) / Math.pow(10, info ? info.precision : 0);
};

const OP_NAMES: {[code: number]: string} = {};
function opName(code: number): string | undefined {
    if (!Object.keys(OP_NAMES).length) {
        const operations: {[name: string]: number} = (ChainTypes as any)
            .operations;
        Object.keys(operations).forEach(name => {
            OP_NAMES[operations[name]] = name;
        });
    }
    return OP_NAMES[code];
}

// what the chain was asked for already: an asset's symbol and precision do not change
const assetCache = new Map<string, {symbol: string; precision: number}>();

function useAssets(
    ids: string[]
): (id: string) => {symbol: string; precision: number} | null {
    const [, setVersion] = React.useState(0);
    const key = ids
        .slice()
        .sort()
        .join(",");
    React.useEffect(() => {
        const missing = ids.filter(id => !assetCache.has(id) && id !== "1.3.0");
        if (!missing.length) return;
        let alive = true;
        SametFundActions.getAssets(missing)
            .then(found => {
                Object.keys(found).forEach(id =>
                    assetCache.set(id, {
                        symbol: found[id].symbol,
                        precision: found[id].precision
                    })
                );
                if (alive) setVersion(v => v + 1);
            })
            .catch(() => undefined);
        return () => {
            alive = false;
        };
    }, [key]);
    return id =>
        assetCache.get(id) ||
        (id === "1.3.0" ? {symbol: "BTS", precision: 5} : null);
}

export default function DayRecap({
    accountId
}: {
    accountId: string;
}): JSX.Element {
    const history = useBalanceHistory(accountId);
    // the window moves on: looked at again every minute
    const [now, setNow] = React.useState(() => Date.now());
    React.useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 60 * 1000);
        return () => clearInterval(timer);
    }, []);
    const recap = React.useMemo(
        () =>
            recapOf({
                entries: history.entries,
                times: history.times,
                complete: history.complete,
                accountId,
                nowSec: Math.floor(now / 1000),
                opName
            }),
        [history.entries, history.times, history.complete, accountId, now]
    );
    const assetOf = useAssets(recapAssets(recap));

    const amounts = (totals: Totals): string => {
        const {shown, more} = largest(totals, SHOWN);
        const text = shown
            .map(([id, amount]) =>
                formatAssetAmount(
                    {amount: amount.toString(), asset_id: id},
                    assetOf(id)
                )
            )
            .join(", ");
        return more > 0 ? `${text} ${t("more", {count: more})}` : text;
    };

    // what was gained (green) and what was lost (red), the largest first
    const gains = Array.from(recap.net.entries()).sort(
        (a, b) => whole(b, assetOf) - whole(a, assetOf)
    );
    const lines: string[] = [];
    if (recap.transfersIn.count) {
        lines.push(
            t("transfers_in", {
                count: recap.transfersIn.count,
                amounts: amounts(recap.transfersIn.total)
            })
        );
    }
    if (recap.transfersOut.count) {
        lines.push(
            t("transfers_out", {
                count: recap.transfersOut.count,
                amounts: amounts(recap.transfersOut.total)
            })
        );
    }
    if (recap.fills.count) {
        lines.push(
            t("fills", {
                count: recap.fills.count,
                sold: amounts(recap.fills.sold),
                got: amounts(recap.fills.got)
            })
        );
    }
    if (recap.orders.placed || recap.orders.cancelled) {
        lines.push(
            t("orders", {
                placed: recap.orders.placed,
                cancelled: recap.orders.cancelled
            })
        );
    }
    if (recap.pools.swaps || recap.pools.liquidity) {
        lines.push(
            t("pools", {
                swaps: recap.pools.swaps,
                liquidity: recap.pools.liquidity
            })
        );
    }
    if (recap.loans) lines.push(t("loans", {count: recap.loans}));
    if (recap.fees.size) lines.push(t("fees", {amounts: amounts(recap.fees)}));

    const loadingOlder = !recap.covered && history.loading;
    return (
        <div className={styles.recap}>
            {isQuiet(recap) ? (
                <p className={styles.quiet}>{t("quiet")}</p>
            ) : (
                <>
                    <p className={styles.count}>
                        {t("operations", {count: recap.operations})}
                    </p>
                    <p className={styles.net}>
                        {t("net")}{" "}
                        {gains.length ? (
                            gains.slice(0, SHOWN_NET).map(([id, units], i) => (
                                <span key={id}>
                                    {i > 0 ? ", " : ""}
                                    <span
                                        className={
                                            units > BigInt(0)
                                                ? styles.up
                                                : styles.down
                                        }
                                    >
                                        {units > BigInt(0) ? "+" : ""}
                                        {formatAssetAmount(
                                            {
                                                amount: units.toString(),
                                                asset_id: id
                                            },
                                            assetOf(id)
                                        )}
                                    </span>
                                </span>
                            ))
                        ) : (
                            <span>{t("net_none")}</span>
                        )}
                        {gains.length > SHOWN_NET ? (
                            <span className={styles.note}>
                                {" "}
                                {t("more", {count: gains.length - SHOWN_NET})}
                            </span>
                        ) : null}
                    </p>
                    {lines.length ? (
                        <ul className={styles.lines}>
                            {lines.map(line => (
                                <li key={line}>{line}</li>
                            ))}
                        </ul>
                    ) : null}
                </>
            )}
            {loadingOlder ? (
                <p className={styles.note}>{t("loading")}</p>
            ) : !recap.covered ? (
                <p className={styles.note}>
                    {t("partial", {count: history.entries.length})}
                </p>
            ) : null}
        </div>
    );
}
