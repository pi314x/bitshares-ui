import * as React from "react";
import counterpart from "counterpart";
import {
    AreaSeries,
    LineSeries,
    ColorType,
    IChartApi,
    ISeriesApi,
    LineType,
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
import {Span, glideSpan, sameSpan} from "../../lib/common/rangeGlide";
import {changePercent, formatPercent} from "../../lib/common/balanceHistory";
import {useUnitValue} from "../../next/hooks/useUnitValue";
import styles from "./BalanceHistoryChart.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`balance_history.${key}`, params);

/** Pages (of 100 operations) loaded up front. */
const AUTO_PAGES = 5;
/** More pages fetched, one at a time, to reach back as far as a chosen
 * period (a week, a month) asks for. */
const EXTRA_PAGES = 5;
/** How long the view takes to move to a new period. */
const GLIDE_MS = 550;

function prefersReducedMotion(): boolean {
    try {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) {
        return false;
    }
}

type SeriesKey = "wallet" | "orders" | "total";
const SHOWN_KEY = "__graphene__balanceChartSeries";
const DEFAULT_SHOWN: Record<SeriesKey, boolean> = {
    wallet: true,
    orders: false,
    total: true
};

function readShown(): Record<SeriesKey, boolean> {
    try {
        const saved = JSON.parse(window.localStorage.getItem(SHOWN_KEY) || "");
        return {
            wallet: saved.wallet !== false,
            orders: saved.orders === true,
            total: saved.total !== false
        };
    } catch (e) {
        return DEFAULT_SHOWN;
    }
}

function writeShown(shown: Record<SeriesKey, boolean>) {
    try {
        window.localStorage.setItem(SHOWN_KEY, JSON.stringify(shown));
    } catch (e) {
        // not remembered
    }
}

type RangeKey = "1d" | "1w" | "1m" | "all";
const RANGES: RangeKey[] = ["1d", "1w", "1m", "all"];
const RANGE_SECONDS: Record<RangeKey, number> = {
    "1d": 86400,
    "1w": 7 * 86400,
    "1m": 30 * 86400,
    all: 0
};
const RANGE_KEY = "__graphene__balanceChartRange";

function readRange(): RangeKey {
    try {
        const saved = window.localStorage.getItem(RANGE_KEY) || "";
        return (RANGES as string[]).indexOf(saved) !== -1
            ? (saved as RangeKey)
            : "all";
    } catch (e) {
        return "all";
    }
}

/** "wss://api.bitshares.dev/ws" -> "api.bitshares.dev" */
function hostOf(url: string): string {
    return url.replace(/^wss?:\/\//, "").replace(/\/.*$/, "");
}

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
    // what the figures are worth in the currency chosen in the settings
    const unitValue = useUnitValue([assetId]);
    const [entries, setEntries] = React.useState<HistoryEntry[]>([]);
    const [times, setTimes] = React.useState<{[block: number]: number}>({});
    const [next, setNext] = React.useState<string | null>(null);
    const [lockedNow, setLockedNow] = React.useState<{
        [assetId: string]: string;
    }>({});
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    const [started, setStarted] = React.useState(false);
    const [shown, setShown] = React.useState<Record<SeriesKey, boolean>>(
        readShown
    );
    // a node other than the connected one supplied the older operations
    const [source, setSource] = React.useState<string | null>(null);
    const [range, setRange] = React.useState<RangeKey>(readRange);

    // balances, then the first page of history
    React.useEffect(() => {
        let cancelled = false;
        setStarted(false);
        setEntries([]);
        setTimes({});
        setNext(null);
        setSource(null);
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
            return BalanceHistoryActions.getHistoryPage(accountId, start)
                .then(({rows, source: from}) =>
                    BalanceHistoryActions.getBlockTimes(
                        rows.map(r => r.block_num)
                    ).then(blockTimes => {
                        if (from) setSource(from);
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
    const walletRef = React.useRef<ISeriesApi<"Area"> | null>(null);
    const ordersRef = React.useRef<ISeriesApi<"Line"> | null>(null);
    const totalRef = React.useRef<ISeriesApi<"Line"> | null>(null);
    // the view's glide: the animation frame in flight, and what the view was
    // last set for (so that only a new period or new data moves it)
    const glideFrame = React.useRef(0);
    const viewKey = React.useRef("");
    const drawnAsset = React.useRef("");

    const colors = {
        wallet: token("--accent", "#16b8f3"),
        orders: token("--warn", "#e0a43a"),
        total: token("--up", "#2fbf8f")
    };

    React.useEffect(() => {
        if (!host.current) return;
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
        const wallet = chart.addSeries(AreaSeries, {
            lineColor: colors.wallet,
            topColor: colors.wallet + "55",
            bottomColor: colors.wallet + "00",
            lineWidth: 2,
            lineType: LineType.Curved,
            priceLineVisible: false
        });
        // what sits in open orders
        const orders = chart.addSeries(LineSeries, {
            color: colors.orders,
            lineWidth: 2,
            lineType: LineType.Curved,
            priceLineVisible: false,
            lastValueVisible: false
        });
        // the whole holding: wallet and open orders - a solid line of its own
        // colour, so that it reads as a series like the others, not a guide
        const total = chart.addSeries(LineSeries, {
            color: colors.total,
            lineWidth: 2,
            lineType: LineType.Curved,
            priceLineVisible: false,
            lastValueVisible: false
        });
        chartRef.current = chart;
        walletRef.current = wallet;
        ordersRef.current = orders;
        totalRef.current = total;
        return () => {
            cancelAnimationFrame(glideFrame.current);
            chart.remove();
            chartRef.current = walletRef.current = null;
            ordersRef.current = totalRef.current = null;
            viewKey.current = "";
        };
    }, [assetId === "" ? "none" : "some"]);

    React.useEffect(() => {
        if (!walletRef.current || !series || !asset) return;
        const chart = chartRef.current;
        const timeScale = chart ? chart.timeScale() : null;
        // where the view is now, in times: it survives the data changing
        // (older history comes in at the left) so the move can start from it
        const before =
            timeScale && drawnAsset.current === assetId
                ? timeScale.getVisibleRange()
                : null;
        const precision = Math.min(asset.precision, 6);
        const format = {
            type: "price" as const,
            precision,
            minMove: 1 / Math.pow(10, precision)
        };
        const at = (p: {time: number}) => p.time as UTCTimestamp;
        const units = (v: bigint) => toNumber(v, asset.precision);
        if (walletRef.current) {
            walletRef.current.applyOptions({
                priceFormat: format,
                visible: shown.wallet
            });
            walletRef.current.setData(
                series.points.map(p => ({time: at(p), value: units(p.balance)}))
            );
        }
        if (ordersRef.current) {
            ordersRef.current.applyOptions({
                priceFormat: format,
                visible: shown.orders
            });
            ordersRef.current.setData(
                series.points.map(p => ({time: at(p), value: units(p.locked)}))
            );
        }
        if (totalRef.current) {
            totalRef.current.applyOptions({
                priceFormat: format,
                visible: shown.total
            });
            totalRef.current.setData(
                series.points.map(p => ({
                    time: at(p),
                    value: units(p.balance + p.locked)
                }))
            );
        }
        if (!chart || !timeScale) return;

        // The view follows the period and the data, not the choice of lines.
        const points = series.points;
        const n = points.length;
        const key = `${assetId}|${range}|${n}|${n ? points[n - 1].time : 0}|${
            n ? points[0].time : 0
        }`;
        if (key === viewKey.current) return;
        viewKey.current = key;
        drawnAsset.current = assetId;

        if (n < 2) {
            timeScale.fitContent();
            return;
        }
        const span = RANGE_SECONDS[range];
        const lastTime = points[n - 1].time;
        // the first bar inside the period (the whole history when it is
        // shorter); half a bar either side, as the chart itself fits
        const firstInside = span
            ? Math.max(
                  0,
                  points.findIndex(p => p.time >= lastTime - span)
              )
            : 0;
        const target: Span = {from: firstInside - 0.5, to: n - 1 + 0.5};

        cancelAnimationFrame(glideFrame.current);
        const a = before ? timeScale.timeToIndex(before.from, true) : null;
        const b = before ? timeScale.timeToIndex(before.to, true) : null;
        if (a === null || b === null || b <= a || prefersReducedMotion()) {
            timeScale.setVisibleLogicalRange(target);
            return;
        }
        const origin: Span = {from: a - 0.5, to: b + 0.5};
        timeScale.setVisibleLogicalRange(origin);
        if (sameSpan(origin, target)) return;
        const began = performance.now();
        // (the clock read here, not the frame's timestamp: one time base)
        const step = () => {
            const k = Math.min(1, (performance.now() - began) / GLIDE_MS);
            timeScale.setVisibleLogicalRange(glideSpan(origin, target, k));
            if (k < 1) glideFrame.current = requestAnimationFrame(step);
        };
        glideFrame.current = requestAnimationFrame(step);
        // eslint-disable-next-line
    }, [series, asset, shown, range]);

    // A period longer than the history loaded so far: fetch older operations
    // (a few pages, one after the other) so the period has something to show;
    // each page widens the chart through the same glide.
    const extraPages = React.useRef(0);
    React.useEffect(() => {
        extraPages.current = 0;
    }, [range, accountId, assetId]);
    React.useEffect(() => {
        const span = RANGE_SECONDS[range];
        if (!span || !series || !next || loading) return;
        if (extraPages.current >= EXTRA_PAGES) return;
        const points = series.points;
        if (!points.length) return;
        const lastTime = points[points.length - 1].time;
        if (points[0].time > lastTime - span) {
            extraPages.current += 1;
            loadPage(next, 1);
        }
    }, [range, series, next, loading]);

    const toggle = (key: SeriesKey) => {
        setShown(prev => {
            const next = {...prev, [key]: !prev[key]};
            // a chart with nothing on it is not an option
            if (!next.wallet && !next.orders && !next.total) return prev;
            writeShown(next);
            return next;
        });
    };

    if (!balances.length && !error) return null;

    const lockedUnits = BigInt(lockedNow[assetId] || "0");
    const walletUnits = current ? BigInt(current.amount) : BigInt(0);
    // the balance at the start of the chosen range: the last point at or
    // before it (the balance carried into the period), else the first point
    let first = series && series.points.length ? series.points[0] : null;
    if (series && series.points.length && RANGE_SECONDS[range]) {
        const lastTime = series.points[series.points.length - 1].time;
        const startAt = lastTime - RANGE_SECONDS[range];
        const before = series.points.filter(p => p.time <= startAt);
        if (before.length) first = before[before.length - 1];
    }
    const change =
        series && first && current ? walletUnits - first.balance : null;
    const percent =
        change !== null && first ? changePercent(change, first.balance) : null;
    const anyOrders =
        lockedUnits > BigInt(0) ||
        (series ? series.points.some(p => p.locked > BigInt(0)) : false);
    const figure = (units: bigint) =>
        asset
            ? `${formatAmount(units.toString(), asset.precision)} ${
                  asset.symbol
              }`
            : "-";

    // under a figure: what it is worth in the chosen currency (not for the
    // currency itself, and not without a price)
    const worth = (units: bigint): string | null =>
        asset && unitValue.unit && unitValue.unit.symbol !== asset.symbol
            ? unitValue.format(assetId, units)
            : null;

    const choices: {key: SeriesKey; label: string; value: bigint}[] = [
        {key: "wallet", label: t("wallet"), value: walletUnits},
        {key: "orders", label: t("orders"), value: lockedUnits},
        {key: "total", label: t("total"), value: walletUnits + lockedUnits}
    ];

    return (
        <section className={styles.card} aria-label={t("title")}>
            <div className={styles.head}>
                <h3 className={styles.title}>{t("title")}</h3>
                <div
                    className={styles.ranges}
                    role="group"
                    aria-label={t("range")}
                >
                    {RANGES.map(key => (
                        <button
                            key={key}
                            type="button"
                            aria-pressed={range === key}
                            className={`${styles.rangeBtn} ${
                                range === key ? styles.rangeOn : ""
                            }`}
                            onClick={() => {
                                setRange(key);
                                try {
                                    window.localStorage.setItem(RANGE_KEY, key);
                                } catch (e) {
                                    // not remembered
                                }
                            }}
                        >
                            {t(`range_${key}`)}
                        </button>
                    ))}
                </div>
            </div>
            <div className={styles.headFigures}>
                <div className={styles.figures} role="group">
                    {choices.map(choice => {
                        const unavailable =
                            choice.key !== "wallet" && !anyOrders;
                        return (
                            <button
                                key={choice.key}
                                type="button"
                                className={`${styles.figure} ${
                                    shown[choice.key] && !unavailable
                                        ? styles.figureOn
                                        : ""
                                }`}
                                aria-pressed={shown[choice.key]}
                                disabled={unavailable}
                                title={unavailable ? t("no_orders") : undefined}
                                onClick={() => toggle(choice.key)}
                            >
                                <span className={styles.figureLabel}>
                                    <span
                                        className={styles.swatch}
                                        style={{background: colors[choice.key]}}
                                    />
                                    {choice.label}
                                </span>
                                <span className={styles.figureValue}>
                                    {figure(choice.value)}
                                </span>
                                {worth(choice.value) ? (
                                    <span className={styles.figureWorth}>
                                        ≈ {worth(choice.value)}
                                    </span>
                                ) : null}
                            </button>
                        );
                    })}
                </div>
                {change !== null && asset && change !== BigInt(0) ? (
                    <div
                        className={`${styles.change} ${
                            change > BigInt(0) ? styles.up : styles.down
                        }`}
                    >
                        {change > BigInt(0) ? "+" : ""}
                        {formatAmount(change, asset.precision)}
                        {percent !== null
                            ? ` (${formatPercent(percent)})`
                            : ""}{" "}
                        {t("over_period")}
                    </div>
                ) : null}
            </div>

            {error ? (
                <div className={styles.empty}>{error}</div>
            ) : (
                <div ref={host} className={styles.chart} />
            )}

            <div className={styles.foot}>
                <span>
                    {series
                        ? next || loading
                            ? t("based_on", {count: entries.length})
                            : t("whole_history", {count: entries.length})
                        : t("loading")}
                    {series && series.unresolved > 0
                        ? ` ${t("unresolved", {count: series.unresolved})}`
                        : ""}
                    {source ? ` ${t("from_node", {node: hostOf(source)})}` : ""}
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
