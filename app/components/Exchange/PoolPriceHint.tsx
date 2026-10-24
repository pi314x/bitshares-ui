import * as React from "react";
import {Link} from "react-router-dom";
import counterpart from "counterpart";
import {Apis} from "bitsharesjs-ws";
import {compareSpot} from "../../lib/common/priceCompare";
import {formatPercent, formatPrice} from "../../lib/common/poolMetrics";
import styles from "./PoolPriceHint.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`poolmart.hint.${key}`, params);

export interface PoolPriceHintProps {
    baseAsset: any;
    quoteAsset: any;
    /** The order book's best ask and bid, base per quote (null: empty side). */
    lowestAsk: number | null;
    highestBid: number | null;
}

// A line under the market's header: is the price better in the liquidity pool
// of this pair or on this order book - for buying, and for selling. It is for
// a small trade; the swap dialog compares the real amount.
export default function PoolPriceHint({
    baseAsset,
    quoteAsset,
    lowestAsk,
    highestBid
}: PoolPriceHintProps): JSX.Element | null {
    const baseId: string | undefined = baseAsset && baseAsset.get("id");
    const quoteId: string | undefined = quoteAsset && quoteAsset.get("id");
    const [pool, setPool] = React.useState<any | null>(null);

    React.useEffect(() => {
        setPool(null);
        if (!baseId || !quoteId) return;
        let cancelled = false;
        (Apis as any)
            .instance()
            .db_api()
            .exec("get_liquidity_pools_by_both_assets", [quoteId, baseId, 100])
            .then((pools: any[]) => {
                if (cancelled || !pools || !pools.length) return;
                // the deepest one: the most of the base asset in it
                const baseKey =
                    pools[0].asset_a === baseId ? "balance_a" : "balance_b";
                const deepest = pools
                    .filter(
                        p => !(p.pool_type === 1 || p.pool_type === "stable")
                    )
                    .sort((x, y) => Number(y[baseKey]) - Number(x[baseKey]))[0];
                if (deepest) setPool(deepest);
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, [baseId, quoteId]);

    if (!pool || !baseAsset || !quoteAsset) return null;

    const baseIsA = pool.asset_a === baseId;
    const reserveBase =
        Number(baseIsA ? pool.balance_a : pool.balance_b) /
        Math.pow(10, baseAsset.get("precision"));
    const reserveQuote =
        Number(baseIsA ? pool.balance_b : pool.balance_a) /
        Math.pow(10, quoteAsset.get("precision"));
    const comparison = compareSpot(
        reserveBase,
        reserveQuote,
        Number(pool.taker_fee_percent || 0),
        lowestAsk,
        highestBid
    );
    if (!comparison) return null;

    const say = (
        side: "buy" | "sell",
        c: {better: "pool" | "book" | "equal"; advantage: number} | null
    ) => {
        if (!c) return null;
        if (c.better === "equal") return t(`${side}_equal`);
        return t(`${side}_${c.better}`, {percent: formatPercent(c.advantage)});
    };
    const buy = say("buy", comparison.buy);
    const sell = say("sell", comparison.sell);

    return (
        <div className={styles.hint}>
            <span className={styles.title}>{t("title")}</span>
            <span className={styles.price}>
                {t("pool_price", {
                    buy: formatPrice(comparison.poolBuy),
                    sell: formatPrice(comparison.poolSell)
                })}
            </span>
            {buy ? (
                <span
                    className={`${styles.chip} ${
                        comparison.buy && comparison.buy.better === "pool"
                            ? styles.pool
                            : ""
                    }`}
                >
                    {buy}
                </span>
            ) : null}
            {sell ? (
                <span
                    className={`${styles.chip} ${
                        comparison.sell && comparison.sell.better === "pool"
                            ? styles.pool
                            : ""
                    }`}
                >
                    {sell}
                </span>
            ) : null}
            <Link className={styles.link} to="/pools">
                {t("open_pools")}
            </Link>
        </div>
    );
}
