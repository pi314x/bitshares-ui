import * as React from "react";
import counterpart from "counterpart";
import {
    AreaSeries,
    LineSeries,
    ColorType,
    IChartApi,
    ISeriesApi,
    UTCTimestamp,
    createChart
} from "lightweight-charts";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectAccountState} from "../../store/slices/accountSlice";
import SametFundActions from "../../actions/SametFundActions";
import {Select} from "../../design-system/Select";
import {Button} from "../../design-system/Button";
import BalanceHistoryActions, {
    olderStart
} from "../../actions/BalanceHistoryActions";
import {AssetInfo, BalanceInfo} from "../../actions/SametFundActions";
import {
    HistoryEntry,
    buildBalanceSeries
} from "../../lib/common/balanceHistory";
import {formatAmount} from "../../lib/common/sametFunds";
import styles from "./BalanceHistoryChart.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`balance_history.${key}`, params);

/** Pages (of 100 operations) loaded up front. */
const AUTO_PAGES = 5;

/** A CSS custom property's current value (lightweight-charts needs colours as
 * strings, not var()). */
function token(name: string, fallback: string): string {
    try {
        const v = getComputedStyle(document.documentElement)
            .getPropertyValue(name)
            .trim();
        return v || fallback;
    } catch (e) {
        return fallback;
    }
}

const toNumber = (units: bigint, precision: number) =>
    Number(units) / Math.pow(10, precision);

export interface BalanceHistoryChartProps {
    accountId: string;
    /** Called nowhere else; here so the card can say whose history it is. */
    accountName?: string;
}

// One asset's balance over time for the account: a dropdown of the assets it
// holds, the balance now and its change over the loaded period, and the line.
// The history is rebuilt from the account's operations (lib/common/
// balanceHistory.ts) - what it could not read is said, not hidden.
export default function BalanceHistoryChart({
    accountId
}: BalanceHistoryChartProps) {
    const [balances, setBalances] = React.useState<BalanceInfo[]>([]);
    const [assets, setAssets] = React.useState<Record<string, AssetInfo>>({});
    const [assetId, setAssetId] = React.useState<string>("");
    const [entries, setEntries] = React.useState<HistoryEntry[]>([]);
    const [times, setTimes] = React.useState<{[block: number]: number}>({});
    const [next, setNext] = React.useState<string | null>(null);
    const [lockedNow, setLockedNow] = React.useState<{
        [assetId: string]: string;
    }>({});
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [started, setStarted] = React.useState(false);

    // balances, then the first page of history
    React.useEffect(() => {
        let cancelled = false;
        setStarted(false);
        setEntries([]);
        setTimes({});
        setNext(null);
        setError(null);
        BalanceHistoryActions.getLockedInOrders(accountId).then(locked => {
            if (!cancelled) setLockedNow(locked || {});
        });
        BalanceHistoryActions.getBalances(accountId)
            .then(rows =>
                BalanceHistoryActions.getAssets(rows.map(r => r.asset_id)).then(
                    infos => {
                        if (cancelled) return;
                        const usable = rows.filter(r => infos[r.asset_id]);
                        setBalances(usable);
                        setAssets(infos);
                        setAssetId(prev =>
                            prev && usable.some(r => r.asset_id === prev)
                                ? prev
                                : usable.some(r => r.asset_id === "1.3.0")
                                ? "1.3.0"
                                : usable.length
                                ? usable[0].asset_id
                                : ""
                        );
                    }
                )
            )
            .catch(err => {
                if (!cancelled) setError(String((err && err.message) || err));
            });
        return () => {
            cancelled = true;
        };
    }, [accountId]);

    // One request returns at most 100 operations (the node's limit); the
    // first load goes back several pages, "Load older" continues from there.
    const loadPage = React.useCallback(
        (
            start: string | null,
            pagesLeft: number = AUTO_PAGES
        ): Promise<void> => {
            setLoading(true);
            return BalanceHistoryActions.getHistory(accountId, start)
                .then(rows =>
                    BalanceHistoryActions.getBlockTimes(
                        rows.map(r => r.block_num)
                    ).then(blockTimes => {
                        setEntries(prev => prev.concat(rows));
                        setTimes(prev => ({...prev, ...blockTimes}));
                        const more =
                            rows.length >= 100 ? olderStart(rows) : null;
                        setNext(more);
                        return more;
                    })
                )
                .then(more =>
                    more && pagesLeft > 1
                        ? loadPage(more, pagesLeft - 1)
                        : undefined
                )
                .catch(err => setError(String((err && err.message) || err)))
                .then(() => {
                    setLoading(false);
                    setStarted(true);
                });
        },
        [accountId]
    );

    React.useEffect(() => {
        if (assetId && !started && !loading && entries.length === 0) {
            loadPage(null);
        }
        // first page once there is an asset to draw
        // eslint-disable-next-line
    }, [assetId]);

    const asset = assetId ? assets[assetId] : undefined;
    const current = balances.find(b => b.asset_id === assetId);

    const series = React.useMemo(() => {
        if (!asset || !current) return null;
        return buildBalanceSeries(
            entries,
            BigInt(current.amount),
            accountId,
            assetId,
            times,
            Math.floor(Date.now() / 1000),
            BigInt(lockedNow[assetId] || "0")
        );
    }, [asset, current, entries, times, accountId, assetId, lockedNow]);

    // the chart
    const host = React.useRef<HTMLDivElement>(null);
    const chartRef = React.useRef<IChartApi | null>(null);
    const lineRef = React.useRef<ISeriesApi<"Area"> | null>(null);
    const totalRef = React.useRef<ISeriesApi<"Line"> | null>(null);

    React.useEffect(() => {
        if (!host.current) return;
        const accent = token("--accent", "#16b8f3");
        const chart = createChart(host.current, {
            autoSize: true,
            layout: {
                background: {type: ColorType.Solid, color: "transparent"},
                textColor: token("--muted", "#8794a7")
            },
            grid: {
                vertLines: {visible: false},
                horzLines: {color: token("--line", "#232d3a")}
            },
            rightPriceScale: {borderVisible: false},
            timeScale: {borderVisible: false, timeVisible: true},
            crosshair: {mode: 1}
        });
        const line = chart.addSeries(AreaSeries, {
            lineColor: accent,
            topColor: accent + "55",
            bottomColor: accent + "00",
            lineWidth: 2,
            priceLineVisible: false
        });
        // the whole holding, open orders included
        const total = chart.addSeries(LineSeries, {
            color: token("--muted", "#8794a7"),
            lineWidth: 1,
            lineStyle: 2, // dashed
            priceLineVisible: false,
            lastValueVisible: false,
            crosshairMarkerVisible: false
        });
        chartRef.current = chart;
        lineRef.current = line;
        totalRef.current = total;
        return () => {
            chart.remove();
            chartRef.current = lineRef.current = totalRef.current = null;
        };
    }, [assetId === "" ? "none" : "some"]);

    React.useEffect(() => {
        if (!lineRef.current || !series || !asset) return;
        lineRef.current.applyOptions({
            priceFormat: {
                type: "price",
                precision: Math.min(asset.precision, 6),
                minMove: 1 / Math.pow(10, Math.min(asset.precision, 6))
            }
        });
        lineRef.current.setData(
            series.points.map(p => ({
                time: p.time as UTCTimestamp,
                value: toNumber(p.balance, asset.precision)
            }))
        );
        if (totalRef.current) {
            const anyLocked = series.points.some(p => p.locked > BigInt(0));
            totalRef.current.setData(
                anyLocked
                    ? series.points.map(p => ({
                          time: p.time as UTCTimestamp,
                          value: toNumber(p.balance + p.locked, asset.precision)
                      }))
                    : []
            );
        }
        chartRef.current && chartRef.current.timeScale().fitContent();
    }, [series, asset]);

    if (!balances.length && !error) return null;

    const lockedUnits = BigInt(lockedNow[assetId] || "0");
    const first = series && series.points.length ? series.points[0] : null;
    const change =
        series && first && current
            ? BigInt(current.amount) - first.balance
            : null;

    return (
        <section className={styles.card} aria-label={t("title")}>
            <div className={styles.head}>
                <div>
                    <h3 className={styles.title}>{t("title")}</h3>
                    <div>
                        <span className={styles.value}>
                            {asset && current
                                ? `${formatAmount(
                                      current.amount,
                                      asset.precision
                                  )} ${asset.symbol}`
                                : "-"}
                        </span>
                        {change !== null && asset && change !== BigInt(0) ? (
                            <span
                                className={`${styles.change} ${
                                    change > BigInt(0) ? styles.up : styles.down
                                }`}
                            >
                                {change > BigInt(0) ? "+" : ""}
                                {formatAmount(change, asset.precision)}{" "}
                                {t("over_period")}
                            </span>
                        ) : null}
                    </div>
                    {asset && lockedUnits > BigInt(0) ? (
                        <div className={styles.orders}>
                            {t("in_orders", {
                                amount: `${formatAmount(
                                    lockedUnits.toString(),
                                    asset.precision
                                )} ${asset.symbol}`
                            })}
                        </div>
                    ) : null}
                </div>
            </div>

            {error ? (
                <div className={styles.empty}>{error}</div>
            ) : (
                <div ref={host} className={styles.chart} />
            )}

            <div className={styles.foot}>
                <span>
                    {series
                        ? t("based_on", {
                              count: entries.length
                          })
                        : t("loading")}
                    {series && series.unresolved > 0
                        ? ` ${t("unresolved", {count: series.unresolved})}`
                        : ""}
                </span>
                <div className={styles.controls}>
                    <Select
                        className={styles.select}
                        value={assetId}
                        onChange={value => {
                            setAssetId(String(value));
                        }}
                    >
                        {balances.map(b => (
                            <Select.Option key={b.asset_id} value={b.asset_id}>
                                {assets[b.asset_id].symbol}
                            </Select.Option>
                        ))}
                    </Select>
                    {next ? (
                        <Button
                            className={styles.older}
                            disabled={loading}
                            onClick={() => loadPage(next, 1)}
                        >
                            {loading ? t("loading") : t("older")}
                        </Button>
                    ) : null}
                </div>
            </div>
        </section>
    );
}

/** The chart for the account that is currently selected (the Dashboard has no
 * account object at hand, only the name). */
export function CurrentAccountBalanceChart() {
    const accountState = useReduxState<any>(selectAccountState);
    const name: string | null =
        accountState.currentAccount || accountState.passwordAccount || null;
    const [id, setId] = React.useState<string | null>(null);
    React.useEffect(() => {
        setId(null);
        if (!name) return;
        let cancelled = false;
        SametFundActions.getAccountByName(name)
            .then(info => {
                if (!cancelled) setId(info ? info.id : null);
            })
            .catch(() => {
                if (!cancelled) setId(null);
            });
        return () => {
            cancelled = true;
        };
    }, [name]);
    return id ? (
        <BalanceHistoryChart accountId={id} accountName={name || ""} />
    ) : null;
}
