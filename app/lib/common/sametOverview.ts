// The numbers behind the SameT funds overview: how the balance held in funds is
// spread over fee rates. Plain arithmetic on what the funds list holds; the
// prices that turn balances into the user's currency come from the caller.
import {Slice} from "./creditOverview";

export interface FeeTier {
    key: string;
    /** the tier's upper bound in 1/FEE_RATE_DENOM (inclusive); null: no bound */
    max: number | null;
    /** the same bound as a percentage, for the label */
    percent: number | null;
}

// 0, up to 0.05%, up to 0.1%, up to 1%, above (a rate is in 1/1,000,000)
export const FEE_TIERS: FeeTier[] = [
    {key: "free", max: 0, percent: 0},
    {key: "low", max: 500, percent: 0.05},
    {key: "mid", max: 1000, percent: 0.1},
    {key: "high", max: 10000, percent: 1},
    {key: "over", max: null, percent: 1}
];

/** The tier a fee rate falls into. */
export function feeTierOf(rate: number): FeeTier {
    for (const tier of FEE_TIERS) {
        if (tier.max !== null && rate <= tier.max) return tier;
    }
    return FEE_TIERS[FEE_TIERS.length - 1];
}

/**
 * What each fee tier holds, in the tiers' order, the empty ones left out;
 * shares are of what is counted (entries without a value are not).
 */
export function feeSpread(
    funds: Array<{rate: number; value: number | null}>
): Array<Slice & {tier: FeeTier}> {
    const sums: {[key: string]: number} = {};
    let total = 0;
    funds.forEach(f => {
        if (f.value === null || !Number.isFinite(f.value) || f.value <= 0) {
            return;
        }
        const tier = feeTierOf(f.rate);
        sums[tier.key] = (sums[tier.key] || 0) + f.value;
        total += f.value;
    });
    if (!total) return [];
    return FEE_TIERS.filter(tier => sums[tier.key] > 0).map(tier => ({
        tier,
        key: tier.key,
        value: sums[tier.key],
        share: sums[tier.key] / total
    }));
}
