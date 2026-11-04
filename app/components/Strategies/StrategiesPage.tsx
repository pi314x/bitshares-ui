// Trading strategies (/strategies): a grid, a market maker or a dollar-cost average is defined, worked out (what it would earn
// after the fees), tested on the real prices of the last days, and run by a bot on PAPER: the bot follows the market's candles
// and works out which of its orders the price would have filled. It places no order and signs nothing.
//
// The logic is `lib/common/strategies.ts` (the engine and the calculators) and `lib/common/strategyStore.ts` (what is kept).
import * as React from "react";
import {
    getDefaultMarket,
    getMyMarketsBases,
    getMyMarketsQuotes
} from "branding";
import {Alert} from "../../design-system/Alert";
import {Button} from "../../design-system/Button";
import {Input} from "../../design-system/Input";
import {PageHead} from "../../design-system/PageHead";
import {SubMenu} from "../../design-system/SubMenu";
import {
    loadCandles,
    loadLastPrice,
    lookupAsset
} from "../../lib/chain/marketCandles";
import {loadHeldAssets} from "../../lib/chain/strategyChain";
import {AssetRef} from "../../lib/common/marketCandles";
import {
    BacktestResult,
    StrategyKind,
    StrategySpec,
    backtest,
    dcaCalc,
    gridCalc,
    makerCalc,
    specError,
    summarize
} from "../../lib/common/strategies";
import {TestedStrategy} from "../../lib/common/strategyOrders";
import {
    MAX_STRATEGIES,
    SavedStrategy,
    newStrategyId,
    startRun
} from "../../lib/common/strategyStore";
import {Candle} from "../../lib/common/strategies";
import {curvePaths} from "./curve";
import {idOf, useCurrentAccount} from "../Advanced/fields";
import {AssetPicker} from "./AssetPicker";
import {Field} from "./Field";
import PlaceOrders from "./PlaceOrders";
import {
    DEFAULT_FIELDS,
    Fields,
    fromSpec,
    parseNumber,
    suggest,
    toSpec
} from "./fields";
import {amountText, percentText, priceText, signed} from "./format";
import styles from "./StrategiesPage.module.scss";
import {t} from "./text";
import {useStrategyBots} from "./useStrategyBots";
import {useStrategyList} from "./useStrategyList";

const KINDS: StrategyKind[] = ["grid", "maker", "dca"];

const PERIODS = [
    {key: "1", days: 1, seconds: 300},
    {key: "7", days: 7, seconds: 3600},
    {key: "30", days: 30, seconds: 3600}
];

const CANDLES_FRESH_MS = 5 * 60 * 1000;

const errorText = (e: unknown): string =>
    String((e && (e as Error).message) || e).slice(0, 160);

interface Market {
    trade: AssetRef;
    priced: AssetRef;
    price: number;
}

type Test =
    | {status: "idle"}
    | {status: "loading"}
    | {status: "none"}
    | {status: "error"; error: string}
    | {
          status: "done";
          result: BacktestResult;
          spec: StrategySpec;
          trade: AssetRef;
          priced: AssetRef;
          days: number;
      };

const [DEFAULT_TRADE, DEFAULT_PRICED] = String(getDefaultMarket()).split("_");

const clock = (ms: number) => new Date(ms).toLocaleString();

const Stat = ({
    label,
    value,
    tone
}: {
    label: React.ReactNode;
    value: React.ReactNode;
    tone?: "up" | "down";
}) => (
    <div className={styles.stat}>
        <span className={styles.statLabel}>{label}</span>
        <span
            className={[
                styles.statValue,
                tone === "up" ? styles.up : tone === "down" ? styles.down : ""
            ]
                .filter(Boolean)
                .join(" ")}
        >
            {value}
        </span>
    </div>
);

const toneOf = (n: number): "up" | "down" | undefined =>
    n > 0 ? "up" : n < 0 ? "down" : undefined;

/** The trades of a test or a run, newest first. */
function Trades({
    events,
    trade,
    limit
}: {
    events: Array<{
        t: number;
        side: "buy" | "sell";
        price: number;
        size: number;
    }>;
    trade: AssetRef;
    limit: number;
}) {
    const shown = events.slice(-limit).reverse();
    if (!shown.length) return null;
    return (
        <ul className={styles.trades}>
            {shown.map((e, i) => (
                <li key={`${e.t}-${i}`}>
                    <span>
                        {t(e.side === "buy" ? "side_buy" : "side_sell", {
                            size: priceText(e.size),
                            trade: trade.symbol,
                            price: priceText(e.price)
                        })}
                    </span>
                    <span className={styles.tradeTime}>{clock(e.t)}</span>
                </li>
            ))}
        </ul>
    );
}

/** What a result says: the figures of a summary. */
function Figures({
    summary,
    priced
}: {
    summary: ReturnType<typeof summarize>;
    priced: AssetRef;
}) {
    return (
        <div className={styles.stats}>
            <Stat
                label={t("bt_pnl")}
                tone={toneOf(summary.pnl)}
                value={`${signed(summary.pnl)} ${priced.symbol} (${percentText(
                    summary.pnlPercent
                )}%)`}
            />
            <Stat
                label={t("bt_hold")}
                tone={toneOf(summary.holdPnl)}
                value={`${signed(summary.holdPnl)} ${
                    priced.symbol
                } (${percentText(summary.holdPercent)}%)`}
            />
            <Stat
                label={t("bt_fees")}
                value={`${amountText(summary.fees)} ${priced.symbol}`}
            />
            <Stat label={t("bt_fills")} value={summary.fills} />
            {summary.cycles !== undefined ? (
                <Stat label={t("bt_cycles")} value={summary.cycles} />
            ) : null}
            {summary.realized !== undefined ? (
                <Stat
                    label={t("bt_realized")}
                    tone={toneOf(summary.realized)}
                    value={`${signed(summary.realized)} ${priced.symbol}`}
                />
            ) : null}
            {summary.averageCost !== undefined ? (
                <Stat
                    label={t("bt_avg")}
                    value={`${priceText(summary.averageCost)} ${priced.symbol}`}
                />
            ) : null}
            {summary.breakEven !== undefined ? (
                <Stat
                    label={t("bt_even")}
                    value={`${priceText(summary.breakEven)} ${priced.symbol}`}
                />
            ) : null}
        </div>
    );
}

function Curve({curve}: {curve: BacktestResult["curve"]}) {
    const paths = curvePaths(curve, 600, 140);
    if (!paths) return null;
    return (
        <>
            <svg
                className={styles.curve}
                viewBox="0 0 600 140"
                preserveAspectRatio="none"
                role="img"
                aria-label={t("bt_curve")}
            >
                <line
                    className={styles.curveZero}
                    x1="0"
                    x2="600"
                    y1={paths.zero}
                    y2={paths.zero}
                />
                <path className={styles.curveHold} d={paths.hold} />
                <path className={styles.curveStrategy} d={paths.strategy} />
            </svg>
            <div className={styles.legend}>
                <span>
                    <span className={styles.swatchStrategy} />
                    {t("legend_strategy")}
                </span>
                <span>
                    <span className={styles.swatchHold} />
                    {t("legend_hold")}
                </span>
            </div>
        </>
    );
}

// ------------------------------------------------------------------ the page

export default function StrategiesPage(): JSX.Element {
    const list = useStrategyList();
    const {errors} = useStrategyBots(list);
    const [fields, setFields] = React.useState<Fields>(DEFAULT_FIELDS);
    const [tradeText, setTradeText] = React.useState(DEFAULT_TRADE || "BTS");
    const [pricedText, setPricedText] = React.useState(DEFAULT_PRICED || "CNY");
    const [market, setMarket] = React.useState<Market | null>(null);
    const [marketState, setMarketState] = React.useState<
        {status: "idle" | "loading"} | {status: "error"; error: string}
    >({status: "idle"});
    const [test, setTest] = React.useState<Test>({status: "idle"});
    const me = useCurrentAccount();
    const accountId = idOf(me.account);
    // the assets to choose from: what the account holds first, then the usual markets' assets
    const [held, setHeld] = React.useState<string[]>([]);
    const [period, setPeriod] = React.useState("7");
    const [name, setName] = React.useState("");
    const [saveNote, setSaveNote] = React.useState<"saved" | "full" | null>(
        null
    );
    const [startError, setStartError] = React.useState<Record<string, string>>(
        {}
    );
    const asked = React.useRef(0);
    const alive = React.useRef(true);
    const candles = React.useRef(
        new Map<string, {at: number; candles: Candle[]}>()
    );
    React.useEffect(() => {
        alive.current = true;
        return () => {
            alive.current = false;
        };
    }, []);

    // the assets the account holds (read when the account is known)
    React.useEffect(() => {
        if (!accountId) {
            setHeld([]);
            return;
        }
        let off = false;
        loadHeldAssets(accountId)
            .then(rows => {
                if (!off && alive.current) setHeld(rows.map(a => a.symbol));
            })
            .catch(() => {
                // (the usual assets are still there to choose from)
            });
        return () => {
            off = true;
        };
    }, [accountId]);
    const assetChoices = React.useMemo(
        () =>
            Array.from(
                new Set([
                    ...held,
                    ...(getMyMarketsBases() as string[]),
                    ...(getMyMarketsQuotes() as string[])
                ])
            ),
        [held]
    );

    const set = (change: Partial<Fields>) =>
        setFields(previous => ({...previous, ...change}));
    const spec = React.useMemo(() => toSpec(fields), [fields]);
    const problem = specError(spec);
    // what the last test was a test of (real orders are placed only for a strategy that was tested as it is)
    const tested: TestedStrategy | null =
        test.status === "done"
            ? {
                  spec: test.spec,
                  tradeId: test.trade.id,
                  pricedId: test.priced.id,
                  summary: test.result.summary,
                  candles: test.result.candles
              }
            : null;

    // ------------------------------------------------------------ the market

    const loadMarket = React.useCallback(
        async (
            tradeSymbol: string,
            pricedSymbol: string,
            suggestValues: boolean
        ) => {
            const mine = ++asked.current;
            setMarketState({status: "loading"});
            try {
                const [trade, priced] = await Promise.all([
                    lookupAsset(tradeSymbol),
                    lookupAsset(pricedSymbol)
                ]);
                if (!trade) {
                    throw new Error(
                        t("asset_not_found", {symbol: tradeSymbol})
                    );
                }
                if (!priced) {
                    throw new Error(
                        t("asset_not_found", {symbol: pricedSymbol})
                    );
                }
                if (trade.id === priced.id) throw new Error(t("same_assets"));
                const price = await loadLastPrice(trade, priced);
                if (price === null) throw new Error(t("no_prices"));
                if (!alive.current || mine !== asked.current) return;
                setMarket({trade, priced, price});
                setTradeText(trade.symbol);
                setPricedText(priced.symbol);
                if (suggestValues) {
                    setFields(f => ({...f, ...suggest(price, f)}));
                }
                setTest({status: "idle"});
                setMarketState({status: "idle"});
            } catch (e) {
                if (!alive.current || mine !== asked.current) return;
                setMarketState({status: "error", error: errorText(e)});
            }
        },
        []
    );
    // the default market is loaded when the page opens
    React.useEffect(() => {
        loadMarket(DEFAULT_TRADE || "BTS", DEFAULT_PRICED || "CNY", true);
    }, [loadMarket]);

    // ------------------------------------------------------------ the test

    const runTest = async () => {
        if (!market || problem) return;
        const chosen = PERIODS.find(p => p.key === period) || PERIODS[1];
        setTest({status: "loading"});
        try {
            const key = `${market.trade.id}|${market.priced.id}|${chosen.key}`;
            const kept = candles.current.get(key);
            let rows: Candle[];
            if (kept && Date.now() - kept.at < CANDLES_FRESH_MS) {
                rows = kept.candles;
            } else {
                const now = Date.now();
                rows = await loadCandles(
                    market.trade,
                    market.priced,
                    chosen.seconds,
                    now - chosen.days * 24 * 3600 * 1000,
                    now
                );
                candles.current.set(key, {at: now, candles: rows});
            }
            if (!alive.current) return;
            const result = backtest(spec, rows);
            setTest(
                result
                    ? {
                          status: "done",
                          result,
                          spec,
                          trade: market.trade,
                          priced: market.priced,
                          days: chosen.days
                      }
                    : {status: "none"}
            );
        } catch (e) {
            if (alive.current) setTest({status: "error", error: errorText(e)});
        }
    };

    // ------------------------------------------------------------ what is kept

    const kindLabel = (kind: StrategyKind) => t(`kind_${kind}`);
    const save = () => {
        if (!market || problem) return;
        const strategy: SavedStrategy = {
            id: newStrategyId(list.strategies.map(s => s.id)),
            name:
                name.trim() ||
                `${market.trade.symbol}/${market.priced.symbol} ${kindLabel(
                    spec.kind
                )}`,
            trade: market.trade,
            priced: market.priced,
            spec,
            savedAt: Date.now()
        };
        setSaveNote(list.add(strategy) ? "saved" : "full");
        setName("");
    };
    const start = async (s: SavedStrategy) => {
        setStartError(previous => ({...previous, [s.id]: ""}));
        try {
            const price = await loadLastPrice(s.trade, s.priced);
            if (price === null) throw new Error(t("no_prices"));
            if (!alive.current) return;
            list.update(s.id, cur => ({
                ...cur,
                run: startRun(cur.spec, price, Date.now())
            }));
        } catch (e) {
            if (alive.current) {
                setStartError(previous => ({
                    ...previous,
                    [s.id]: errorText(e)
                }));
            }
        }
    };
    const stop = (s: SavedStrategy) =>
        list.update(s.id, cur =>
            cur.run ? {...cur, run: {...cur.run, running: false}} : cur
        );
    const edit = (s: SavedStrategy) => {
        setFields(previous => fromSpec(s.spec, previous));
        setTradeText(s.trade.symbol);
        setPricedText(s.priced.symbol);
        loadMarket(s.trade.symbol, s.priced.symbol, false);
        setSaveNote(null);
    };

    // ------------------------------------------------------------ the pieces

    const priced = market ? market.priced.symbol : pricedText;
    const trade = market ? market.trade.symbol : tradeText;

    const number = (
        key: keyof Fields,
        label: React.ReactNode,
        owns: SpecErrorKeys[],
        help?: React.ReactNode
    ) => (
        <Field
            label={label}
            error={
                problem && owns.includes(problem) ? t(`err_${problem}`) : null
            }
            help={help}
        >
            <Input
                inputMode="decimal"
                autoComplete="off"
                value={fields[key] as string}
                aria-label={typeof label === "string" ? label : undefined}
                onChange={event => set({[key]: event.target.value})}
            />
        </Field>
    );

    const calcLines = (): React.ReactNode => {
        if (problem)
            return <p className={styles.error}>{t(`err_${problem}`)}</p>;
        if (!market) return <p className={styles.about}>{t("need_market")}</p>;
        const p = market.price;
        if (spec.kind === "grid") {
            const c = gridCalc(spec, p);
            return (
                <ul className={styles.lines}>
                    <li>
                        {t("calc_grid_steps", {
                            steps: c.steps,
                            min: percentText(c.stepMin),
                            max: percentText(c.stepMax),
                            even: percentText(c.breakEvenStep)
                        })}
                    </li>
                    <li>
                        {t("calc_grid_split", {
                            below: c.below,
                            above: c.above
                        })}
                    </li>
                    <li>
                        {t("calc_grid_size", {
                            size: priceText(c.size),
                            trade
                        })}
                    </li>
                    <li>
                        {t("calc_grid_round", {
                            profit: signed(c.perRound),
                            priced,
                            percent: percentText(c.perRoundPercent),
                            step: signed(c.perStep)
                        })}
                    </li>
                    {c.losingSteps > 0 ? (
                        <li className={styles.warn}>
                            {t("calc_grid_losing", {count: c.losingSteps})}
                        </li>
                    ) : null}
                    {!c.inRange ? (
                        <li className={styles.warn}>{t("calc_grid_range")}</li>
                    ) : null}
                </ul>
            );
        }
        if (spec.kind === "maker") {
            const trips = parseNumber(fields.trips);
            const c = makerCalc(spec, p, Number.isFinite(trips) ? trips : 0);
            return (
                <>
                    <ul className={styles.lines}>
                        <li>
                            {t("calc_maker_trip", {
                                profit: signed(c.trip),
                                priced,
                                percent: percentText(c.tripPercent)
                            })}
                        </li>
                        <li>
                            {t("calc_maker_even", {
                                spread: percentText(c.breakEvenSpread)
                            })}
                        </li>
                    </ul>
                    {number("trips", t("calc_maker_trips"), [])}
                    <ul className={styles.lines}>
                        <li>
                            {t("calc_maker_day", {
                                profit: signed(c.perDay),
                                priced,
                                percent: percentText(c.perDayPercent),
                                year: percentText(c.yearlyPercent, 0)
                            })}
                        </li>
                    </ul>
                </>
            );
        }
        const buys = parseNumber(fields.buys);
        const c = dcaCalc(
            spec,
            p,
            Number.isFinite(buys) && buys > 0 ? buys : 0
        );
        return (
            <>
                {number("buys", t("calc_dca_buys"), [])}
                <ul className={styles.lines}>
                    <li>
                        {t("calc_dca_total", {
                            buys: c.buys,
                            invested: amountText(c.invested),
                            priced,
                            asset: priceText(c.asset),
                            trade,
                            fees: amountText(c.fees)
                        })}
                    </li>
                    <li>
                        {t("calc_dca_even", {
                            rise: percentText(c.breakEvenRise)
                        })}
                    </li>
                </ul>
            </>
        );
    };

    return (
        <div className={styles.page}>
            <PageHead flush title={t("title")} lead={t("lead")} />

            <section className={styles.card}>
                <div className={styles.head}>
                    <h3 className={styles.title}>{t("strategy")}</h3>
                </div>
                <div className={styles.body}>
                    <SubMenu
                        aria-label={t("strategy")}
                        value={fields.kind}
                        onChange={key => set({kind: key as StrategyKind})}
                        items={KINDS.map(kind => ({
                            key: kind,
                            label: kindLabel(kind)
                        }))}
                    />
                    <p className={styles.about}>{t(`about_${fields.kind}`)}</p>

                    <div className={styles.fieldRow}>
                        <Field label={t("trade_asset")}>
                            <AssetPicker
                                value={tradeText}
                                options={assetChoices}
                                onChange={symbol => {
                                    setTradeText(symbol);
                                    loadMarket(symbol, pricedText.trim(), true);
                                }}
                            />
                        </Field>
                        <Field label={t("priced_asset")}>
                            <AssetPicker
                                value={pricedText}
                                options={assetChoices}
                                onChange={symbol => {
                                    setPricedText(symbol);
                                    loadMarket(tradeText.trim(), symbol, true);
                                }}
                            />
                        </Field>
                    </div>
                    <div className={styles.actions}>
                        <Button
                            disabled={marketState.status === "loading"}
                            onClick={() =>
                                loadMarket(
                                    tradeText.trim(),
                                    pricedText.trim(),
                                    true
                                )
                            }
                        >
                            {marketState.status === "loading"
                                ? t("loading")
                                : t("load_market")}
                        </Button>
                    </div>
                    {marketState.status === "error" ? (
                        <Alert
                            type="error"
                            showIcon
                            message={marketState.error}
                        />
                    ) : market ? (
                        <p className={styles.about}>
                            {t("price_now", {
                                price: priceText(market.price),
                                priced: market.priced.symbol,
                                trade: market.trade.symbol
                            })}
                        </p>
                    ) : null}

                    {fields.kind === "grid" ? (
                        <>
                            <div className={styles.fieldRow}>
                                {number("lower", t("f_lower"), ["grid_range"])}
                                {number("upper", t("f_upper"), ["grid_range"])}
                            </div>
                            <div className={styles.fieldRow}>
                                {number("lines", t("f_lines"), ["grid_lines"])}
                                {number(
                                    "gridInvestment",
                                    t("f_investment", {priced}),
                                    ["grid_investment"]
                                )}
                            </div>
                            <SubMenu
                                aria-label={t("f_spacing")}
                                value={fields.spacing}
                                onChange={key =>
                                    set({
                                        spacing: key as Fields["spacing"]
                                    })
                                }
                                items={[
                                    {
                                        key: "geometric",
                                        label: t("spacing_geometric")
                                    },
                                    {
                                        key: "arithmetic",
                                        label: t("spacing_arithmetic")
                                    }
                                ]}
                            />
                        </>
                    ) : fields.kind === "maker" ? (
                        <>
                            <div className={styles.fieldRow}>
                                {number("spread", t("f_spread"), [
                                    "maker_spread"
                                ])}
                                {number("size", t("f_size", {trade}), [
                                    "maker_size"
                                ])}
                            </div>
                            <div className={styles.fieldRow}>
                                {number(
                                    "makerInvestment",
                                    t("f_investment", {priced}),
                                    ["maker_investment"]
                                )}
                                {number("requote", t("f_requote"), [
                                    "maker_requote"
                                ])}
                            </div>
                        </>
                    ) : (
                        <div className={styles.fieldRow}>
                            {number("amount", t("f_amount", {priced}), [
                                "dca_amount"
                            ])}
                            {number("every", t("f_every"), ["dca_every"])}
                        </div>
                    )}

                    <div className={styles.fieldRow}>
                        {number(
                            "feePercent",
                            t("f_fee"),
                            ["fee"],
                            t("fee_help")
                        )}
                        {number("orderFee", t("f_order_fee", {priced}), [
                            "fee"
                        ])}
                    </div>
                </div>
            </section>

            <section className={styles.card}>
                <div className={styles.head}>
                    <h3 className={styles.title}>{t("calc_title")}</h3>
                </div>
                <div className={styles.body}>
                    {calcLines()}
                    <p className={styles.about}>{t("calc_note")}</p>
                </div>
            </section>

            <section className={styles.card}>
                <div className={styles.head}>
                    <h3 className={styles.title}>{t("bt_title")}</h3>
                </div>
                <div className={styles.body}>
                    <p className={styles.about}>{t("bt_lead")}</p>
                    <SubMenu
                        aria-label={t("bt_title")}
                        value={period}
                        onChange={setPeriod}
                        items={PERIODS.map(p => ({
                            key: p.key,
                            label: t(`bt_period_${p.key}`)
                        }))}
                    />
                    <div className={styles.actions}>
                        <Button
                            variant="accent"
                            disabled={
                                !market ||
                                !!problem ||
                                test.status === "loading"
                            }
                            onClick={runTest}
                        >
                            {test.status === "loading"
                                ? t("bt_running")
                                : t("bt_run")}
                        </Button>
                    </div>
                    {test.status === "error" ? (
                        <Alert type="error" showIcon message={test.error} />
                    ) : test.status === "none" ? (
                        <p className={styles.about}>{t("bt_none")}</p>
                    ) : test.status === "done" ? (
                        <>
                            <p className={styles.about}>
                                {t("bt_span", {
                                    from: clock(test.result.from),
                                    to: clock(test.result.to),
                                    count: test.result.candles
                                })}
                            </p>
                            <Figures
                                summary={test.result.summary}
                                priced={test.priced}
                            />
                            <Curve curve={test.result.curve} />
                            {test.result.events.length ? (
                                <>
                                    <h4 className={styles.subTitle}>
                                        {t("trades_title")}
                                    </h4>
                                    <Trades
                                        events={test.result.events}
                                        trade={test.trade}
                                        limit={10}
                                    />
                                </>
                            ) : (
                                <p className={styles.about}>
                                    {t("bt_no_fills")}
                                </p>
                            )}
                            <p className={styles.about}>{t("bt_assume")}</p>
                        </>
                    ) : null}
                </div>
            </section>

            <PlaceOrders
                spec={spec}
                market={market}
                tested={problem ? null : tested}
                account={{id: accountId, name: me.name}}
            />

            <section className={styles.card}>
                <div className={styles.head}>
                    <h3 className={styles.title}>{t("save_title")}</h3>
                </div>
                <div className={styles.body}>
                    <p className={styles.about}>{t("save_lead")}</p>
                    <div className={styles.saveRow}>
                        <Input
                            autoComplete="off"
                            placeholder={t("save_name")}
                            value={name}
                            aria-label={t("save_name")}
                            maxLength={80}
                            onChange={event => {
                                setName(event.target.value);
                                setSaveNote(null);
                            }}
                        />
                        <Button
                            variant="accent"
                            disabled={!market || !!problem}
                            onClick={save}
                        >
                            {t("save")}
                        </Button>
                    </div>
                    {saveNote === "saved" ? (
                        <p className={styles.about}>{t("saved")}</p>
                    ) : saveNote === "full" ? (
                        <p className={styles.error}>
                            {t("save_full", {max: MAX_STRATEGIES})}
                        </p>
                    ) : null}
                </div>
            </section>

            <section className={styles.card}>
                <div className={styles.head}>
                    <h3 className={styles.title}>{t("list_title")}</h3>
                </div>
                <div className={styles.body}>
                    <p className={styles.about}>{t("list_paper")}</p>
                </div>
                {list.strategies.length === 0 ? (
                    <div className={styles.empty}>{t("list_empty")}</div>
                ) : (
                    <div>
                        {list.strategies.map(s => {
                            const run = s.run;
                            const sum = run
                                ? summarize(run.state, s.spec, run.price)
                                : null;
                            const failure = errors[s.id] || startError[s.id];
                            return (
                                <div
                                    key={s.id}
                                    data-strategy={s.id}
                                    className={[
                                        styles.listRow,
                                        run && run.running
                                            ? styles.listRunning
                                            : ""
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                >
                                    <div className={styles.listHead}>
                                        <span className={styles.listName}>
                                            {s.name}
                                        </span>
                                        <span className={styles.listWhat}>
                                            {kindLabel(s.spec.kind)} ·{" "}
                                            {s.trade.symbol}/{s.priced.symbol}
                                        </span>
                                    </div>
                                    <span className={styles.about}>
                                        {run
                                            ? run.running
                                                ? t("status_running", {
                                                      since: clock(
                                                          run.startedAt
                                                      )
                                                  })
                                                : t("status_stopped")
                                            : t("status_idle")}
                                    </span>
                                    {sum && run ? (
                                        <>
                                            <Figures
                                                summary={sum}
                                                priced={s.priced}
                                            />
                                            <Trades
                                                events={run.events}
                                                trade={s.trade}
                                                limit={5}
                                            />
                                        </>
                                    ) : null}
                                    {failure ? (
                                        <p className={styles.error}>
                                            {failure === "gap"
                                                ? t("run_gap")
                                                : t("run_error", {
                                                      error: failure
                                                  })}
                                        </p>
                                    ) : null}
                                    <div className={styles.actions}>
                                        {run && run.running ? (
                                            <Button onClick={() => stop(s)}>
                                                {t("run_stop")}
                                            </Button>
                                        ) : (
                                            <Button
                                                variant="accent"
                                                onClick={() => start(s)}
                                            >
                                                {run
                                                    ? t("run_restart")
                                                    : t("run_start")}
                                            </Button>
                                        )}
                                        <Button onClick={() => edit(s)}>
                                            {t("run_edit")}
                                        </Button>
                                        <Button
                                            onClick={() => list.remove(s.id)}
                                        >
                                            {t("run_delete")}
                                        </Button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}

type SpecErrorKeys = NonNullable<ReturnType<typeof specError>>;
