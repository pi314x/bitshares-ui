import * as React from "react";
import {Link, LinkProps} from "react-router-dom";
import counterpart from "counterpart";
import AssetName from "../Utility/AssetName";
import {Button} from "../../design-system/Button";
import {
    PoolMetrics,
    formatAmountShort,
    formatPercent,
    formatPrice
} from "../../lib/common/poolMetrics";
import styles from "./PoolCard.module.scss";

const TypedLink = Link as React.ComponentType<LinkProps>;

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`poolmart.liquidity_pools.${key}`, params);

export interface PoolCardData {
    id: string;
    shareSymbol: string;
    symbolA: string;
    symbolB: string;
    metrics: PoolMetrics;
    takerFeePercent: number;
    withdrawalFeePercent: number;
    /** What the signed-in account holds of this pool, if anything. */
    yours?: {fraction: number; amountA: number; amountB: number} | null;
    /** Pool value is counted in A; its unit when A is not BTS. */
    valueUnit: string;
}

export interface PoolCardProps {
    pool: PoolCardData;
    canAct: boolean;
    onSwap: () => void;
    onStake: () => void;
}

function Fact({
    label,
    children
}: {
    label: string;
    children: React.ReactNode;
}): JSX.Element {
    return (
        <div className={styles.fact}>
            <span className={styles.factLabel}>{label}</span>
            <span className={styles.factValue}>{children}</span>
        </div>
    );
}

// One pool: the pair, what is in it, what one unit of each costs in the other,
// what it earns, and the two things you can do with it. The same card is the
// list on a phone and the "your liquidity" rows everywhere.
export function PoolCard({
    pool,
    canAct,
    onSwap,
    onStake
}: PoolCardProps): JSX.Element {
    const m = pool.metrics;
    const inverse = m.priceBPerA ? 1 / m.priceBPerA : null;
    return (
        <article className={styles.card}>
            <header className={styles.head}>
                <h3 className={styles.pair}>
                    <TypedLink to={`/asset/${pool.symbolA}`}>
                        <AssetName name={pool.symbolA} noTip />
                    </TypedLink>
                    <span className={styles.slash}>/</span>
                    <TypedLink to={`/asset/${pool.symbolB}`}>
                        <AssetName name={pool.symbolB} noTip />
                    </TypedLink>
                    {m.isStable ? (
                        <span className={styles.badge}>{t("stable")}</span>
                    ) : null}
                </h3>
                <div className={styles.meta}>
                    <span>
                        {t("share_asset")}:{" "}
                        <TypedLink to={`/asset/${pool.shareSymbol}`}>
                            <AssetName name={pool.shareSymbol} noTip />
                        </TypedLink>
                    </span>
                    <span>{pool.id}</span>
                </div>
            </header>

            <div className={styles.price}>
                <span>
                    1{" "}
                    <AssetName name={pool.symbolA} noTip>
                        {" "}
                    </AssetName>{" "}
                    = <strong>{formatPrice(m.priceBPerA)}</strong>{" "}
                    <AssetName name={pool.symbolB} noTip />
                </span>
                <span className={styles.priceInverse}>
                    1 <AssetName name={pool.symbolB} noTip /> ={" "}
                    {formatPrice(inverse)}{" "}
                    <AssetName name={pool.symbolA} noTip />
                </span>
            </div>

            <div className={styles.facts}>
                <Fact label={t("reserves")}>
                    {formatAmountShort(m.reserveA)}{" "}
                    <AssetName name={pool.symbolA} noTip />
                    <br />
                    {formatAmountShort(m.reserveB)}{" "}
                    <AssetName name={pool.symbolB} noTip />
                </Fact>
                <Fact label={t("pool_value")}>
                    {formatAmountShort(m.poolValueA)} {pool.valueUnit}
                </Fact>
                <Fact label={t("volume_24h")}>
                    {m.volume24hA === null
                        ? "-"
                        : `${formatAmountShort(m.volume24hA)} ${
                              pool.valueUnit
                          }`}
                </Fact>
                <Fact label={t("fees")}>
                    {pool.takerFeePercent / 100}% {t("taker")}
                    {" · "}
                    {pool.withdrawalFeePercent / 100}% {t("withdrawal")}
                    {m.feeYield24h !== null ? (
                        <>
                            <br />
                            <span className={styles.muted}>
                                {t("fees_24h", {
                                    percent: formatPercent(m.feeYield24h * 365)
                                })}
                            </span>
                        </>
                    ) : null}
                </Fact>
            </div>

            {pool.yours && pool.yours.fraction > 0 ? (
                <div className={styles.yours}>
                    <span>
                        {t("your_share", {
                            percent: formatPercent(pool.yours.fraction, 4)
                        })}
                    </span>
                    <span>
                        {formatAmountShort(pool.yours.amountA)}{" "}
                        <AssetName name={pool.symbolA} noTip /> +{" "}
                        {formatAmountShort(pool.yours.amountB)}{" "}
                        <AssetName name={pool.symbolB} noTip />
                    </span>
                </div>
            ) : null}

            <footer className={styles.actions}>
                <Button
                    variant="accent"
                    disabled={!canAct || !m.priceBPerA}
                    onClick={onSwap}
                >
                    {t("swap")}
                </Button>
                <Button disabled={!canAct} onClick={onStake}>
                    {t("add_remove")}
                </Button>
            </footer>
        </article>
    );
}
