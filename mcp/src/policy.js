"use strict";
// The rules a prepared order must keep, checked on the server before a link is made (and
// the application checks the price again with its own data before it lets anyone sign):
// only the accounts and assets the person named, a limit per order and per day, a limit
// on how fast orders are prepared, and a price that is not worse than the market's by more
// than the person allowed. A rule that cannot be checked refuses; it never passes.
//
// No Node-only module here: the application's review page imports `marketPrice` from this
// file, so it goes into the browser bundle (the ledger's file store is in store.js, which
// only the server loads).
const {UserError, toUnits, fromUnits} = require("./format");

const DAY_MS = 24 * 3600 * 1000;
const HOUR_MS = 3600 * 1000;

/**
 * What was prepared lately. With a `store` (see store.js) it is kept between runs: a
 * client that starts the server anew for every session (stdio does) would otherwise begin
 * every time with an empty page and the daily limit would mean nothing. Without one it lives
 * in memory.
 */
function createLedger(store) {
    const ledger = {prepared: [], sold: {}, store: store || null};
    /** Reads the stored state again (another process may have added to it). */
    ledger.refresh = () => {
        if (!ledger.store) return;
        const data = ledger.store.load();
        ledger.prepared = data.prepared;
        ledger.sold = data.sold;
    };
    ledger.persist = () => {
        if (ledger.store)
            ledger.store.save({prepared: ledger.prepared, sold: ledger.sold});
    };
    ledger.refresh();
    return ledger;
}

function prune(list, now, window) {
    while (list.length && now - list[0].t >= window) list.shift();
}

/** How many proposals the last hour holds; refuses the one that would pass the limit. */
function checkRate(ledger, now, perHour) {
    ledger.refresh();
    prune(ledger.prepared, now, HOUR_MS);
    if (ledger.prepared.length >= perHour) {
        throw new UserError(
            `${ledger.prepared.length} proposals were prepared in the last hour, which is the limit the person set (${perHour}). Ask them before preparing more.`,
            "rate_limited"
        );
    }
}

function soldToday(ledger, symbol, now) {
    const list = ledger.sold[symbol] || [];
    prune(list, now, DAY_MS);
    return list.reduce((sum, e) => sum + e.units, BigInt(0));
}

/**
 * The limit of an asset to sell: refuses an asset that was not named, an order above the
 * per-order limit, and a day's total above the per-day limit. Returns the units sold so far
 * today, for the answer.
 */
function checkSellLimits(config, ledger, now, symbol, precision, units) {
    const limit = config.limits[symbol];
    if (!limit) {
        throw new UserError(
            `${symbol} is not one of the assets the person allowed (${Object.keys(
                config.limits
            ).join(", ")}).`,
            "asset_not_allowed"
        );
    }
    const perOrder = toUnits(limit.perOrder, precision);
    const perDay = toUnits(limit.perDay, precision);
    if (units > perOrder) {
        throw new UserError(
            `Selling ${fromUnits(
                units,
                precision
            )} ${symbol} is above the limit of ${
                limit.perOrder
            } ${symbol} for one order.`,
            "over_order_limit"
        );
    }
    const before = soldToday(ledger, symbol, now);
    if (before + units > perDay) {
        throw new UserError(
            `${fromUnits(
                before,
                precision
            )} ${symbol} was prepared in the last 24 hours; ${fromUnits(
                units,
                precision
            )} more would pass the limit of ${limit.perDay} ${symbol} a day.`,
            "over_day_limit"
        );
    }
    return before;
}

function allowedReceive(config, symbol) {
    if (!config.limits[symbol]) {
        throw new UserError(
            `${symbol} is not one of the assets the person allowed (${Object.keys(
                config.limits
            ).join(", ")}), so it cannot be bought either.`,
            "asset_not_allowed"
        );
    }
}

function record(ledger, now, symbol, units) {
    // read again, add, write: what another process added since is kept
    ledger.refresh();
    ledger.prepared.push({t: now});
    (ledger.sold[symbol] = ledger.sold[symbol] || []).push({t: now, units});
    ledger.persist();
}

function positive(text) {
    const n = Number(text);
    return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * The market's price from a ticker of (sold asset, bought asset): in units of the sold
 * asset per one of the bought, the middle of the best bid and ask, or the last price when
 * one side is empty; null when there is none.
 */
function marketPrice(ticker) {
    if (!ticker) return null;
    const bid = positive(ticker.highest_bid);
    const ask = positive(ticker.lowest_ask);
    const last = positive(ticker.latest);
    if (bid && ask) return (bid + ask) / 2;
    return last || bid || ask || null;
}

/**
 * Is the price (sold per bought) worse for the person than the market by more than the
 * limit? Returns {deviationPercent, market} - deviation above 0 means they pay more than
 * the market asks - or throws.
 */
function checkPrice(config, ticker, soldDecimal, boughtDecimal) {
    const market = marketPrice(ticker);
    const mine = soldDecimal / boughtDecimal;
    if (!market) {
        if (config.allowUnpriced) return {deviationPercent: null, market: null};
        throw new UserError(
            "There is no market price for this pair to check the order against (no bid, ask or last trade), so it is not prepared.",
            "unpriced"
        );
    }
    const deviationPercent = ((mine - market) / market) * 100;
    if (deviationPercent > config.maxDeviationPercent) {
        throw new UserError(
            `This price pays ${deviationPercent.toFixed(
                2
            )}% more than the market asks (about ${Number(
                market.toPrecision(6)
            )}); the person allowed ${
                config.maxDeviationPercent
            }%. Check the amounts and the asset precision, or ask the person.`,
            "off_market"
        );
    }
    return {deviationPercent, market};
}

module.exports = {
    createLedger,
    checkRate,
    checkSellLimits,
    allowedReceive,
    record,
    marketPrice,
    checkPrice
};
