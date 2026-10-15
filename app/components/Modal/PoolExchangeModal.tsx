// The swap dialog for a liquidity pool, laid out like the swap screens people
// know: "You pay" on top, "You receive" below, an arrow between them, and the
// details (price, price impact, fee, the least that will be accepted) under
// both. Typing in either field works out the other: sell 100 and see what it
// buys, or ask for 13 and see what it costs.
//
// The quote is the chain's own arithmetic in integers (lib/common/poolSwap.ts)
// at the pool's current balances; the transaction carries `amount_to_sell` and
// a `min_to_receive` reduced by the slippage the user accepts. The same sale is
// walked through the order book (lib/common/priceCompare.ts) to say where the
// price is better.
//
// Signing: `onSubmit` calls `ApplicationApi.liquidityPoolExchange(account, pool,
// sellSymbol, amountToSell, receiveSymbol, minToReceive)` exactly as the dialog
// always did; nothing else here builds or signs a transaction. Stable pools use
// another curve, which is not computed here: they keep the two plain fields
// (amount to sell and the least to receive, both typed by hand).
import * as React from "react";
import {Link} from "react-router-dom";
import Translate from "react-translate-component";
import counterpart from "counterpart";
import {Apis} from "bitsharesjs-ws";
import {Modal} from "../../design-system/Modal";
import {Button} from "../../design-system/Button";
import {Alert} from "../../design-system/Alert";
import ApplicationApi from "api/ApplicationApi";
import AssetName from "../Utility/AssetName";
import {ChainStore} from "bitsharesjs";
import {estimateFeeAsync} from "common/trxHelper";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectAccountState} from "../../store/slices/accountSlice";
import {useChainStoreTick} from "../../next/hooks/useChainStoreTick";
import {
    MarketFee,
    NO_MARKET_FEE,
    SwapPool,
    SwapQuote,
    minReceive,
    priceImpact,
    quoteExactIn,
    quoteExactOut
} from "../../lib/common/poolSwap";
import {
    BookFill,
    BookOrder,
    compareVenues,
    fillFromOrderBook
} from "../../lib/common/priceCompare";
import {formatPercent, formatPrice} from "../../lib/common/poolMetrics";
import styles from "./PoolExchangeModal.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`poolmart.swap.${key}`, params);

const SLIPPAGE_CHOICES = [0.001, 0.005, 0.01];

// 10^n as a BigInt. Not `**`: the build turns that into Math.pow, which cannot
// take a BigInt.
function pow10(n: number): bigint {
    return BigInt("1" + "0".repeat(n));
}

/** "12.5" -> smallest units (BigInt), null for text that is not an amount or
 * has more decimals than the asset has. */
function parseUnits(text: string, precision: number): bigint | null {
    if (!/^\d*\.?\d*$/.test(text) || text === "" || text === ".") return null;
    const [whole, fraction = ""] = text.split(".");
    if (fraction.length > precision) return null;
    return (
        BigInt(whole || "0") * pow10(precision) +
        BigInt((fraction + "0".repeat(precision)).slice(0, precision) || "0")
    );
}

/** Smallest units -> "12.5" (no trailing zeros). */
function formatUnits(units: bigint, precision: number): string {
    const base = pow10(precision);
    const whole = units / base;
    const fraction = (units % base).toString().padStart(precision, "0");
    const trimmed = fraction.replace(/0+$/, "");
    return trimmed ? `${whole}.${trimmed}` : `${whole}`;
}

function marketFeeOf(asset: any): MarketFee {
    const options = asset.get("options");
    if (!options) return NO_MARKET_FEE;
    const flags = Number(options.get("flags") || 0);
    const extensions = options.get("extensions");
    const taker =
        extensions && extensions.get && extensions.get("taker_fee_percent");
    return {
        charges: flags % 2 === 1,
        makerPercent: Number(options.get("market_fee_percent") || 0),
        takerPercent:
            taker === undefined || taker === null ? null : Number(taker),
        max: BigInt(String(options.get("max_market_fee") || 0))
    };
}

/** The open limit orders of the pair, refreshed while the dialog is open. */
function useOrderBook(payId: string, receiveId: string): BookOrder[] | null {
    const [orders, setOrders] = React.useState<BookOrder[] | null>(null);
    React.useEffect(() => {
        let cancelled = false;
        setOrders(null);
        const load = () =>
            (Apis as any)
                .instance()
                .db_api()
                .exec("get_limit_orders", [payId, receiveId, 300])
                .then((rows: BookOrder[]) => {
                    if (!cancelled) setOrders(rows || []);
                })
                .catch(() => {
                    if (!cancelled) setOrders(null);
                });
        load();
        const timer = setInterval(load, 15000);
        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [payId, receiveId]);
    return orders;
}

interface PoolExchangeModalCoreProps {
    pool: any;
    account: any;
    isModalVisible: boolean;
    onHideModal: () => void;
}

function PoolExchangeModalCore({
    pool,
    account,
    isModalVisible,
    onHideModal
}: PoolExchangeModalCoreProps) {
    useChainStoreTick();
    // which side of the pool is sold
    const [sold, setSold] = React.useState<"a" | "b">("a");
    // the field the user is typing in, and what is typed there
    const [active, setActive] = React.useState<"pay" | "receive">("pay");
    const [typed, setTyped] = React.useState("");
    // stable pools: the least to receive, typed by hand
    const [manualMin, setManualMin] = React.useState("");
    const [slippage, setSlippage] = React.useState(0.005);
    const [customSlippage, setCustomSlippage] = React.useState("");
    const [error, setError] = React.useState<string | null>(null);
    const [submitting, setSubmitting] = React.useState(false);
    const [feeReserve, setFeeReserve] = React.useState<bigint>(BigInt(0));

    const valid = !!pool && pool.size !== 0;
    const bought: "a" | "b" = sold === "a" ? "b" : "a";
    const assetIn = valid ? pool.get(`asset_${sold}`) : null;
    const assetOut = valid ? pool.get(`asset_${bought}`) : null;

    // the fee of the exchange operation, kept back when everything of the core
    // asset is offered
    React.useEffect(() => {
        let cancelled = false;
        estimateFeeAsync("liquidity_pool_exchange")
            .then((fee: number) => {
                if (!cancelled) setFeeReserve(BigInt(Math.ceil(fee || 0)));
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);

    const idIn: string = assetIn ? assetIn.get("id") : "";
    const idOut: string = assetOut ? assetOut.get("id") : "";
    const book = useOrderBook(idIn, idOut);

    if (!valid || !assetIn || !assetOut) return null;

    const precisionIn: number = assetIn.get("precision");
    const precisionOut: number = assetOut.get("precision");
    const symbolIn: string = assetIn.get("symbol");
    const symbolOut: string = assetOut.get("symbol");
    const stable =
        pool.get("pool_type") === 1 || pool.get("pool_type") === "stable";

    const swapPool: SwapPool = {
        balanceIn: BigInt(String(pool.get(`balance_${sold}`))),
        balanceOut: BigInt(String(pool.get(`balance_${bought}`))),
        takerFeePercent: Number(pool.get("taker_fee_percent") || 0),
        feeIn: marketFeeOf(assetIn),
        feeOut: marketFeeOf(assetOut),
        stable
    };

    const balanceOf = (asset: any): bigint => {
        const accountObject: any = (ChainStore as any).getAccount(account);
        if (!accountObject || typeof accountObject.getIn !== "function") {
            return BigInt(0);
        }
        const balanceId = accountObject.getIn(["balances", asset.get("id")]);
        const balanceObject = balanceId
            ? (ChainStore as any).getObject(balanceId)
            : null;
        return balanceObject
            ? BigInt(String(balanceObject.get("balance")))
            : BigInt(0);
    };
    const balanceIn = balanceOf(assetIn);
    const balanceOut = balanceOf(assetOut);

    // ---- the two fields: one typed, the other worked out -----------------
    const typedUnits = parseUnits(
        typed,
        active === "pay" ? precisionIn : precisionOut
    );
    let quote: SwapQuote | null = null;
    if (!stable && typedUnits !== null) {
        quote =
            active === "pay"
                ? quoteExactIn(swapPool, typedUnits)
                : quoteExactOut(swapPool, typedUnits);
    }
    const payUnits: bigint | null = stable
        ? parseUnits(typed, precisionIn)
        : quote
        ? quote.pay
        : null;
    const minUnits: bigint | null = stable
        ? parseUnits(manualMin, precisionOut)
        : quote
        ? minReceive(quote.receive, slippage)
        : null;

    const payText =
        active === "pay" || stable
            ? typed
            : quote
            ? formatUnits(quote.pay, precisionIn)
            : "";
    const receiveText =
        active === "receive"
            ? typed
            : quote
            ? formatUnits(quote.receive, precisionOut)
            : "";

    const impact = quote ? priceImpact(quote) : null;
    const price =
        quote && quote.pay > BigInt(0)
            ? Number(quote.receive) /
              Math.pow(10, precisionOut) /
              (Number(quote.pay) / Math.pow(10, precisionIn))
            : null;

    // ---- the order book against the pool ---------------------------------
    let bookFill: BookFill | null = null;
    if (quote && book) {
        bookFill = fillFromOrderBook(
            book,
            idIn,
            idOut,
            quote.pay,
            swapPool.feeOut
        );
    }
    const venues =
        quote && bookFill ? compareVenues(quote.receive, bookFill) : null;

    // ---- what the button says ----------------------------------------------
    let blocker: string | null = null;
    if (!account) blocker = t("log_in");
    else if (!typed) blocker = t("enter_amount");
    else if (typedUnits === null) blocker = t("enter_amount");
    else if (!stable && !quote) blocker = t("cannot_fill");
    else if (stable && !minUnits) blocker = t("enter_minimum");
    else if (payUnits !== null && payUnits > balanceIn) {
        blocker = t("insufficient", {asset: symbolIn});
    }

    // Switching the direction keeps the numbers the user typed: each amount
    // stays with its asset, so what was typed as "pay" is now the amount
    // to receive in that same asset, and the other side is worked out again.
    const onFlip = () => {
        setSold(bought);
        if (stable) {
            // two typed amounts: they trade places with their assets
            setTyped(manualMin);
            setManualMin(typed);
        } else {
            setActive(active === "pay" ? "receive" : "pay");
        }
        setError(null);
    };

    const onType = (side: "pay" | "receive", text: string) => {
        const precision = side === "pay" ? precisionIn : precisionOut;
        if (!/^\d*\.?\d*$/.test(text)) return;
        const fraction = text.split(".")[1];
        if (fraction !== undefined && fraction.length > precision) return;
        setActive(side);
        setTyped(text);
        setError(null);
    };

    const onMax = () => {
        let units = balanceIn;
        // the fee is paid in the core asset: keep it back when that is sold
        if (idIn === "1.3.0" && units > feeReserve) units -= feeReserve;
        setActive("pay");
        setTyped(formatUnits(units, precisionIn));
        setError(null);
    };

    const onSubmit = () => {
        if (blocker || payUnits === null || minUnits === null) return;
        setError(null);
        setSubmitting(true);
        (ApplicationApi as any)
            .liquidityPoolExchange(
                account,
                pool.get("id"),
                symbolIn,
                Number(payUnits),
                symbolOut,
                Number(minUnits)
            )
            .then(() => {
                setSubmitting(false);
                onHideModal();
            })
            .catch((e: any) => {
                setSubmitting(false);
                console.error("exchange:", e);
            });
    };

    const customValue = parseFloat(customSlippage);
    const customActive =
        customSlippage !== "" &&
        Number.isFinite(customValue) &&
        !SLIPPAGE_CHOICES.includes(slippage);

    return (
        <Modal
            visible={isModalVisible}
            onCancel={onHideModal}
            title={t("title")}
            footer={[
                <Button
                    key="submit"
                    variant="accent"
                    disabled={!!blocker || submitting}
                    onClick={onSubmit}
                >
                    {blocker || t("submit")}
                </Button>,
                <Button key="cancel" onClick={onHideModal}>
                    <Translate component="span" content="transfer.cancel" />
                </Button>
            ]}
        >
            {pool.get("virtual_value") == 0 ? (
                <div>
                    {counterpart.translate(
                        "poolmart.liquidity_pools.need_stake_first"
                    )}
                </div>
            ) : (
                <div className={styles.swap}>
                    <div className={styles.field}>
                        <div className={styles.fieldHead}>
                            <span>{t("you_pay")}</span>
                            {account ? (
                                <button
                                    type="button"
                                    className={styles.balance}
                                    onClick={onMax}
                                >
                                    {t("balance")}:{" "}
                                    {formatUnits(balanceIn, precisionIn)}{" "}
                                    <span className={styles.max}>
                                        {t("max")}
                                    </span>
                                </button>
                            ) : null}
                        </div>
                        <div className={styles.fieldBody}>
                            <input
                                className={styles.amount}
                                inputMode="decimal"
                                autoComplete="off"
                                placeholder="0.0"
                                value={payText}
                                onChange={e => onType("pay", e.target.value)}
                                aria-label={t("you_pay")}
                            />
                            <span className={styles.asset}>
                                <AssetName name={symbolIn} noTip />
                            </span>
                        </div>
                    </div>

                    <div className={styles.flipRow}>
                        <button
                            type="button"
                            className={styles.flip}
                            onClick={onFlip}
                            aria-label={t("flip")}
                            title={t("flip")}
                        >
                            ⇅
                        </button>
                    </div>

                    <div className={styles.field}>
                        <div className={styles.fieldHead}>
                            <span>
                                {stable ? t("min_receive") : t("you_receive")}
                            </span>
                            {account ? (
                                <span className={styles.balanceStatic}>
                                    {t("balance")}:{" "}
                                    {formatUnits(balanceOut, precisionOut)}
                                </span>
                            ) : null}
                        </div>
                        <div className={styles.fieldBody}>
                            <input
                                className={styles.amount}
                                inputMode="decimal"
                                autoComplete="off"
                                placeholder="0.0"
                                value={stable ? manualMin : receiveText}
                                onChange={e =>
                                    stable
                                        ? /^\d*\.?\d*$/.test(e.target.value) &&
                                          setManualMin(e.target.value)
                                        : onType("receive", e.target.value)
                                }
                                aria-label={t("you_receive")}
                            />
                            <span className={styles.asset}>
                                <AssetName name={symbolOut} noTip />
                            </span>
                        </div>
                    </div>

                    {stable ? (
                        <div className={styles.note}>{t("stable_manual")}</div>
                    ) : null}

                    {quote ? (
                        <dl className={styles.details}>
                            <dt>{t("price")}</dt>
                            <dd>
                                1 <AssetName name={symbolIn} noTip /> ={" "}
                                {formatPrice(price)}{" "}
                                <AssetName name={symbolOut} noTip />
                            </dd>
                            <dt>{t("price_impact")}</dt>
                            <dd
                                className={
                                    impact !== null && impact > 0.05
                                        ? styles.warn
                                        : undefined
                                }
                            >
                                {impact === null ? "-" : formatPercent(impact)}
                            </dd>
                            <dt>{t("pool_fee")}</dt>
                            <dd>
                                {swapPool.takerFeePercent / 100}%
                                {quote.poolFee > BigInt(0)
                                    ? ` (${formatUnits(
                                          quote.poolFee,
                                          precisionOut
                                      )} ${symbolOut})`
                                    : ""}
                            </dd>
                            <dt>{t("min_received")}</dt>
                            <dd>
                                {minUnits !== null
                                    ? formatUnits(minUnits, precisionOut)
                                    : "-"}{" "}
                                <AssetName name={symbolOut} noTip />
                            </dd>
                        </dl>
                    ) : null}

                    {quote ? (
                        <div className={styles.slippage}>
                            <span>{t("slippage")}</span>
                            <div className={styles.chips}>
                                {SLIPPAGE_CHOICES.map(choice => (
                                    <button
                                        key={choice}
                                        type="button"
                                        className={`${styles.chip} ${
                                            slippage === choice &&
                                            customSlippage === ""
                                                ? styles.chipOn
                                                : ""
                                        }`}
                                        onClick={() => {
                                            setSlippage(choice);
                                            setCustomSlippage("");
                                        }}
                                    >
                                        {choice * 100}%
                                    </button>
                                ))}
                                <input
                                    className={`${styles.chip} ${
                                        customActive ? styles.chipOn : ""
                                    }`}
                                    inputMode="decimal"
                                    placeholder="%"
                                    value={customSlippage}
                                    aria-label={t("slippage")}
                                    onChange={e => {
                                        const text = e.target.value;
                                        if (!/^\d*\.?\d*$/.test(text)) return;
                                        setCustomSlippage(text);
                                        const v = parseFloat(text);
                                        if (
                                            Number.isFinite(v) &&
                                            v >= 0 &&
                                            v <= 50
                                        ) {
                                            setSlippage(v / 100);
                                        }
                                    }}
                                />
                            </div>
                        </div>
                    ) : null}

                    {venues && bookFill && quote ? (
                        <div
                            className={`${styles.venues} ${
                                venues.better === "book"
                                    ? styles.venueBook
                                    : styles.venuePool
                            }`}
                        >
                            {venues.better === "pool" ? (
                                <span>
                                    {t("better_pool", {
                                        percent: formatPercent(venues.advantage)
                                    })}
                                </span>
                            ) : venues.better === "book" ? (
                                <span>
                                    {t("better_book", {
                                        percent: formatPercent(
                                            venues.advantage
                                        ),
                                        amount: `${formatUnits(
                                            bookFill.receive,
                                            precisionOut
                                        )} ${symbolOut}`
                                    })}{" "}
                                    <Link
                                        to={`/market/${symbolOut}_${symbolIn}`}
                                        onClick={onHideModal}
                                    >
                                        {t("open_order_book")}
                                    </Link>
                                </span>
                            ) : (
                                <span>{t("same_price")}</span>
                            )}
                            {!bookFill.complete ? (
                                <span className={styles.muted}>
                                    {" "}
                                    {t("book_too_thin")}
                                </span>
                            ) : null}
                        </div>
                    ) : null}

                    {error ? <Alert message={error} type="error" /> : null}
                </div>
            )}
        </Modal>
    );
}

interface PoolExchangeModalContainerProps {
    pool: any;
    isModalVisible: boolean;
    onHideModal: () => void;
}

function PoolExchangeModalContainer({
    pool,
    isModalVisible,
    onHideModal
}: PoolExchangeModalContainerProps) {
    const accountState = useReduxState<any>(selectAccountState);
    const tick = useChainStoreTick();
    const [resolvedPool, setResolvedPool] = React.useState<any>(undefined);

    React.useEffect(() => {
        let cancelled = false;
        if (pool) {
            (ChainStore as any)
                .getLiquidityPoolsByShareAsset([pool])
                .then((pools: any) => {
                    if (cancelled) return;
                    setResolvedPool(pools.size > 0 ? pools.first() : null);
                });
        } else {
            setResolvedPool(null);
        }
        return () => {
            cancelled = true;
        };
    }, [pool, tick]);

    if (resolvedPool === undefined) {
        return <span />;
    }

    return (
        <PoolExchangeModalCore
            pool={resolvedPool}
            account={accountState.currentAccount}
            isModalVisible={isModalVisible}
            onHideModal={onHideModal}
        />
    );
}

export default PoolExchangeModalContainer;
