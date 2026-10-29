// The dashboard as a desk: what the account is worth, what needs attention,
// what it holds, what is open (orders, pools, borrowed) and what it
// did lately. Every number is read from the chain through useDeskData; this
// file lays the cards out. Cards can be hidden (remembered in this browser).
import * as React from "react";
import counterpart from "counterpart";
import Immutable from "immutable";
import {Link, LinkProps, useNavigate} from "react-router-dom";
import {Select} from "../../../design-system/Select";
import {Input} from "../../../design-system/Input";
import {SubMenu} from "../../../design-system/SubMenu";
import SettingsActions from "../../../actions/SettingsActions";
import AccountActions from "../../../actions/AccountActions";
import {useReduxState} from "../../../next/hooks/useReduxState";
import {selectSettingsState} from "../../../store/slices/settingsSlice";
import {RecentTransactions} from "../../Account/RecentTransactions";
import {CurrentAccountBalanceChart} from "../../Account/BalanceHistoryChart";
import {AttentionItem, HoldingRow} from "../../../lib/common/desk";
import {DeskData, DeskPosition, useDeskData} from "./useDeskData";
import AssetLogo from "../../Utility/AssetLogo";
import AllocationChart from "./AllocationChart";
import styles from "./Desk.module.scss";

const TypedLink = Link as React.ComponentType<LinkProps>;
const TypedRecent = RecentTransactions as React.ComponentType<any>;

// The activity card shows everything the account's history holds (the node
// sends the last 100 operations), a page of 25 at a time, and can ask the node
// for older ones.
const ACTIVITY_LIMIT = 1000;
const ACTIVITY_PAGE_SIZE = 25;

/** The open orders are the portfolio's second tab: select it and go there. */
function useOpenOrders(accountName: string): () => void {
    const navigate = useNavigate();
    return React.useCallback(() => {
        (SettingsActions as any).changeViewSetting({overviewTab: 1});
        navigate(`/account/${accountName}`);
    }, [accountName, navigate]);
}

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`desk.${key}`, params);

// ------------------------------------------------------------------ helpers

function fmt(value: number, digits: number): string {
    if (!Number.isFinite(value)) return "-";
    try {
        return value.toLocaleString(undefined, {
            minimumFractionDigits: digits,
            maximumFractionDigits: digits
        });
    } catch (e) {
        return value.toFixed(digits);
    }
}

/** Digits for a value in `symbol`: a BTC-like unit is small numbers. */
function valueDigits(symbol: string | null | undefined): number {
    return symbol && symbol.indexOf("BTC") !== -1 ? 6 : 2;
}

/** An amount of an asset: enough digits to read it, not all 8. */
function amountDigits(amount: number): number {
    const abs = Math.abs(amount);
    return abs >= 1000 ? 2 : abs >= 1 ? 4 : 6;
}

function percent(fraction: number, digits = 1): string {
    return `${(fraction * 100).toFixed(digits)}%`;
}

/** A shimmering bar where a figure will be. */
function Skeleton({width = 96}: {width?: number}) {
    return (
        <span className={styles.skeleton} style={{width}} aria-hidden="true" />
    );
}

// -------------------------------------------------------------------- cards

const CARDS = [
    "attention",
    "chart",
    "allocation",
    "holdings",
    "positions",
    "activity",
    "accounts",
    "markets"
] as const;
type CardKey = typeof CARDS[number];

const CARDS_KEY = "__graphene__deskCards";

function readCards(): Record<CardKey, boolean> {
    const all = {} as Record<CardKey, boolean>;
    let saved: any = {};
    try {
        saved = JSON.parse(window.localStorage.getItem(CARDS_KEY) || "{}");
    } catch (e) {
        saved = {};
    }
    CARDS.forEach(key => {
        all[key] = !(saved && saved[key] === false);
    });
    return all;
}

function writeCards(cards: Record<CardKey, boolean>) {
    try {
        window.localStorage.setItem(CARDS_KEY, JSON.stringify(cards));
    } catch (e) {
        // not remembered
    }
}

function Card({
    title,
    action,
    flush,
    children
}: {
    title: React.ReactNode;
    action?: React.ReactNode;
    flush?: boolean;
    children: React.ReactNode;
}) {
    return (
        <section className={styles.card}>
            <div className={styles.head}>
                <h2 className={styles.title}>{title}</h2>
                {action}
            </div>
            <div className={flush ? styles.flush : styles.body}>{children}</div>
        </section>
    );
}

// ------------------------------------------------------------------ summary

function Summary({
    data,
    units
}: {
    data: DeskData;
    units: string[];
}): JSX.Element {
    const digits = valueDigits(data.unit && data.unit.symbol);
    const part = (label: string, value: number, sign = "") => (
        <div className={styles.part} key={label}>
            <div className={styles.partLabel}>{label}</div>
            <div className={styles.partValue}>
                {sign}
                {fmt(value, digits)}
            </div>
        </div>
    );
    return (
        <section className={styles.card}>
            <div className={styles.summary}>
                <div>
                    <div className={styles.totalLabel}>{t("total_value")}</div>
                    <div className={styles.total}>
                        {data.loading ? (
                            <Skeleton width={190} />
                        ) : (
                            fmt(data.total, digits)
                        )}
                        <span className={styles.totalUnit}>
                            {data.unit ? data.unit.symbol : ""}
                        </span>
                    </div>
                </div>
                <div className={styles.parts}>
                    {part(t("wallet"), data.parts.wallet)}
                    {data.parts.pools > 0
                        ? part(t("pools"), data.parts.pools)
                        : null}
                    {data.orders.count > 0
                        ? part(t("open_orders"), data.parts.orders)
                        : null}
                    {data.parts.collateral > 0
                        ? part(t("collateral"), data.parts.collateral)
                        : null}
                    {data.parts.debt > 0
                        ? part(t("debt"), data.parts.debt, "-")
                        : null}
                </div>
                <div>
                    <div className={styles.partLabel}>{t("unit")}</div>
                    <Select
                        style={{width: "110px"}}
                        value={data.unit ? data.unit.symbol : units[0]}
                        onChange={value =>
                            (SettingsActions as any).changeSetting({
                                setting: "unit",
                                value: String(value)
                            })
                        }
                    >
                        {units.map(symbol => (
                            <Select.Option key={symbol} value={symbol}>
                                {symbol}
                            </Select.Option>
                        ))}
                    </Select>
                </div>
            </div>
            {data.incomplete ? (
                <div className={styles.note}>{t("incomplete")}</div>
            ) : null}
            {data.unpriced > 0 ? (
                <div className={styles.note}>
                    {t("unpriced", {count: data.unpriced})}
                </div>
            ) : null}
        </section>
    );
}

// ---------------------------------------------------------------- attention

const ATTENTION_SHOWN = 4;

function attentionText(item: AttentionItem): string {
    const p = item.params;
    switch (item.kind) {
        case "called":
            return t("attention_called", {
                symbol: p.symbol,
                ratio: fmt(Number(p.ratio), 2)
            });
        case "margin":
            return t("attention_margin", {
                symbol: p.symbol,
                ratio: fmt(Number(p.ratio), 2),
                distance: percent(Number(p.distance), 0)
            });
        case "expiring":
            return t("attention_expiring", {count: p.count});
        default:
            return t("attention_stale", {minutes: p.minutes});
    }
}

function attentionTarget(
    item: AttentionItem,
    accountName: string,
    data: DeskData
): string | null {
    switch (item.kind) {
        case "called":
        case "margin": {
            const symbol = String(item.params.symbol);
            return `/asset/${symbol}`;
        }
        case "expiring":
            return null; // handled: opens the portfolio's open-orders tab
        default:
            return data.accountId ? "/settings/access" : null;
    }
}

function Attention({
    items,
    accountName,
    data
}: {
    items: AttentionItem[];
    accountName: string;
    data: DeskData;
}): JSX.Element | null {
    const [all, setAll] = React.useState(false);
    const openOrders = useOpenOrders(accountName);
    if (!items.length) return null;
    const shown = all ? items : items.slice(0, ATTENTION_SHOWN);
    return (
        <div
            className={styles.attention}
            role="list"
            aria-label={t("attention")}
        >
            {shown.map(item => {
                const to = attentionTarget(item, accountName, data);
                const level =
                    item.level === "danger"
                        ? styles.alertDanger
                        : item.level === "warn"
                        ? styles.alertWarn
                        : styles.alertInfo;
                return (
                    <div
                        key={item.key}
                        role="listitem"
                        className={`${styles.alert} ${level}`}
                    >
                        <span>{attentionText(item)}</span>
                        {to ? (
                            <TypedLink to={to}>{t("open")}</TypedLink>
                        ) : item.kind === "expiring" ? (
                            <button
                                type="button"
                                className={styles.linkBtn}
                                onClick={openOrders}
                            >
                                {t("open")}
                            </button>
                        ) : null}
                    </div>
                );
            })}
            {items.length > ATTENTION_SHOWN ? (
                <button
                    type="button"
                    className={styles.linkBtn}
                    onClick={() => setAll(a => !a)}
                >
                    {all
                        ? t("show_less")
                        : t("show_all", {count: items.length})}
                </button>
            ) : null}
        </div>
    );
}

// ----------------------------------------------------------------- holdings

const SHOWN_ROWS = 8;
const POOLS_SHOWN = 5;
const SETTLEMENTS_SHOWN = 5;
// a filter is for a list that is long enough to look through
const FILTER_FROM = 5;

function Holdings({
    data,
    coreSymbol
}: {
    data: DeskData;
    coreSymbol: string;
}): JSX.Element {
    const [all, setAll] = React.useState(false);
    const [filter, setFilter] = React.useState("");
    const query = filter.trim().toLowerCase();
    // a filter looks through all of them, not just the first rows
    const matching: HoldingRow[] = query
        ? data.holdings.filter(row => row.symbol.toLowerCase().includes(query))
        : data.holdings;
    const rows: HoldingRow[] =
        all || query ? matching : data.holdings.slice(0, SHOWN_ROWS);
    const digits = valueDigits(data.unit && data.unit.symbol);

    if (!data.holdings.length) {
        if (data.loading) {
            return (
                <div className={styles.skeletonRows}>
                    <Skeleton width={260} />
                    <Skeleton width={200} />
                    <Skeleton width={230} />
                </div>
            );
        }
        return <div className={styles.empty}>{t("no_holdings")}</div>;
    }
    return (
        <>
            {data.holdings.length > FILTER_FROM ? (
                <div className={styles.filter}>
                    <Input
                        type="search"
                        value={filter}
                        placeholder={t("filter_holdings")}
                        aria-label={t("filter_holdings")}
                        autoComplete="off"
                        onChange={event => setFilter(event.target.value)}
                    />
                </div>
            ) : null}
            <div className={styles.tableScroll}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th>{t("asset")}</th>
                            <th>{t("amount")}</th>
                            <th>
                                {t("value")}
                                {data.unit ? ` (${data.unit.symbol})` : ""}
                            </th>
                            <th className={styles.hideSmall}>{t("share")}</th>
                            <th className={styles.hideSmall} />
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map(row => (
                            <tr key={row.assetId}>
                                <td className={styles.asset}>
                                    <span className={styles.assetCell}>
                                        <AssetLogo
                                            symbol={row.symbol}
                                            size={20}
                                        />
                                        <TypedLink to={`/asset/${row.symbol}`}>
                                            {row.symbol}
                                        </TypedLink>
                                    </span>
                                </td>
                                <td className={styles.num}>
                                    {fmt(row.amount, amountDigits(row.amount))}
                                </td>
                                <td className={styles.num}>
                                    {row.value === null ? (
                                        <span className={styles.muted}>
                                            {t("no_price")}
                                        </span>
                                    ) : (
                                        fmt(row.value, digits)
                                    )}
                                </td>
                                <td
                                    className={`${styles.num} ${styles.hideSmall}`}
                                >
                                    {row.share === null ? (
                                        "-"
                                    ) : (
                                        <>
                                            <span className={styles.shareBar}>
                                                <span
                                                    className={styles.shareFill}
                                                    style={{
                                                        width: `${Math.max(
                                                            2,
                                                            row.share * 100
                                                        )}%`
                                                    }}
                                                />
                                            </span>
                                            {percent(row.share)}
                                        </>
                                    )}
                                </td>
                                <td className={styles.hideSmall}>
                                    {row.symbol !== coreSymbol ? (
                                        <TypedLink
                                            to={`/market/${row.symbol}_${coreSymbol}`}
                                        >
                                            {t("trade")}
                                        </TypedLink>
                                    ) : null}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {query && !matching.length ? (
                <div className={styles.empty}>
                    {t("no_match", {filter: filter.trim()})}
                </div>
            ) : null}
            {data.holdings.length > SHOWN_ROWS && !query ? (
                <div className={styles.more}>
                    <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={() => setAll(a => !a)}
                    >
                        {all
                            ? t("show_less")
                            : t("show_all", {count: data.holdings.length})}
                    </button>
                </div>
            ) : null}
        </>
    );
}

// --------------------------------------------------------------- allocation

type AllocationMode = "asset" | "place";

function Allocation({data}: {data: DeskData}): JSX.Element {
    const [mode, setMode] = React.useState<AllocationMode>("asset");
    const digits = valueDigits(data.unit && data.unit.symbol);
    const unitSymbol = data.unit ? data.unit.symbol : "";

    const parts = React.useMemo(
        () =>
            mode === "asset"
                ? data.holdings.map(row => ({
                      key: row.assetId,
                      label: row.symbol,
                      value: row.value
                  }))
                : [
                      {
                          key: "wallet",
                          label: t("wallet"),
                          value: data.parts.wallet
                      },
                      {
                          key: "orders",
                          label: t("open_orders"),
                          value: data.parts.orders
                      },
                      {
                          key: "pools",
                          label: t("pools"),
                          value: data.parts.pools
                      },
                      {
                          key: "collateral",
                          label: t("collateral"),
                          value: data.parts.collateral
                      }
                  ],
        [mode, data.holdings, data.parts]
    );
    // the whole the shares are of: what has a price (the pie never says more than it knows)
    const whole = parts.reduce(
        (sum, p) =>
            sum + (typeof p.value === "number" && p.value > 0 ? p.value : 0),
        0
    );

    if (data.loading && !data.holdings.length) {
        return (
            <div className={styles.skeletonRows}>
                <Skeleton width={260} />
                <Skeleton width={200} />
            </div>
        );
    }
    return (
        <>
            <div className={styles.allocationMenu}>
                <SubMenu
                    toggle
                    flush
                    aria-label={t("allocation")}
                    items={[
                        {key: "asset", label: t("by_asset")},
                        {key: "place", label: t("by_place")}
                    ]}
                    value={mode}
                    onChange={key => setMode(key as AllocationMode)}
                />
            </div>
            <AllocationChart
                parts={parts}
                otherLabel={count => t("other_n", {count})}
                totalText={fmt(whole, digits)}
                unitSymbol={unitSymbol}
                format={value => fmt(value, digits)}
                percent={share => percent(share)}
                emptyText={t("allocation_none")}
                ariaLabel={`${t("allocation")} (${
                    mode === "asset" ? t("by_asset") : t("by_place")
                })`}
                renderLabel={slice =>
                    mode === "asset" ? (
                        <span className={styles.assetCell}>
                            <AssetLogo symbol={slice.label} size={16} />
                            <TypedLink to={`/asset/${slice.label}`}>
                                {slice.label}
                            </TypedLink>
                        </span>
                    ) : (
                        slice.label
                    )
                }
            />
        </>
    );
}

// ---------------------------------------------------------------- positions

function riskBadge(position: DeskPosition): JSX.Element | null {
    if (position.risk.ratio === null) return null;
    const cls =
        position.risk.risk === "danger"
            ? `${styles.badge} ${styles.badgeDanger}`
            : position.risk.risk === "watch"
            ? `${styles.badge} ${styles.badgeWatch}`
            : styles.badge;
    const label =
        position.risk.distance !== null && position.risk.distance < 0
            ? t("risk_called")
            : t(`risk_${position.risk.risk}`);
    return <span className={cls}>{label}</span>;
}

function Positions({
    data,
    accountName
}: {
    data: DeskData;
    accountName: string;
}): JSX.Element {
    const openOrders = useOpenOrders(accountName);
    const unit = data.unit ? data.unit.symbol : "";
    const digits = valueDigits(unit);
    const when = (ms: number) =>
        new Date(ms).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        });
    const expiry =
        data.orders.nextExpiryMs !== null
            ? when(data.orders.nextExpiryMs)
            : null;
    return (
        <>
            <div className={styles.section}>
                <div className={styles.sectionHead}>
                    <span className={styles.sectionTitle}>
                        {t("open_orders")}
                    </span>
                    <button
                        type="button"
                        className={styles.linkBtn}
                        onClick={openOrders}
                    >
                        {t("open")}
                    </button>
                </div>
                {data.orders.count ? (
                    <div className={styles.row}>
                        <span>
                            {t("orders_count", {count: data.orders.count})}
                        </span>
                        <span className={styles.num}>
                            {data.orders.value !== null
                                ? `${fmt(data.orders.value, digits)} ${unit}`
                                : ""}
                        </span>
                        <span className={styles.rowSub}>
                            {expiry
                                ? t("orders_expiry_next", {when: expiry})
                                : t("orders_expiry_none")}
                        </span>
                    </div>
                ) : (
                    <div className={styles.muted}>
                        {data.loading ? (
                            <Skeleton width={120} />
                        ) : (
                            t("orders_none")
                        )}
                    </div>
                )}
            </div>

            <div className={styles.section}>
                <div className={styles.sectionHead}>
                    <span className={styles.sectionTitle}>{t("pools")}</span>
                    <TypedLink to="/pools">{t("open")}</TypedLink>
                </div>
                {data.pools.length ? (
                    data.pools.slice(0, POOLS_SHOWN).map(pool => (
                        <div className={styles.row} key={pool.id}>
                            <span>
                                {pool.symbolA} / {pool.symbolB}
                            </span>
                            <span className={styles.num}>
                                {pool.value !== null
                                    ? `${fmt(pool.value, digits)} ${unit}`
                                    : t("no_price")}
                            </span>
                            <span className={styles.rowSub}>
                                {t("pool_share", {
                                    percent: percent(pool.fraction, 3)
                                })}
                            </span>
                        </div>
                    ))
                ) : (
                    <div className={styles.muted}>
                        {data.loading ? (
                            <Skeleton width={120} />
                        ) : (
                            t("pools_none")
                        )}
                    </div>
                )}
                {data.pools.length > POOLS_SHOWN ? (
                    <div className={styles.muted}>
                        <TypedLink to="/pools">
                            {t("more_n", {
                                count: data.pools.length - POOLS_SHOWN
                            })}
                        </TypedLink>
                    </div>
                ) : null}
            </div>

            <div className={styles.section}>
                <div className={styles.sectionHead}>
                    <span className={styles.sectionTitle}>{t("borrowed")}</span>
                </div>
                {data.positions.length ? (
                    data.positions.map(position => (
                        <div className={styles.row} key={position.input.id}>
                            <span>
                                <TypedLink to={`/asset/${position.debtSymbol}`}>
                                    {position.debtSymbol}
                                </TypedLink>
                                {riskBadge(position)}
                            </span>
                            <span className={styles.num}>
                                {fmt(
                                    position.debt,
                                    amountDigits(position.debt)
                                )}{" "}
                                {position.debtSymbol}
                            </span>
                            <span className={styles.rowSub}>
                                {t("backed_by", {
                                    amount: fmt(
                                        position.collateral,
                                        amountDigits(position.collateral)
                                    ),
                                    symbol: position.collateralSymbol
                                })}
                                {position.risk.ratio !== null
                                    ? ` · ${t("ratio", {
                                          ratio: fmt(position.risk.ratio, 2)
                                      })}`
                                    : ""}
                                {position.risk.distance !== null &&
                                position.risk.distance >= 0
                                    ? ` · ${t("distance", {
                                          percent: percent(
                                              position.risk.distance,
                                              0
                                          )
                                      })}`
                                    : ""}
                            </span>
                        </div>
                    ))
                ) : (
                    <div className={styles.muted}>
                        {data.loading ? (
                            <Skeleton width={120} />
                        ) : (
                            t("borrow_none")
                        )}
                    </div>
                )}
            </div>

            <div className={styles.section}>
                <div className={styles.sectionHead}>
                    <span className={styles.sectionTitle}>
                        {t("settlements")}
                    </span>
                    {data.settlements.count ? (
                        <button
                            type="button"
                            className={styles.linkBtn}
                            onClick={openOrders}
                        >
                            {t("open")}
                        </button>
                    ) : null}
                </div>
                {data.settlements.items.length ? (
                    data.settlements.items
                        .slice(0, SETTLEMENTS_SHOWN)
                        .map(item => (
                            <div className={styles.row} key={item.id}>
                                <span>
                                    <TypedLink to={`/asset/${item.symbol}`}>
                                        {item.symbol}
                                    </TypedLink>
                                </span>
                                <span className={styles.num}>
                                    {fmt(item.amount, item.precision)}{" "}
                                    {item.symbol}
                                </span>
                                <span className={styles.rowSub}>
                                    {item.value !== null
                                        ? `≈ ${fmt(item.value, digits)} ${unit}`
                                        : t("no_price")}
                                    {item.dateMs !== null
                                        ? ` · ${t("settles_on", {
                                              when: when(item.dateMs)
                                          })}`
                                        : ""}
                                </span>
                            </div>
                        ))
                ) : (
                    <div className={styles.muted}>
                        {data.loading ? (
                            <Skeleton width={120} />
                        ) : (
                            t("settlements_none")
                        )}
                    </div>
                )}
                {data.settlements.items.length > SETTLEMENTS_SHOWN ? (
                    <div className={styles.muted}>
                        <button
                            type="button"
                            className={styles.linkBtn}
                            onClick={openOrders}
                        >
                            {t("more_n", {
                                count:
                                    data.settlements.items.length -
                                    SETTLEMENTS_SHOWN
                            })}
                        </button>
                    </div>
                ) : null}
            </div>
        </>
    );
}

// ----------------------------------------------------------------- accounts

function AccountRow({
    name,
    current,
    unitSymbol
}: {
    name: string;
    current: boolean;
    unitSymbol: string;
}): JSX.Element {
    const data = useDeskData(name, {light: true});
    const digits = valueDigits(unitSymbol);
    return (
        <button
            type="button"
            className={`${styles.accountRow} ${
                current ? styles.accountCurrent : ""
            }`}
            onClick={() =>
                (AccountActions as any).setCurrentAccount.defer(name)
            }
        >
            <span>
                {name}
                {current ? (
                    <span className={styles.muted}> · {t("current")}</span>
                ) : null}
            </span>
            <span className={styles.num}>
                {data.loading
                    ? "…"
                    : `${fmt(data.total, digits)} ${unitSymbol}`}
            </span>
        </button>
    );
}

// --------------------------------------------------------------------- desk

export interface DeskProps {
    accountName: string | null;
    /** every account the user can switch to (linked, password, starred) */
    accountNames: string[];
    /** the market tabs, rendered by the dashboard page */
    markets: React.ReactNode;
}

export default function Desk({
    accountName,
    accountNames,
    markets
}: DeskProps): JSX.Element {
    const settings = useReduxState<any>(selectSettingsState);
    const data = useDeskData(accountName);
    const [cards, setCards] = React.useState<Record<CardKey, boolean>>(
        readCards
    );
    const [customizing, setCustomizing] = React.useState(false);

    const units: string[] =
        settings.defaults && settings.defaults.unit
            ? settings.defaults.unit
            : ["BTS"];
    const coreSymbol = units[0] || "BTS";

    const toggle = (key: CardKey) => {
        const next = {...cards, [key]: !cards[key]};
        setCards(next);
        writeCards(next);
    };

    const name = accountName || "";
    const accountList = Immutable.List(data.accountId ? [data.accountId] : []);

    return (
        <div className={styles.desk}>
            <Summary data={data} units={units} />

            {cards.attention ? (
                <Attention
                    items={data.attention}
                    accountName={name}
                    data={data}
                />
            ) : null}

            {cards.chart ? <CurrentAccountBalanceChart /> : null}

            <div className={styles.grid}>
                {/* two columns of about the same height: what the account
                    holds and what it has at work on the left, what it is made
                    of and where it sits on the right. A column of its own
                    cards, not one grid row, so a long list of holdings does not
                    leave a hole under the short card beside it. */}
                {cards.holdings || cards.positions ? (
                    <div className={styles.stack}>
                        {cards.holdings ? (
                            <Card title={t("holdings")} flush>
                                <Holdings data={data} coreSymbol={coreSymbol} />
                            </Card>
                        ) : null}
                        {cards.positions ? (
                            <Card title={t("positions")} flush>
                                <Positions data={data} accountName={name} />
                            </Card>
                        ) : null}
                    </div>
                ) : null}
                {cards.allocation ||
                (cards.accounts && accountNames.length > 1) ? (
                    <div className={styles.stack}>
                        {cards.allocation ? (
                            <Card title={t("allocation")} flush>
                                <Allocation data={data} />
                            </Card>
                        ) : null}
                        {cards.accounts && accountNames.length > 1 ? (
                            <Card title={t("accounts")} flush>
                                {accountNames.map(n => (
                                    <AccountRow
                                        key={n}
                                        name={n}
                                        current={n === accountName}
                                        unitSymbol={
                                            data.unit
                                                ? data.unit.symbol
                                                : coreSymbol
                                        }
                                    />
                                ))}
                            </Card>
                        ) : null}
                    </div>
                ) : null}
            </div>

            {cards.activity && data.accountId ? (
                <Card title={t("activity")} flush>
                    <div className={styles.activity}>
                        <TypedRecent
                            accountsList={accountList}
                            compactView={true}
                            showMore={true}
                            fullHeight={true}
                            limit={ACTIVITY_LIMIT}
                            pageSize={ACTIVITY_PAGE_SIZE}
                            showFilters={false}
                            dashboard
                        />
                    </div>
                </Card>
            ) : null}

            {cards.markets ? markets : null}

            <div className={styles.toolbar}>
                <button
                    type="button"
                    className={styles.linkBtn}
                    aria-expanded={customizing}
                    onClick={() => setCustomizing(c => !c)}
                >
                    {t("customize")}
                </button>
            </div>
            {customizing ? (
                <div className={styles.customize}>
                    <span className={styles.muted}>{t("customize_hint")}</span>
                    {CARDS.map(key => (
                        <label key={key}>
                            <input
                                type="checkbox"
                                checked={cards[key]}
                                onChange={() => toggle(key)}
                            />
                            {t(`card_${key}`)}
                        </label>
                    ))}
                </div>
            ) : null}
        </div>
    );
}
