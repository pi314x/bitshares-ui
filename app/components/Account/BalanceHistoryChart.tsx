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
import AssetLabel from "../Utility/AssetLabel";
import {Button} from "../../design-system/Button";
import {SubMenu} from "../../design-system/SubMenu";
import BalanceHistoryActions from "../../actions/BalanceHistoryActions";
import {balanceHistory} from "../../lib/chain/balanceHistoryLoader";
import {useBalanceHistory} from "../../next/hooks/useBalanceHistory";
import {AssetInfo, BalanceInfo} from "../../actions/SametFundActions";
import {buildBalanceSeries} from "../../lib/common/balanceHistory";
import {formatAmount} from "../../lib/common/sametFunds";
import {
    Span,
    glideSpan,
    sameSpan,
    targetSpan
} from "../../lib/common/rangeGlide";
import {changePercent, formatPercent} from "../../lib/common/balanceHistory";
import {useUnitValue} from "../../next/hooks/useUnitValue";
import styles from "./BalanceHistoryChart.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`balance_history.${key}`, params);

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

// how often, and how soon after a failed ask for the balances, it is tried again
const RETRIES = 3;
const RETRY_AFTER_MS = 3000;

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
    // The account's operations: newest first, then the older ones page by page in the
    // background, kept on this device (lib/common/balanceHistoryStore.ts). The store
    // goes on loading when this screen is left for the other one that draws the chart.
    const history = useBalanceHistory(accountId, assetId !== "");
    const {entries, times} = history;
    const [lockedNow, setLockedNow] = React.useState<{
        [assetId: string]: string;
    }>({});
    const [error, setError] = React.useState<string | null>(null);
    // the balances have been asked for (answered or failed): an account with none is said so
    const [loaded, setLoaded] = React.useState(false);
    const [shown, setShown] = React.useState<Record<SeriesKey, boolean>>(
        readShown
    );
    const [range, setRange] = React.useState<RangeKey>(readRange);

    // the balances; a failed ask is made again a few times (the connection may just have been
    // re-made) before the error is left on the card
    React.useEffect(() => {
        let cancelled = false;
        let retry: ReturnType<typeof setTimeout> | undefined;
        setLoaded(false);
        setError(null);
        BalanceHistoryActions.getLockedInOrders(accountId).then(locked => {
            if (!cancelled) setLockedNow(locked || {});
        });
        const load = (attempt: number) =>
            BalanceHistoryActions.getBalances(accountId)
                .then(rows =>
                    BalanceHistoryActions.getAssets(
                        rows.map(r => r.asset_id)
                    ).then(infos => {
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
                        setLoaded(true);
                    })
                )
                .catch(err => {
                    if (cancelled) return;
                    if (attempt < RETRIES) {
                        retry = setTimeout(
                            () => load(attempt + 1),
                            RETRY_AFTER_MS
                        );
                    } else {
                        setError(String((err && err.message) || err));
                        setLoaded(true);
                    }
                });
        load(0);
        return () => {
            cancelled = true;
            if (retry) clearTimeout(retry);
        };
    }, [accountId]);

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

    // older history is still being loaded in the background (a period the user chose
    // is shown at once, so only the default "All" holds back)
    const rangeChosen = React.useRef(false);
    const anchorFrom = React.useRef<number | null>(null);
    React.useEffect(() => {
        anchorFrom.current = null;
        rangeChosen.current = false;
    }, [accountId]);
    const streaming = history.loading && !history.complete;

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
        // A balance is what it was after the last operation until the next one: the
        // lines are steps. A curve drew a smooth rise and fall (and overshoots) between
        // two points that never existed.
        const wallet = chart.addSeries(AreaSeries, {
            lineColor: colors.wallet,
            topColor: colors.wallet + "55",
            bottomColor: colors.wallet + "00",
            lineWidth: 2,
            lineType: LineType.WithSteps,
            priceLineVisible: false
        });
        // what sits in open orders
        const orders = chart.addSeries(LineSeries, {
            color: colors.orders,
            lineWidth: 2,
            lineType: LineType.WithSteps,
            priceLineVisible: false,
            lastValueVisible: false
        });
        // the whole holding: wallet and open orders - a solid line of its own
        // colour, so that it reads as a series like the others, not a guide
        const total = chart.addSeries(LineSeries, {
            color: colors.total,
            lineWidth: 2,
            lineType: LineType.WithSteps,
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
        // The most recent data first: while older history is still arriving, the
        // view stays on what was there when the chart was first drawn (the newest
        // operations) instead of zooming out with every page; when the history is
        // all in, or when a period is chosen, it moves there in one glide.
        if (n >= 2 && anchorFrom.current === null) {
            anchorFrom.current = points[0].time;
        }
        const holding =
            streaming &&
            range === "all" &&
            !rangeChosen.current &&
            anchorFrom.current !== null;
        const key = `${assetId}|${range}|${holding}|${n}|${
            n ? points[n - 1].time : 0
        }|${n ? points[0].time : 0}`;
        if (key === viewKey.current) return;
        viewKey.current = key;
        drawnAsset.current = assetId;

        if (n < 2) {
            timeScale.fitContent();
            return;
        }
        const target = targetSpan(
            points.map(p => p.time),
            RANGE_SECONDS[range],
            holding ? anchorFrom.current : null
        );

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
    }, [series, asset, shown, range, streaming]);

    const toggle = (key: SeriesKey) => {
        setShown(prev => {
            const next = {...prev, [key]: !prev[key]};
            // a chart with nothing on it is not an option
            if (!next.wallet && !next.orders && !next.total) return prev;
            writeShown(next);
            return next;
        });
    };

    // The card is always there: nothing on a page where the chart belongs reads as a chart
    // that is missing. While the balances load it says so, and an account with none says that.
    if (!balances.length && !error) {
        return (
            <section className={styles.card} aria-label={t("title")}>
                <div className={styles.head}>
                    <h3 className={styles.title}>{t("title")}</h3>
                </div>
                <div className={styles.empty}>
                    {loaded ? t("no_balances") : t("loading")}
                </div>
            </section>
        );
    }

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
                <div className={styles.controls}>
                    {/* the currency the chart is drawn for, beside the range; typing in
                        the open list narrows it to the assets whose symbol matches */}
                    <Select
                        showSearch
                        className={styles.select}
                        dropdownMatchSelectWidth={false}
                        value={assetId}
                        onChange={value => {
                            setAssetId(String(value));
                        }}
                        notFoundContent={t("no_asset")}
                        filterOption={(input, option) =>
                            (assets[String(option.value)]?.symbol || "")
                                .toLowerCase()
                                .indexOf(input.trim().toLowerCase()) !== -1
                        }
                    >
                        {balances.map(b => (
                            <Select.Option key={b.asset_id} value={b.asset_id}>
                                <AssetLabel
                                    symbol={assets[b.asset_id].symbol}
                                />
                            </Select.Option>
                        ))}
                    </Select>
                    <SubMenu
                        toggle
                        flush
                        aria-label={t("range")}
                        items={RANGES.map(key => ({
                            key,
                            label: t(`range_${key}`)
                        }))}
                        value={range}
                        onChange={key => {
                            rangeChosen.current = true;
                            setRange(key as RangeKey);
                            try {
                                window.localStorage.setItem(RANGE_KEY, key);
                            } catch (e) {
                                // not remembered
                            }
                        }}
                    />
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
                        ? history.complete
                            ? history.capped
                                ? t("capped", {count: entries.length})
                                : t("whole_history", {count: entries.length})
                            : history.loading
                            ? t("loading_history", {count: entries.length})
                            : t("based_on", {count: entries.length})
                        : t("loading")}
                    {series && series.unresolved > 0
                        ? ` ${t("unresolved", {count: series.unresolved})}`
                        : ""}
                    {history.source
                        ? ` ${t("from_node", {node: hostOf(history.source)})}`
                        : ""}
                    {history.error ? ` ${history.error}` : ""}
                </span>
                {!history.complete && !history.loading ? (
                    <Button
                        className={styles.older}
                        onClick={() => balanceHistory.start(accountId)}
                    >
                        {t("retry")}
                    </Button>
                ) : null}
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
