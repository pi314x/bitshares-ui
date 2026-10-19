// The overview above the list of credit offers: what is on offer in total and
// how much of it can be borrowed now, at what rate, how the credit is spread
// over assets, and which collateral the offers take. Values are in the
// currency chosen in the settings (preferred unit of account), from market
// prices; an offer whose asset has no price is left out of the sums and said so.
//
// (A div, not a section: the legacy sheet makes every `section` a block,
// which beat the flex layout.)
//
// The spread is a stacked bar rather than a donut (a part of a whole is read
// as a length, not an angle) with its legend as a table of the values, so the
// colour is never the only carrier of meaning. Colours are the chart tokens
// (`--cat-1..6`, validated as a set), assigned in a fixed order by size.
import * as React from "react";
import counterpart from "counterpart";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../../../next/hooks/useChainStoreTick";
import {useUnitValue} from "../../../next/hooks/useUnitValue";
import {FEE_RATE_DENOM} from "../../../actions/CreditOfferActions";
import {
    OTHER,
    collateralAcceptance,
    foldSlices,
    weightedAverage
} from "../../../lib/common/creditOverview";
import {formatUnitValue} from "../../../lib/common/unitValue";
import styles from "../OverviewCards.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`credit_offer.overview.${key}`, params) as string;

export function symbolOf(assetId: string): string {
    try {
        const asset: any = (ChainStore as any).getAsset(assetId);
        return asset && typeof asset.get === "function"
            ? asset.get("symbol")
            : assetId;
    } catch (e) {
        return assetId;
    }
}

export interface CreditOverviewProps {
    /** The offers as the credit offer store holds them. */
    offers: any[];
}

export default function CreditOverview({
    offers
}: CreditOverviewProps): JSX.Element | null {
    useChainStoreTick();
    const list = offers || [];
    const assetIds = Array.from(new Set(list.map(o => o.asset_type)));
    const unitValue = useUnitValue(assetIds);
    const unit = unitValue.unit;

    if (!list.length) return null;

    // what each offer holds, in the unit; null without a price
    const rows = list.map(offer => {
        const total = unitValue.valueOf(
            offer.asset_type,
            Number(offer.total_balance)
        );
        const available = unitValue.valueOf(
            offer.asset_type,
            Number(offer.current_balance)
        );
        return {
            asset: offer.asset_type as string,
            total,
            available,
            rate: (Number(offer.fee_rate) / FEE_RATE_DENOM) * 100,
            collateral: (offer.acceptable_collateral || []).map(
                (c: any) => c[0] as string
            )
        };
    });
    const priced = rows.filter(r => r.total !== null);
    const unpriced = rows.length - priced.length;
    const sum = (pick: (r: typeof rows[number]) => number | null) =>
        rows.reduce<number>((s, r) => s + (pick(r) || 0), 0);
    const totalValue = sum(r => r.total);
    const availableValue = sum(r => r.available);
    const average = weightedAverage(
        priced.map(r => ({value: r.rate, weight: r.available || 0}))
    );

    const byAsset: {[assetId: string]: number} = {};
    priced.forEach(r => {
        byAsset[r.asset] = (byAsset[r.asset] || 0) + (r.total || 0);
    });
    const {slices} = foldSlices(
        Object.keys(byAsset).map(key => ({key, value: byAsset[key]})),
        5
    );
    const accepted = collateralAcceptance(rows).slice(0, 6);

    const money = (value: number) =>
        unit ? formatUnitValue(value, unit) : "-";
    const colour = (index: number, key: string) =>
        key === OTHER ? "var(--cat-other)" : `var(--cat-${index + 1})`;

    return (
        <div className={styles.overview} role="region" aria-label={t("title")}>
            <div className={styles.tiles}>
                <div className={styles.tile}>
                    <span className={styles.label}>{t("total_credit")}</span>
                    <span className={styles.figure}>
                        {priced.length ? money(totalValue) : "-"}
                    </span>
                    <span className={styles.sub}>
                        {t("offers_count", {count: list.length})}
                        {unpriced
                            ? ` · ${t("no_price", {count: unpriced})}`
                            : ""}
                    </span>
                </div>
                <div className={styles.tile}>
                    <span className={styles.label}>{t("available")}</span>
                    <span className={styles.figure}>
                        {priced.length ? money(availableValue) : "-"}
                    </span>
                    <span className={styles.sub}>
                        {totalValue > 0
                            ? t("of_total", {
                                  percent: `${(
                                      (availableValue / totalValue) *
                                      100
                                  ).toFixed(1)}%`
                              })
                            : ""}
                    </span>
                </div>
                <div className={styles.tile}>
                    <span className={styles.label}>{t("avg_rate")}</span>
                    <span className={styles.figure}>
                        {average === null ? "-" : `${average.toFixed(2)}%`}
                    </span>
                    <span className={styles.sub}>{t("rate_hint")}</span>
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
                                            `${
                                                s.key === OTHER
                                                    ? t("other")
                                                    : symbolOf(s.key)
                                            } ${(s.share * 100).toFixed(1)}%`
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
                                        title={`${
                                            s.key === OTHER
                                                ? t("other")
                                                : symbolOf(s.key)
                                        }: ${money(s.value)}`}
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
                                            {s.key === OTHER
                                                ? t("other")
                                                : symbolOf(s.key)}
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
                    <h3 className={styles.cardTitle}>{t("collateral")}</h3>
                    <ul className={styles.legend}>
                        {accepted.map(a => (
                            <li key={a.key} className={styles.acceptRow}>
                                <span className={styles.name}>
                                    {symbolOf(a.key)}
                                </span>
                                <span
                                    className={styles.meter}
                                    aria-hidden="true"
                                >
                                    <span
                                        className={styles.meterFill}
                                        style={{width: `${a.share * 100}%`}}
                                    />
                                </span>
                                <span className={styles.share}>
                                    {t("accepted_by", {
                                        count: a.count,
                                        total: list.length
                                    })}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    );
}
