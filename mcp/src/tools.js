"use strict";
// The tools: what each one asks of the node and what it answers. A tool gets its arguments
// already checked against its schema (schema.js) and a context; it returns a plain object
// (which becomes the tool's result) or throws a UserError (a refusal the model can read) .
//
// Two groups: the READ tools, which only ask the node; and the TRADING tools, which are
// there only when MCP_TRADING_ENABLED is true and only PREPARE a transaction - the result
// is a link and a reference code for a person to open in BitShares Desk and sign with their
// own wallet. No tool here has a key, a signature or a way to broadcast.
const {
    UserError,
    toUnits,
    fromUnits,
    cleanText,
    chainTime,
    parseChainTime,
    assetRef,
    accountRef,
    ORDER_ID
} = require("./format");
const {TOOLS} = require("./catalog");
const OPERATION_NAMES = require("./opnames");
const policy = require("./policy");
const proposalLib = require("./proposal");

const CORE = "1.3.0";
const ASSET_TTL_MS = 5 * 60 * 1000;
const LIFETIME_MEMBER = /^2106-/;
const BASIC_MEMBER = /^1969-/;

// the asset flags bitsharesjs and the chain name, lowest bit first
const ASSET_FLAGS = [
    "charge_market_fee",
    "white_list",
    "override_authority",
    "transfer_restricted",
    "disable_force_settle",
    "global_settle",
    "disable_confidential",
    "witness_fed_asset",
    "committee_fed_asset",
    "lock_max_supply",
    "disable_new_supply",
    "disable_mcr_update",
    "disable_icr_update",
    "disable_mssr_update",
    "disable_bsrm_update",
    "disable_collateral_bidding"
];

const big = v => BigInt(String(v));

function hostOf(url) {
    try {
        return new URL(url).host;
    } catch (e) {
        return null;
    }
}

/** A string or number from the node as a short line of safe text. */
function text(v, max) {
    return cleanText(v, max || 120);
}

/** Every string in a value cleaned, and the value cut down to a size a model can read. */
function tame(value, depth) {
    if (typeof value === "string") return cleanText(value, 160);
    if (Array.isArray(value)) {
        return depth > 4
            ? "[...]"
            : value.slice(0, 20).map(v => tame(v, (depth || 0) + 1));
    }
    if (value && typeof value === "object") {
        if ((depth || 0) > 4) return "{...}";
        const out = {};
        Object.keys(value)
            .slice(0, 30)
            .forEach(k => {
                if (k === "extensions") return;
                // a memo is encrypted: only whether there is one
                if (k === "memo") {
                    out.has_memo = true;
                    return;
                }
                out[cleanText(k, 40)] = tame(value[k], (depth || 0) + 1);
            });
        return out;
    }
    return value;
}

function createContext(options) {
    return {
        rpc: options.rpc,
        config: options.config,
        now: options.now || (() => Date.now()),
        randomHex: options.randomHex,
        sha256Hex: options.sha256Hex,
        ledger: options.ledger || policy.createLedger(),
        cache: new Map()
    };
}

async function db(ctx, method, params) {
    return ctx.rpc.call(0, method, params);
}

/** The node's record of an asset by symbol or id. */
async function getAsset(ctx, reference) {
    const ref = assetRef(reference);
    const key = ref.id || ref.symbol;
    const hit = ctx.cache.get(key);
    if (hit && ctx.now() - hit.at < ASSET_TTL_MS) return hit.value;
    const rows = ref.id
        ? await db(ctx, "get_assets", [[ref.id]])
        : await db(ctx, "lookup_asset_symbols", [[ref.symbol]]);
    const asset = rows && rows[0];
    if (!asset)
        throw new UserError(
            `There is no asset ${ref.id || ref.symbol} on this chain.`,
            "not_found"
        );
    ctx.cache.set(asset.id, {at: ctx.now(), value: asset});
    ctx.cache.set(asset.symbol, {at: ctx.now(), value: asset});
    return asset;
}

/** Records of several assets by id, as a map. */
async function getAssets(ctx, ids) {
    const unique = Array.from(new Set(ids));
    const out = {};
    const missing = [];
    unique.forEach(id => {
        const hit = ctx.cache.get(id);
        if (hit && ctx.now() - hit.at < ASSET_TTL_MS) out[id] = hit.value;
        else missing.push(id);
    });
    if (missing.length) {
        const rows = (await db(ctx, "get_assets", [missing])) || [];
        rows.forEach(asset => {
            if (!asset) return;
            out[asset.id] = asset;
            ctx.cache.set(asset.id, {at: ctx.now(), value: asset});
        });
    }
    return out;
}

async function getAccount(ctx, reference) {
    const ref = accountRef(reference);
    const account = ref.id
        ? ((await db(ctx, "get_accounts", [[ref.id]])) || [])[0]
        : await db(ctx, "get_account_by_name", [ref.name]);
    if (!account)
        throw new UserError(
            `There is no account ${ref.id || ref.name} on this chain.`,
            "not_found"
        );
    return account;
}

const brief = asset => ({
    id: asset.id,
    symbol: asset.symbol,
    precision: asset.precision
});

function amountOf(assets, a) {
    const info = assets[a.asset_id];
    return info ? fromUnits(big(a.amount), info.precision) : String(a.amount);
}

function authority(a) {
    return {
        weight_threshold: a.weight_threshold,
        keys: (a.key_auths || []).length,
        accounts: (a.account_auths || []).map(x => ({
            account: x[0],
            weight: x[1]
        }))
    };
}

function pool(raw, assets, shares) {
    const a = assets[raw.asset_a];
    const b = assets[raw.asset_b];
    const balanceA = a
        ? fromUnits(big(raw.balance_a), a.precision)
        : String(raw.balance_a);
    const balanceB = b
        ? fromUnits(big(raw.balance_b), b.precision)
        : String(raw.balance_b);
    const priceBPerA =
        a && b && big(raw.balance_a) > BigInt(0)
            ? Number(
                  Number(raw.balance_b) /
                      Math.pow(10, b.precision) /
                      (Number(raw.balance_a) / Math.pow(10, a.precision))
              ).toPrecision(8)
            : null;
    return {
        id: raw.id,
        asset_a: a ? brief(a) : {id: raw.asset_a},
        asset_b: b ? brief(b) : {id: raw.asset_b},
        balance_a: balanceA,
        balance_b: balanceB,
        price:
            priceBPerA && b && a
                ? `${Number(priceBPerA)} ${b.symbol} per 1 ${a.symbol}`
                : null,
        share_asset:
            shares && shares[raw.share_asset]
                ? shares[raw.share_asset].symbol
                : raw.share_asset,
        taker_fee_percent: raw.taker_fee_percent / 100,
        withdrawal_fee_percent: raw.withdrawal_fee_percent / 100
    };
}

const BUCKETS = {"5m": 300, "1h": 3600, "1d": 86400};
// the operations a person is most likely to ask the price of
const DEFAULT_FEE_OPERATIONS = [
    "transfer",
    "limit_order_create",
    "limit_order_cancel",
    "limit_order_update",
    "call_order_update",
    "account_update",
    "proposal_create",
    "liquidity_pool_exchange",
    "liquidity_pool_deposit",
    "asset_create"
];

/** A price as a number of 8 significant digits, or null when it is not one. */
/** A percentage to two decimals. */
const pct = x => (Number.isFinite(x) ? Number(x.toFixed(2)) : null);

const price8 = x => (Number.isFinite(x) ? Number(x.toPrecision(8)) : null);

/** Whether a price of {base, quote} units has both sides. */
const usable = p =>
    !!p && big(p.base.amount) > BigInt(0) && big(p.quote.amount) > BigInt(0);

/** The claimable part of a vesting balance now, by its rule (units, BigInt), and the rule's name. */
function vestingClaimable(row, nowSec) {
    const balance = big(row.balance.amount);
    const kind = row.policy[0];
    const rule = row.policy[1] || {};
    const zero = BigInt(0);
    if (kind === 2) return {kind: "instant", claimable: balance};
    if (kind === 0) {
        const begin = parseChainTime(rule.begin_timestamp) / 1000;
        const duration = Number(rule.vesting_duration_seconds);
        const cliff = Number(rule.vesting_cliff_seconds || 0);
        const elapsed = nowSec - begin;
        if (!(duration > 0) || elapsed < cliff)
            return {kind: "linear", claimable: zero};
        const start = big(rule.begin_balance);
        const vested =
            elapsed >= duration
                ? start
                : (start * BigInt(Math.floor(elapsed))) / BigInt(duration);
        const withdrawn = start - balance;
        const claim = vested > withdrawn ? vested - withdrawn : zero;
        return {kind: "linear", claimable: claim > balance ? balance : claim};
    }
    if (kind === 1) {
        const seconds = BigInt(Number(rule.vesting_seconds) || 1);
        const last =
            parseChainTime(rule.coin_seconds_earned_last_update) / 1000;
        const start = parseChainTime(rule.start_claim) / 1000;
        let earned = big(rule.coin_seconds_earned);
        if (nowSec > last)
            earned += balance * BigInt(Math.floor(nowSec - last));
        const most = balance * seconds;
        if (earned > most) earned = most;
        if (nowSec < start) return {kind: "coin-seconds", claimable: zero};
        const claim = earned / seconds;
        return {
            kind: "coin-seconds",
            claimable: claim > balance ? balance : claim
        };
    }
    return {kind: "operation_" + kind, claimable: zero};
}

const reads = {
    async bitshares_chain_info(ctx) {
        const [properties, chainId] = await Promise.all([
            db(ctx, "get_dynamic_global_properties", []),
            db(ctx, "get_chain_id", [])
        ]);
        return {
            chain_id: chainId,
            head_block_number: properties.head_block_number,
            head_block_time: properties.time + " UTC",
            last_irreversible_block: properties.last_irreversible_block_num,
            node: hostOf(ctx.rpc.last() || "") || null
        };
    },

    async bitshares_get_account(ctx, args) {
        const account = await getAccount(ctx, args.account);
        const expiry = String(account.membership_expiration_date || "");
        return {
            id: account.id,
            name: account.name,
            membership: LIFETIME_MEMBER.test(expiry)
                ? "lifetime"
                : BASIC_MEMBER.test(expiry)
                ? "basic"
                : `annual until ${expiry}`,
            registrar: account.registrar,
            referrer: account.referrer,
            owner: authority(account.owner),
            active: authority(account.active),
            voting_account: account.options && account.options.voting_account
        };
    },

    async bitshares_get_balances(ctx, args) {
        const account = await getAccount(ctx, args.account);
        const rows =
            (await db(ctx, "get_account_balances", [account.id, []])) || [];
        const kept = rows.filter(
            r => args.include_zero || big(r.amount) > BigInt(0)
        );
        const assets = await getAssets(
            ctx,
            kept.slice(0, 200).map(r => r.asset_id)
        );
        return {
            account: {id: account.id, name: account.name},
            count: kept.length,
            truncated: kept.length > 200,
            balances: kept.slice(0, 200).map(r => ({
                asset: assets[r.asset_id]
                    ? assets[r.asset_id].symbol
                    : r.asset_id,
                asset_id: r.asset_id,
                amount: amountOf(assets, r),
                units: String(r.amount)
            }))
        };
    },

    async bitshares_get_asset(ctx, args) {
        const asset = await getAsset(ctx, args.asset);
        const objects =
            (await db(ctx, "get_objects", [
                [asset.dynamic_asset_data_id].concat(
                    asset.bitasset_data_id ? [asset.bitasset_data_id] : []
                )
            ])) || [];
        const dynamic = objects[0] || {};
        const bitasset = objects[1] || null;
        const options = asset.options || {};
        const flags = Number(options.flags || 0);
        return {
            id: asset.id,
            symbol: asset.symbol,
            precision: asset.precision,
            issuer: asset.issuer,
            max_supply: fromUnits(
                big(options.max_supply || 0),
                asset.precision
            ),
            current_supply:
                dynamic.current_supply !== undefined
                    ? fromUnits(big(dynamic.current_supply), asset.precision)
                    : null,
            market_pegged: !!asset.bitasset_data_id,
            prediction_market: !!(bitasset && bitasset.is_prediction_market),
            market_fee_percent: (options.market_fee_percent || 0) / 100,
            flags: ASSET_FLAGS.filter((name, i) => flags & (1 << i)),
            description: text(options.description, 300),
            description_is_untrusted: true
        };
    },

    async bitshares_search_assets(ctx, args) {
        const prefix = args.prefix.trim().toUpperCase();
        if (!/^[A-Z0-9][A-Z0-9._-]*$/.test(prefix))
            throw new UserError(
                "The prefix may hold letters, digits, dots and dashes only."
            );
        const limit = args.limit || 10;
        const rows = (await db(ctx, "list_assets", [prefix, limit])) || [];
        return {
            prefix,
            assets: rows
                .filter(a => a.symbol.toUpperCase().indexOf(prefix) === 0)
                .map(a => ({
                    symbol: a.symbol,
                    id: a.id,
                    precision: a.precision,
                    issuer: a.issuer
                }))
        };
    },

    async bitshares_get_ticker(ctx, args) {
        const base = await getAsset(ctx, args.base);
        const quote = await getAsset(ctx, args.quote);
        if (base.id === quote.id)
            throw new UserError("The two assets of a market must differ.");
        const t = await db(ctx, "get_ticker", [base.id, quote.id]);
        return {
            base: brief(base),
            quote: brief(quote),
            price_unit: `${base.symbol} per 1 ${quote.symbol}`,
            latest: t.latest,
            lowest_ask: t.lowest_ask,
            lowest_ask_quote_size: t.lowest_ask_quote_size,
            highest_bid: t.highest_bid,
            highest_bid_quote_size: t.highest_bid_quote_size,
            percent_change_24h: t.percent_change,
            base_volume_24h: t.base_volume,
            quote_volume_24h: t.quote_volume,
            time: t.time + " UTC"
        };
    },

    async bitshares_get_order_book(ctx, args) {
        const base = await getAsset(ctx, args.base);
        const quote = await getAsset(ctx, args.quote);
        if (base.id === quote.id)
            throw new UserError("The two assets of a market must differ.");
        const book = await db(ctx, "get_order_book", [
            base.id,
            quote.id,
            args.depth || 10
        ]);
        const side = rows =>
            (rows || []).map(o => ({
                price: o.price,
                base_amount: o.base,
                quote_amount: o.quote
            }));
        return {
            base: brief(base),
            quote: brief(quote),
            price_unit: `${base.symbol} per 1 ${quote.symbol}`,
            bids: side(book.bids),
            asks: side(book.asks)
        };
    },

    async bitshares_get_open_orders(ctx, args) {
        const account = await getAccount(ctx, args.account);
        const orders =
            (await db(ctx, "get_limit_orders_by_account", [account.id, 100])) ||
            [];
        const assets = await getAssets(
            ctx,
            orders.reduce(
                (ids, o) =>
                    ids.concat([
                        o.sell_price.base.asset_id,
                        o.sell_price.quote.asset_id
                    ]),
                []
            )
        );
        return {
            account: {id: account.id, name: account.name},
            count: orders.length,
            orders: orders.map(o => {
                const sell = assets[o.sell_price.base.asset_id];
                const receive = assets[o.sell_price.quote.asset_id];
                const forSale = big(o.for_sale);
                // what is still asked for it, rounded up as the chain does
                const baseUnits = big(o.sell_price.base.amount);
                const quoteUnits = big(o.sell_price.quote.amount);
                const remaining =
                    baseUnits > BigInt(0)
                        ? (forSale * quoteUnits + baseUnits - BigInt(1)) /
                          baseUnits
                        : BigInt(0);
                return {
                    id: o.id,
                    sell_asset: sell ? sell.symbol : o.sell_price.base.asset_id,
                    for_sale: sell
                        ? fromUnits(forSale, sell.precision)
                        : String(o.for_sale),
                    receive_asset: receive
                        ? receive.symbol
                        : o.sell_price.quote.asset_id,
                    least_to_receive: receive
                        ? fromUnits(remaining, receive.precision)
                        : String(remaining),
                    expiration: o.expiration + " UTC"
                };
            })
        };
    },

    async bitshares_get_account_history(ctx, args) {
        const account = await getAccount(ctx, args.account);
        const limit = args.limit || 20;
        const [rows, properties] = await Promise.all([
            ctx.rpc.call("history", "get_account_history", [
                account.id,
                "1.11.0",
                limit,
                "1.11.0"
            ]),
            db(ctx, "get_dynamic_global_properties", [])
        ]);
        const headMs = parseChainTime(properties.time);
        return {
            account: {id: account.id, name: account.name},
            head_block_number: properties.head_block_number,
            operations: (rows || []).slice(0, limit).map(h => {
                const approx = Number.isNaN(headMs)
                    ? null
                    : chainTime(
                          new Date(
                              headMs -
                                  (properties.head_block_number - h.block_num) *
                                      3000
                          )
                      );
                return {
                    id: h.id,
                    block_num: h.block_num,
                    approximate_time: approx ? approx + " UTC" : null,
                    operation:
                        OPERATION_NAMES[h.op[0]] || "operation_" + h.op[0],
                    fields: tame(h.op[1], 0)
                };
            })
        };
    },

    async bitshares_get_pool(ctx, args) {
        const rows =
            (await db(ctx, "get_liquidity_pools", [[args.pool], false])) || [];
        if (!rows[0])
            throw new UserError(
                `There is no liquidity pool ${args.pool}.`,
                "not_found"
            );
        const assets = await getAssets(ctx, [
            rows[0].asset_a,
            rows[0].asset_b,
            rows[0].share_asset
        ]);
        return pool(rows[0], assets, assets);
    },

    async bitshares_find_pools(ctx, args) {
        const a = await getAsset(ctx, args.asset_a);
        const limit = args.limit || 10;
        let rows;
        if (args.asset_b) {
            const b = await getAsset(ctx, args.asset_b);
            if (a.id === b.id)
                throw new UserError("The two assets must differ.");
            rows = await db(ctx, "get_liquidity_pools_by_both_assets", [
                a.id,
                b.id,
                limit,
                null,
                false
            ]);
        } else {
            rows = await db(ctx, "get_liquidity_pools_by_one_asset", [
                a.id,
                limit,
                null,
                false
            ]);
        }
        rows = rows || [];
        const assets = await getAssets(
            ctx,
            rows.reduce(
                (ids, r) => ids.concat([r.asset_a, r.asset_b, r.share_asset]),
                []
            )
        );
        return {
            count: rows.length,
            pools: rows.map(r => pool(r, assets, assets))
        };
    },

    async bitshares_get_price_history(ctx, args) {
        const base = await getAsset(ctx, args.base);
        const quote = await getAsset(ctx, args.quote);
        if (base.id === quote.id)
            throw new UserError("The two assets of a market must differ.");
        const interval = args.interval || "1h";
        const seconds = BUCKETS[interval];
        const limit = args.limit || 48;
        const end = ctx.now();
        const rows =
            (await ctx.rpc.call("history", "get_market_history", [
                base.id,
                quote.id,
                seconds,
                chainTime(new Date(end - limit * seconds * 1000)),
                chainTime(new Date(end))
            ])) || [];
        const scaleBase = Math.pow(10, base.precision);
        const scaleQuote = Math.pow(10, quote.precision);
        const candles = rows
            .map(r => {
                // the amounts are of the pair as the node keeps it: key.base and key.quote
                const flipped = r.key.base !== base.id;
                const price = (b, q) =>
                    flipped
                        ? Number(q) / scaleBase / (Number(b) / scaleQuote)
                        : Number(b) / scaleBase / (Number(q) / scaleQuote);
                const high = price(r.high_base, r.high_quote);
                const low = price(r.low_base, r.low_quote);
                return {
                    time: r.key.open + " UTC",
                    open: price8(price(r.open_base, r.open_quote)),
                    high: price8(Math.max(high, low)),
                    low: price8(Math.min(high, low)),
                    close: price8(price(r.close_base, r.close_quote)),
                    base_volume: fromUnits(
                        big(flipped ? r.quote_volume : r.base_volume),
                        base.precision
                    ),
                    quote_volume: fromUnits(
                        big(flipped ? r.base_volume : r.quote_volume),
                        quote.precision
                    )
                };
            })
            .sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
        return {
            base: brief(base),
            quote: brief(quote),
            price_unit: `${base.symbol} per 1 ${quote.symbol}`,
            interval,
            count: candles.length,
            candles
        };
    },

    async bitshares_get_recent_trades(ctx, args) {
        const base = await getAsset(ctx, args.base);
        const quote = await getAsset(ctx, args.quote);
        if (base.id === quote.id)
            throw new UserError("The two assets of a market must differ.");
        const now = ctx.now();
        const rows =
            (await db(ctx, "get_trade_history", [
                base.id,
                quote.id,
                chainTime(new Date(now)),
                chainTime(new Date(now - 90 * 86400 * 1000)),
                args.limit || 20
            ])) || [];
        return {
            base: brief(base),
            quote: brief(quote),
            price_unit: `${base.symbol} per 1 ${quote.symbol}`,
            count: rows.length,
            trades: rows.map(t => ({
                time: t.date + " UTC",
                price: t.price,
                quote_amount: t.amount,
                base_amount: t.value,
                // as the node labels it
                type: t.type
            }))
        };
    },

    async bitshares_get_margin_positions(ctx, args) {
        const account = await getAccount(ctx, args.account);
        const rows =
            (await db(ctx, "get_margin_positions", [account.id])) || [];
        const assets = await getAssets(
            ctx,
            rows.reduce(
                (ids, r) =>
                    ids.concat([
                        r.call_price.base.asset_id,
                        r.call_price.quote.asset_id
                    ]),
                []
            )
        );
        const bitassetIds = Array.from(
            new Set(
                rows
                    .map(
                        r =>
                            assets[r.call_price.quote.asset_id] &&
                            assets[r.call_price.quote.asset_id].bitasset_data_id
                    )
                    .filter(Boolean)
            )
        );
        const bitassets = {};
        if (bitassetIds.length) {
            ((await db(ctx, "get_objects", [bitassetIds])) || []).forEach(b => {
                if (b) bitassets[b.asset_id] = b;
            });
        }
        const positions = rows.map(r => {
            const debtAsset = assets[r.call_price.quote.asset_id];
            const collateralAsset = assets[r.call_price.base.asset_id];
            const feed =
                debtAsset &&
                bitassets[debtAsset.id] &&
                bitassets[debtAsset.id].current_feed;
            const sp = feed && feed.settlement_price;
            const collateral = big(r.collateral);
            const debt = big(r.debt);
            let ratio = null;
            let maintenance = null;
            let risk = "unknown";
            let feedPrice = null;
            let drop = null;
            if (
                sp &&
                usable(sp) &&
                debt > BigInt(0) &&
                sp.base.asset_id === (debtAsset && debtAsset.id)
            ) {
                // the feed: base is the debt asset, quote the collateral, in units
                ratio =
                    ((Number(collateral) * Number(big(sp.base.amount))) /
                        (Number(debt) * Number(big(sp.quote.amount)))) *
                    100;
                maintenance = feed.maintenance_collateral_ratio / 10;
                feedPrice = price8(
                    Number(big(sp.quote.amount)) /
                        Math.pow(
                            10,
                            collateralAsset ? collateralAsset.precision : 0
                        ) /
                        (Number(big(sp.base.amount)) /
                            Math.pow(10, debtAsset.precision))
                );
                risk =
                    ratio < maintenance * 1.05
                        ? "danger"
                        : ratio < maintenance * 1.25
                        ? "watch"
                        : "ok";
                drop =
                    ratio > maintenance
                        ? pct((1 - maintenance / ratio) * 100)
                        : 0;
            }
            return {
                id: r.id,
                debt: {
                    asset: debtAsset
                        ? debtAsset.symbol
                        : r.call_price.quote.asset_id,
                    amount: debtAsset
                        ? fromUnits(debt, debtAsset.precision)
                        : String(r.debt)
                },
                collateral: {
                    asset: collateralAsset
                        ? collateralAsset.symbol
                        : r.call_price.base.asset_id,
                    amount: collateralAsset
                        ? fromUnits(collateral, collateralAsset.precision)
                        : String(r.collateral)
                },
                feed_price: feedPrice,
                feed_price_unit:
                    debtAsset && collateralAsset
                        ? `${collateralAsset.symbol} per 1 ${debtAsset.symbol}`
                        : null,
                collateral_ratio_percent: ratio === null ? null : pct(ratio),
                maintenance_ratio_percent: maintenance,
                target_collateral_ratio_percent: r.target_collateral_ratio
                    ? r.target_collateral_ratio / 10
                    : null,
                collateral_value_can_fall_percent: drop,
                risk
            };
        });
        return {
            account: {id: account.id, name: account.name},
            count: positions.length,
            risk_basis:
                "danger: within 5% of the maintenance ratio; watch: within 25%; ok: further away. The chain margin-calls a position under the maintenance ratio.",
            positions
        };
    },

    async bitshares_get_bitasset(ctx, args) {
        const asset = await getAsset(ctx, args.asset);
        if (!asset.bitasset_data_id) {
            throw new UserError(
                `${asset.symbol} is not a market-pegged asset: it has no collateral and no feed.`
            );
        }
        const bit = ((await db(ctx, "get_objects", [
            [asset.bitasset_data_id]
        ])) || [])[0];
        if (!bit)
            throw new UserError(
                `The node has no data for ${asset.symbol}.`,
                "not_found"
            );
        const options = bit.options || {};
        const collateral = (
            await getAssets(ctx, [options.short_backing_asset])
        )[options.short_backing_asset];
        const feed = bit.current_feed || {};
        const sp = feed.settlement_price;
        const unit = collateral
            ? `${collateral.symbol} per 1 ${asset.symbol}`
            : null;
        const perDebt = p =>
            usable(p) && collateral
                ? price8(
                      Number(big(p.quote.amount)) /
                          Math.pow(10, collateral.precision) /
                          (Number(big(p.base.amount)) /
                              Math.pow(10, asset.precision))
                  )
                : null;
        const initial =
            feed.initial_collateral_ratio !== undefined
                ? feed.initial_collateral_ratio
                : options.extensions &&
                  options.extensions.initial_collateral_ratio;
        return {
            asset: brief(asset),
            collateral_asset: collateral
                ? brief(collateral)
                : {id: options.short_backing_asset},
            feed: {
                price: perDebt(sp),
                price_unit: unit,
                published_at: bit.current_feed_publication_time
                    ? bit.current_feed_publication_time + " UTC"
                    : null,
                maintenance_collateral_ratio_percent:
                    feed.maintenance_collateral_ratio !== undefined
                        ? feed.maintenance_collateral_ratio / 10
                        : null,
                initial_collateral_ratio_percent:
                    initial !== undefined ? initial / 10 : null,
                max_short_squeeze_ratio_percent:
                    feed.maximum_short_squeeze_ratio !== undefined
                        ? feed.maximum_short_squeeze_ratio / 10
                        : null
            },
            feeds_published: (bit.feeds || []).length,
            minimum_feeds: options.minimum_feeds,
            feed_lifetime_hours: options.feed_lifetime_sec
                ? options.feed_lifetime_sec / 3600
                : null,
            force_settlement: {
                delay_hours: options.force_settlement_delay_sec
                    ? options.force_settlement_delay_sec / 3600
                    : null,
                offset_percent:
                    options.force_settlement_offset_percent !== undefined
                        ? options.force_settlement_offset_percent / 100
                        : null,
                max_volume_percent:
                    options.maximum_force_settlement_volume !== undefined
                        ? options.maximum_force_settlement_volume / 100
                        : null
            },
            prediction_market: !!bit.is_prediction_market,
            globally_settled: usable(bit.settlement_price),
            settlement_price: usable(bit.settlement_price)
                ? perDebt(bit.settlement_price)
                : null
        };
    },

    async bitshares_get_vesting_balances(ctx, args) {
        const account = await getAccount(ctx, args.account);
        const rows =
            (await db(ctx, "get_vesting_balances", [account.id])) || [];
        const assets = await getAssets(
            ctx,
            rows.map(r => r.balance.asset_id)
        );
        const nowSec = Math.floor(ctx.now() / 1000);
        return {
            account: {id: account.id, name: account.name},
            count: rows.length,
            balances: rows.map(r => {
                const info = assets[r.balance.asset_id];
                const rule = vestingClaimable(r, nowSec);
                const show = units =>
                    info ? fromUnits(units, info.precision) : String(units);
                return {
                    id: r.id,
                    type: text(r.balance_type, 40),
                    rule: rule.kind,
                    asset: info ? info.symbol : r.balance.asset_id,
                    amount: show(big(r.balance.amount)),
                    claimable_now: show(rule.claimable)
                };
            })
        };
    },

    async bitshares_get_fees(ctx, args) {
        const names =
            args.operations && args.operations.length
                ? args.operations
                : DEFAULT_FEE_OPERATIONS;
        const unknown = names.filter(n => OPERATION_NAMES.indexOf(n) === -1);
        if (unknown.length)
            throw new UserError(
                `Not operations of the chain: ${unknown
                    .map(n => cleanText(n, 40))
                    .join(", ")}.`
            );
        const properties = await db(ctx, "get_global_properties", []);
        const schedule = properties.parameters.current_fees;
        const scale = BigInt(schedule.scale || 10000);
        const core = await getAsset(ctx, CORE);
        return {
            unit: core.symbol,
            scale_percent: Number(scale) / 100,
            fees: names.map(name => {
                const entry = schedule.parameters.find(
                    e => e[0] === OPERATION_NAMES.indexOf(name)
                );
                if (!entry) return {operation: name, fees: null};
                const out = {};
                Object.keys(entry[1]).forEach(key => {
                    if (/^\d+$/.test(String(entry[1][key]))) {
                        out[key] = fromUnits(
                            (big(entry[1][key]) * scale) / BigInt(10000),
                            core.precision
                        );
                    }
                });
                return {operation: name, fees: out};
            })
        };
    },

    async bitshares_search_accounts(ctx, args) {
        const prefix = args.prefix;
        const rows =
            (await db(ctx, "lookup_accounts", [
                prefix,
                args.limit || 10,
                false
            ])) || [];
        return {
            prefix,
            accounts: rows
                .filter(r => r[0].indexOf(prefix) === 0)
                .map(r => ({name: r[0], id: r[1]}))
        };
    },

    async bitshares_get_proposals(ctx, args) {
        const account = await getAccount(ctx, args.account);
        const rows =
            (await db(ctx, "get_proposed_transactions", [account.id])) || [];
        return {
            account: {id: account.id, name: account.name},
            count: rows.length,
            proposals: rows.slice(0, 50).map(p => {
                const operations =
                    (p.proposed_transaction &&
                        p.proposed_transaction.operations) ||
                    [];
                const activeNeeded = p.required_active_approvals || [];
                const activeHave = p.available_active_approvals || [];
                const ownerNeeded = p.required_owner_approvals || [];
                const ownerHave = p.available_owner_approvals || [];
                const activeMissing = activeNeeded.filter(
                    x => activeHave.indexOf(x) === -1
                );
                const ownerMissing = ownerNeeded.filter(
                    x => ownerHave.indexOf(x) === -1
                );
                return {
                    id: p.id,
                    expires: p.expiration_time + " UTC",
                    review_period_ends: p.review_period_time
                        ? p.review_period_time + " UTC"
                        : null,
                    operation_count: operations.length,
                    operations: operations.slice(0, 5).map(o => ({
                        operation: OPERATION_NAMES[o[0]] || "operation_" + o[0],
                        fields: tame(o[1], 0)
                    })),
                    active_approvals_missing: activeMissing,
                    owner_approvals_missing: ownerMissing,
                    approved_by: activeHave
                        .concat(ownerHave)
                        .filter((x, i, all) => all.indexOf(x) === i),
                    waiting_for_this_account:
                        activeMissing
                            .concat(ownerMissing)
                            .indexOf(account.id) !== -1
                };
            })
        };
    }
};

// ---- trading: prepares, never signs ------------------------------------------------

function requireTrading(ctx) {
    if (!ctx.config.trading.enabled) {
        throw new UserError(
            "Trading is not enabled on this server (MCP_TRADING_ENABLED).",
            "disabled"
        );
    }
}

function allowedAccount(ctx, account) {
    if (ctx.config.trading.accounts.indexOf(account.name) === -1) {
        throw new UserError(
            `${
                account.name
            } is not one of the accounts the person allowed (${ctx.config.trading.accounts.join(
                ", "
            )}).`,
            "account_not_allowed"
        );
    }
}

function reviewUrl(config, encoded) {
    return config.appHashRouter
        ? `${config.appUrl}/#/mcp/review?p=${encoded}`
        : `${config.appUrl}/mcp/review#p=${encoded}`;
}

async function finish(ctx, account, op, summaryAssets, extra) {
    const chain = await db(ctx, "get_chain_id", []);
    const now = ctx.now();
    const proposal = {
        v: proposalLib.VERSION,
        chain,
        account: {id: account.id, name: account.name},
        ops: [op],
        created: new Date(now).toISOString().slice(0, 19) + "Z",
        expires:
            new Date(now + ctx.config.trading.proposalTtlMinutes * 60000)
                .toISOString()
                .slice(0, 19) + "Z",
        nonce: ctx.randomHex(8),
        ref: ""
    };
    proposal.ref = proposalLib.fingerprint(proposal, ctx.sha256Hex);
    const lookup = id =>
        summaryAssets[id]
            ? {
                  symbol: summaryAssets[id].symbol,
                  precision: summaryAssets[id].precision
              }
            : null;
    return Object.assign(
        {
            status: "prepared",
            signed: false,
            sent: false,
            account: account.name,
            summary: proposalLib.summarize(op, lookup),
            reference: proposal.ref,
            proposal_expires_at: proposal.expires
                .replace("T", " ")
                .replace("Z", " UTC"),
            review_url: reviewUrl(
                ctx.config,
                proposalLib.encodeProposal(proposal)
            ),
            next_step:
                "Give the person the review_url and the reference. They open it in BitShares Desk, check that the reference matches, read the order the application shows and sign it with their own wallet - or leave it. Nothing has been placed, and you cannot place it."
        },
        extra
    );
}

const trading = {
    async bitshares_trading_policy(ctx) {
        requireTrading(ctx);
        const t = ctx.config.trading;
        return {
            accounts: t.accounts,
            assets: Object.keys(t.limits).map(symbol => ({
                symbol,
                max_per_order: t.limits[symbol].perOrder,
                max_per_24_hours: t.limits[symbol].perDay
            })),
            max_price_deviation_percent: t.maxDeviationPercent,
            max_order_hours: t.maxExpirationHours,
            proposal_valid_minutes: t.proposalTtlMinutes,
            max_proposals_per_hour: t.preparePerHour,
            unpriced_markets_allowed: t.allowUnpriced,
            signing: "only by the person, in their own wallet"
        };
    },

    async bitshares_prepare_limit_order(ctx, args) {
        requireTrading(ctx);
        const t = ctx.config.trading;
        const now = ctx.now();
        policy.checkRate(ctx.ledger, now, t.preparePerHour);
        const account = await getAccount(ctx, args.account);
        allowedAccount(ctx, account);
        const sell = await getAsset(ctx, args.sell_asset);
        const receive = await getAsset(ctx, args.receive_asset);
        if (sell.id === receive.id)
            throw new UserError(
                "The asset to sell and the asset to receive must differ."
            );
        policy.allowedReceive(t, receive.symbol.toUpperCase());
        const sellUnits = toUnits(args.sell_amount, sell.precision);
        const receiveUnits = toUnits(args.receive_amount, receive.precision);
        if (sellUnits === BigInt(0) || receiveUnits === BigInt(0))
            throw new UserError("Both amounts must be above zero.");
        const hours =
            args.expires_in_hours === undefined
                ? Math.min(24, t.maxExpirationHours)
                : args.expires_in_hours;
        if (hours > t.maxExpirationHours) {
            throw new UserError(
                `An order may stay open for ${t.maxExpirationHours} hours at most (the person's limit); ${hours} was asked.`
            );
        }
        const soldBefore = policy.checkSellLimits(
            t,
            ctx.ledger,
            now,
            sell.symbol.toUpperCase(),
            sell.precision,
            sellUnits
        );

        const balances =
            (await db(ctx, "get_account_balances", [account.id, [sell.id]])) ||
            [];
        const have = balances[0] ? big(balances[0].amount) : BigInt(0);
        if (have < sellUnits) {
            throw new UserError(
                `${account.name} has ${fromUnits(have, sell.precision)} ${
                    sell.symbol
                } free (what is in open orders is not counted); ${
                    args.sell_amount
                } is more.`,
                "insufficient_balance"
            );
        }

        const ticker = await db(ctx, "get_ticker", [sell.id, receive.id]);
        const price = policy.checkPrice(
            t,
            ticker,
            Number(sellUnits) / Math.pow(10, sell.precision),
            Number(receiveUnits) / Math.pow(10, receive.precision)
        );

        const op = [
            proposalLib.OPERATIONS.limit_order_create,
            {
                fee: {amount: "0", asset_id: CORE},
                seller: account.id,
                amount_to_sell: {
                    amount: sellUnits.toString(),
                    asset_id: sell.id
                },
                min_to_receive: {
                    amount: receiveUnits.toString(),
                    asset_id: receive.id
                },
                expiration: chainTime(new Date(now + hours * 3600 * 1000)),
                fill_or_kill: !!args.fill_or_kill,
                extensions: []
            }
        ];
        const assets = {};
        assets[sell.id] = sell;
        assets[receive.id] = receive;
        const result = await finish(ctx, account, op, assets, {
            checks: {
                price_unit: `${sell.symbol} per 1 ${receive.symbol}`,
                market_price:
                    price.market === null
                        ? null
                        : Number(price.market.toPrecision(6)),
                price_vs_market_percent:
                    price.deviationPercent === null
                        ? null
                        : Number(price.deviationPercent.toFixed(2)),
                limit_per_order: `${
                    t.limits[sell.symbol.toUpperCase()].perOrder
                } ${sell.symbol}`,
                prepared_in_last_24_hours_before_this: `${fromUnits(
                    soldBefore,
                    sell.precision
                )} ${sell.symbol}`,
                free_balance: `${fromUnits(have, sell.precision)} ${
                    sell.symbol
                }`,
                note:
                    "The fee is paid on top, in BTS, when the order is signed."
            }
        });
        policy.record(ctx.ledger, now, sell.symbol.toUpperCase(), sellUnits);
        return result;
    },

    async bitshares_prepare_cancel_order(ctx, args) {
        requireTrading(ctx);
        const t = ctx.config.trading;
        policy.checkRate(ctx.ledger, ctx.now(), t.preparePerHour);
        if (!ORDER_ID.test(args.order_id))
            throw new UserError("order_id must look like 1.7.575851520.");
        const account = await getAccount(ctx, args.account);
        allowedAccount(ctx, account);
        const orders =
            (await db(ctx, "get_limit_orders_by_account", [account.id, 100])) ||
            [];
        const order = orders.find(o => o.id === args.order_id);
        if (!order) {
            throw new UserError(
                `${account.name} has no open order ${args.order_id} (among its newest 100).`,
                "not_found"
            );
        }
        const op = [
            proposalLib.OPERATIONS.limit_order_cancel,
            {
                fee: {amount: "0", asset_id: CORE},
                fee_paying_account: account.id,
                order: order.id,
                extensions: []
            }
        ];
        const result = await finish(ctx, account, op, {}, {});
        policy.record(ctx.ledger, ctx.now(), "__cancel__", BigInt(0));
        return result;
    }
};

const HANDLERS = Object.assign({}, reads, trading);

/** The tool definitions that are on, in the form tools/list gives them. */
function listTools(config) {
    return TOOLS.filter(
        tool =>
            tool.group === "read" || (config.enabled && config.trading.enabled)
    ).map(tool => ({
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: Object.assign({title: tool.title}, tool.annotations)
    }));
}

module.exports = {createContext, listTools, HANDLERS, tame};
