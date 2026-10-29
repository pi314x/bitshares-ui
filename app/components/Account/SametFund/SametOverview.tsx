// The overview above the list of SameT funds: how much the funds hold in
// total, how much of that are fees borrowers have not paid back yet, what the
// funds charge, how the balance is spread over assets and over fee rates.
// Values are in the currency chosen in the settings (preferred unit of
// account), from market prices; a fund whose asset has no price is left out of
// the sums and said so. Same look as the credit offers overview.
//
// The spread over assets is a stacked bar with its legend as a table (a part of
// a whole is read as a length, and the colour is never the only carrier of
// meaning); the spread over fee rates is a meter per tier in one hue.
import * as React from "react";
import counterpart from "counterpart";
import {useChainStoreTick} from "../../../next/hooks/useChainStoreTick";
import {useUnitValue} from "../../../next/hooks/useUnitValue";
import {
    OTHER,
    foldSlices,
    weightedAverage
} from "../../../lib/common/creditOverview";
import {feeSpread} from "../../../lib/common/sametOverview";
import {SametFund, formatFeeRate} from "../../../lib/common/sametFunds";
import {formatUnitValue} from "../../../lib/common/unitValue";
import {symbolOf} from "../CreditOffer/CreditOverview";
import AssetLogo from "../../Utility/AssetLogo";
import logoStyles from "../../Utility/AssetLogo.module.scss";
import styles from "../OverviewCards.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`samet.overview.${key}`, params) as string;

export interface SametOverviewProps {
    /** The funds as the list holds them. */
    funds: SametFund[];
    /** There are more funds on the node than the list has loaded. */
    partial?: boolean;
}

export default function SametOverview({
    funds,
    partial = false
}: SametOverviewProps): JSX.Element | null {
    useChainStoreTick();
    const list = funds || [];
    const assetIds = Array.from(new Set(list.map(f => f.asset_type)));
    const unitValue = useUnitValue(assetIds);
    const unit = unitValue.unit;

    if (!list.length) return null;

    // what each fund holds and is owed, in the unit; null without a price
    const rows = list.map(fund => ({
        asset: fund.asset_type,
        balance: unitValue.valueOf(fund.asset_type, Number(fund.balance)),
        unpaid: unitValue.valueOf(fund.asset_type, Number(fund.unpaid_amount)),
        rate: fund.fee_rate
    }));
    const priced = rows.filter(r => r.balance !== null);
    const unpriced = rows.length - priced.length;
    const totalValue = priced.reduce((s, r) => s + (r.balance || 0), 0);
    const unpaidValue = priced.reduce((s, r) => s + (r.unpaid || 0), 0);
    // percent: a rate is in 1/1,000,000
    const average = weightedAverage(
        priced.map(r => ({value: r.rate / 10000, weight: r.balance || 0}))
    );
    const rates = list.map(f => f.fee_rate);
    const lowest = Math.min(...rates);
    const highest = Math.max(...rates);

    const byAsset: {[assetId: string]: number} = {};
    priced.forEach(r => {
        byAsset[r.asset] = (byAsset[r.asset] || 0) + (r.balance || 0);
    });
    const {slices} = foldSlices(
        Object.keys(byAsset).map(key => ({key, value: byAsset[key]})),
        5
    );
    const tiers = feeSpread(rows.map(r => ({rate: r.rate, value: r.balance})));

    const money = (value: number) =>
        unit ? formatUnitValue(value, unit) : "-";
    const colour = (index: number, key: string) =>
        key === OTHER ? "var(--cat-other)" : `var(--cat-${index + 1})`;
    const nameOf = (key: string) =>
        key === OTHER ? t("other") : symbolOf(key);
    const tierLabel = (tier: {key: string; percent: number | null}) =>
        tier.key === "free"
            ? t("tier_free")
            : t(tier.key === "over" ? "tier_over" : "tier_up_to", {
                  rate: `${tier.percent}%`
              });

    return (
        <div className={styles.overview} role="region" aria-label={t("title")}>
            <div className={styles.tiles}>
                <div className={styles.tile}>
                    <span className={styles.label}>{t("total")}</span>
                    <span className={styles.figure}>
                        {priced.length ? money(totalValue) : "-"}
                    </span>
                    <span className={styles.sub}>
                        {t("funds_count", {
                            count: list.length,
                            assets: assetIds.length
                        })}
                        {unpriced
                            ? ` · ${t("no_price", {count: unpriced})}`
                            : ""}
                    </span>
                </div>
                <div className={styles.tile}>
                    <span className={styles.label}>{t("unpaid")}</span>
                    <span className={styles.figure}>
                        {priced.length ? money(unpaidValue) : "-"}
                    </span>
                    <span className={styles.sub}>
                        {totalValue > 0
                            ? t("of_balance", {
                                  percent: `${(
                                      (unpaidValue / totalValue) *
                                      100
                                  ).toFixed(2)}%`
                              })
                            : ""}
                    </span>
                </div>
                <div className={styles.tile}>
                    <span className={styles.label}>{t("avg_rate")}</span>
                    <span className={styles.figure}>
                        {average === null ? "-" : `${average.toFixed(3)}%`}
                    </span>
                    <span className={styles.sub}>
                        {t("rate_range", {
                            min: formatFeeRate(lowest),
                            max: formatFeeRate(highest)
                        })}
                    </span>
                </div>
            </div>

            <div className={styles.cards}>
                <div className={styles.card}>
                    <h3 className={styles.cardTitle}>{t("by_asset")}</h3>
                    {slices.length ? (
                        <>
                            <div
                                className={styles.bar}
                                role="img"
                                aria-label={slices
                                    .map(
                                        s =>
                                            `${nameOf(s.key)} ${(
                                                s.share * 100
                                            ).toFixed(1)}%`
                                    )
                                    .join(", ")}
                            >
                                {slices.map((s, i) => (
                                    <span
                                        key={s.key}
                                        className={styles.segment}
                                        style={{
                                            flexGrow: s.share,
                                            background: colour(i, s.key)
                                        }}
                                        title={`${nameOf(s.key)}: ${money(
                                            s.value
                                        )}`}
                                    />
                                ))}
                            </div>
                            <ul className={styles.legend}>
                                {slices.map((s, i) => (
                                    <li
                                        key={s.key}
                                        className={styles.legendRow}
                                    >
                                        <span
                                            className={styles.swatch}
                                            style={{
                                                background: colour(i, s.key)
                                            }}
                                            aria-hidden="true"
                                        />
                                        <span className={styles.name}>
                                            {s.key === OTHER ? null : (
                                                <AssetLogo
                                                    symbol={symbolOf(s.key)}
                                                    size={16}
                                                    className={
                                                        logoStyles.inline
                                                    }
                                                    fallback="none"
                                                />
                                            )}
                                            {nameOf(s.key)}
                                        </span>
                                        <span className={styles.value}>
                                            {money(s.value)}
                                        </span>
                                        <span className={styles.share}>
                                            {(s.share * 100).toFixed(1)}%
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : (
                        <p className={styles.empty}>{t("no_prices")}</p>
                    )}
                </div>

                <div className={styles.card}>
                    <h3 className={styles.cardTitle}>{t("by_rate")}</h3>
                    {tiers.length ? (
                        <ul className={styles.legend}>
                            {tiers.map(tier => (
                                <li key={tier.key} className={styles.tierRow}>
                                    <span className={styles.name}>
                                        {tierLabel(tier.tier)}
                                    </span>
                                    <span
                                        className={styles.meter}
                                        aria-hidden="true"
                                    >
                                        <span
                                            className={styles.meterFill}
                                            style={{
                                                width: `${tier.share * 100}%`
                                            }}
                                        />
                                    </span>
                                    <span className={styles.share}>
                                        {(tier.share * 100).toFixed(1)}%
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className={styles.empty}>{t("no_prices")}</p>
                    )}
                </div>
            </div>
            {partial ? <p className={styles.note}>{t("partial")}</p> : null}
        </div>
    );
}
