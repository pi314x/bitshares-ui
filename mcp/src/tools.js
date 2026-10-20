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
