// Which logo file an asset gets. The files are `asset-symbols/<symbol>.png`
// (lowercase), the set the app ships plus the logos taken over from the BitShares
// wallet browser extension. An asset without a file has no logo: the caller draws
// a letter in a circle (as the extension does), it never asks for a missing file.
import {ASSET_LOGO_NAMES} from "./assetLogoNames";

const KNOWN = new Set(ASSET_LOGO_NAMES);

// Gateways and wrappers whose `PREFIX.COIN` is the coin itself: HONEST.ETH is
// Ethereum, so it wears Ethereum's logo when it has none of its own.
const WRAPPER_PREFIXES = new Set([
    "xbtsx",
    "gdex",
    "rudex",
    "honest",
    "binance",
    "open",
    "bridge",
    "deex",
    "coss",
    "sparkdex",
    "blocktrades",
    "btwty",
    "trade",
    "twentix",
    "brdg",
    "iob",
    "pirate",
    "swap"
]);

/**
 * The file name (without ".png") of the logo for `symbol`, or null.
 * Exact symbol first (XBTSX.USDT), then a bitAsset's coin (bitUSD -> usd), then
 * the coin behind a gateway prefix (HONEST.ETH -> eth).
 */
export function assetLogoName(
    symbol: string | null | undefined,
    known: Set<string> = KNOWN
): string | null {
    if (!symbol) return null;
    const lower = symbol.toLowerCase();
    if (known.has(lower)) return lower;
    if (lower.startsWith("bit") && known.has(lower.slice(3))) {
        return lower.slice(3);
    }
    const dot = lower.indexOf(".");
    if (dot > 0 && WRAPPER_PREFIXES.has(lower.slice(0, dot))) {
        const coin = lower.slice(dot + 1);
        if (known.has(coin)) return coin;
    }
    return null;
}

/**
 * The letter drawn for an asset without a logo: the coin's first letter when the
 * prefix is a gateway (HONEST.XAU -> X), otherwise the symbol's own (DEFI.BTSEUR
 * -> D, a token of its own).
 */
export function assetLetter(symbol: string | null | undefined): string {
    if (!symbol) return "?";
    const lower = symbol.toLowerCase();
    const dot = lower.indexOf(".");
    const shown =
        dot > 0 && WRAPPER_PREFIXES.has(lower.slice(0, dot))
            ? symbol.slice(dot + 1)
            : symbol;
    return (shown.charAt(0) || "?").toUpperCase();
}
