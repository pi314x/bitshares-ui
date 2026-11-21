import Immutable from "immutable";

export interface MarketPair {
    quote: string;
    base: string;
}

type Markets = Immutable.Map<string, MarketPair>;

/** "XBTSX.A_BTS" as its two assets (a symbol has no "_"), or null when it is not a market id. */
export function marketOfId(id: string | undefined): MarketPair | null {
    const parts = (id || "").split("_");
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
    return {quote: parts[0], base: parts[1]};
}

/** What the list of "My Markets" holds besides the default markets and the ones ticked: the starred ones, and the
 * market that is open. A market you starred, or are looking at, and cannot find in your own list is a wrong list. */
export function withOwnMarkets(
    markets: Markets,
    starred: Markets | undefined,
    current?: string
): Markets {
    let all = markets;
    if (starred) {
        starred.forEach((market, id) => {
            if (id && market && !all.has(id)) all = all.set(id, market);
        });
    }
    const open = marketOfId(current);
    if (open && current && !all.has(current)) all = all.set(current, open);
    return all;
}

/** "Show liquid markets only" hides a market with no trades in 24 hours - but never the market that is open. */
export function isHiddenAsIlliquid(
    onlyLiquid: boolean | undefined,
    stats: {volumeBase: number} | undefined,
    id: string,
    current?: string
): boolean {
    return !!onlyLiquid && id !== current && !!stats && stats.volumeBase == 0;
}
