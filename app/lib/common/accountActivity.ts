// What happened to the connected account, as the notification bell tells it: one entry
// for every operation in the account's history that is newer than the last one the user
// was told about. A transfer, an order, a settlement, a margin call, a vote - whatever the
// chain recorded for the account, not only the trades.
import {HistoryEntry, formatAssetAmount, historySequence} from "./fills";

export type NoteKind = "success" | "error" | "warning" | "info";

export interface ActivityNote {
    kind: NoteKind;
    title: string;
    description: string;
    /** The account started it itself: the app has already said so with a toast of its own. */
    mine: boolean;
    /** The page of the transaction it was in (a route of the app), when the chain says where it is. */
    link?: string;
    /** What it is about, for choosing what is told elsewhere (Telegram). */
    topic: "trade" | "pool" | "transfer" | "other";
}

const TRADE_OPS = new Set([
    "limit_order_create",
    "limit_order_cancel",
    "limit_order_update",
    "fill_order",
    "call_order_update",
    "asset_settle",
    "asset_settle_cancel",
    "bid_collateral",
    "execute_bid"
]);

/** The topic of an operation by its name. */
export function topicOf(name: string | undefined): ActivityNote["topic"] {
    if (!name) return "other";
    if (TRADE_OPS.has(name)) return "trade";
    if (name.startsWith("liquidity_pool_") || name.startsWith("samet_fund_")) {
        return "pool";
    }
    if (name === "transfer" || name === "override_transfer") return "transfer";
    return "other";
}

/** What the notes need from outside: the names of things and the words. */
export interface ActivityContext {
    accountId: string;
    /** The operation's name by its number ("transfer"), as bitsharesjs lists them. */
    opName: (code: number) => string | undefined;
    assetOf: (
        id: string
    ) => {symbol: string; precision: number} | null | undefined;
    accountName: (id: string) => string | undefined;
    /** counterpart.translate under `notification_center.` */
    t: (key: string, params?: Record<string, any>) => string;
    /** the name of an operation type in the user's language */
    typeLabel: (name: string) => string;
}

// operations the chain makes by itself: nobody at the account pressed a button
const VIRTUAL = new Set([
    "fill_order",
    "asset_settle_cancel",
    "fba_distribute",
    "execute_bid",
    "htlc_redeemed",
    "htlc_refund",
    "credit_deal_expired"
]);

// the field that names who started an operation, in the order they are looked for
const STARTER_FIELDS = [
    "fee_paying_account",
    "from",
    "seller",
    "funding_account",
    "account",
    "issuer",
    "payer",
    "owner",
    "borrower",
    "creator",
    "registrar",
    "deposit_account",
    "authorizing_account"
];

const ASSET_ID = /^1\.3\.\d+$/;
const ACCOUNT_ID = /^1\.2\.\d+$/;

/**
 * The operations of `entries` newer than `after`, oldest first, at most `limit` (the newest
 * ones when there are more).
 */
export function newOperations(
    entries: HistoryEntry[],
    after: number,
    limit = 30
): HistoryEntry[] {
    const fresh = entries
        .filter(e => e && e.op && historySequence(e.id) > after)
        .sort((a, b) => historySequence(a.id) - historySequence(b.id));
    return fresh.slice(-limit);
}

/** The assets and accounts an operation names, to be looked up before it is written out. */
export function referencedIds(
    entries: HistoryEntry[]
): {assets: string[]; accounts: string[]} {
    const assets = new Set<string>();
    const accounts = new Set<string>();
    const visit = (value: any, depth: number) => {
        if (depth > 6 || value === null || value === undefined) return;
        if (typeof value === "string") {
            if (ASSET_ID.test(value)) assets.add(value);
            else if (ACCOUNT_ID.test(value)) accounts.add(value);
            return;
        }
        if (Array.isArray(value)) {
            value.forEach(v => visit(v, depth + 1));
        } else if (typeof value === "object") {
            Object.keys(value).forEach(k => visit(value[k], depth + 1));
        }
    };
    entries.forEach(e => {
        visit(e.op[1], 0);
        // the result of an instant settlement names the asset received
        visit(e.result, 0);
    });
    return {assets: Array.from(assets), accounts: Array.from(accounts)};
}

/** Whether the account itself started the operation (a virtual one is nobody's). */
export function startedByAccount(
    name: string | undefined,
    data: any,
    accountId: string
): boolean {
    if (!data || (name && VIRTUAL.has(name))) return false;
    for (const field of STARTER_FIELDS) {
        if (typeof data[field] === "string") return data[field] === accountId;
    }
    return false;
}

/** The page of the transaction an operation is in: the block, and the transaction in it. */
export function activityLink(entry: HistoryEntry): string | undefined {
    const block = entry.block_num;
    if (typeof block !== "number" || !Number.isInteger(block) || block <= 0) {
        return undefined;
    }
    const index = entry.trx_in_block;
    return typeof index === "number" && Number.isInteger(index) && index >= 0
        ? `/block/${block}/${index}`
        : `/block/${block}`;
}

/** A price as an exchange says it: " (1 BITEUR = 1,186.2 BTS)" - the asset sold, and what one unit of it fetched - or nothing. */
export function priceText(ctx: ActivityContext, sold: any, got: any): string {
    if (!sold || !got) return "";
    const a = ctx.assetOf(String(sold.asset_id));
    const b = ctx.assetOf(String(got.asset_id));
    if (!a || !b) return "";
    const units = Number(sold.amount) / Math.pow(10, a.precision);
    const back = Number(got.amount) / Math.pow(10, b.precision);
    if (!(units > 0) || !(back > 0)) return "";
    const price = back / units;
    // six significant digits, however small or large
    const shown = Number(price.toPrecision(6)).toLocaleString("en-US", {
        maximumFractionDigits: 10
    });
    return ` (1 ${a.symbol} = ${shown} ${b.symbol})`;
}

/** What a pool operation received, from the operation's result (`received` of the generic exchange result). */
function receivedOf(entry: HistoryEntry): any {
    const result: any = entry.result;
    const body = Array.isArray(result) ? result[1] : result;
    const list = body && Array.isArray(body.received) ? body.received : [];
    return list.length ? list[0] : null;
}

const poolId = (id: any) => String(id || "").replace("1.19.", "#");
const fundId = (id: any) => String(id || "").replace("1.20.", "#");

const amountOf = (ctx: ActivityContext, amount: any): string =>
    amount
        ? formatAssetAmount(
              amount,
              ctx.assetOf(String(amount.asset_id)) || undefined
          )
        : "";

const nameOf = (ctx: ActivityContext, id: any): string =>
    (typeof id === "string" && ctx.accountName(id)) || String(id || "");

/** One entry of the account's history as a title and a line saying what it was. */
export function describeActivity(
    entry: HistoryEntry,
    ctx: ActivityContext
): ActivityNote {
    const code = entry.op[0];
    const data = entry.op[1] || {};
    const name = ctx.opName(code);
    const label = name ? ctx.typeLabel(name) : String(code);
    const mine = startedByAccount(name, data, ctx.accountId);
    const amount = (a: any) => amountOf(ctx, a);
    const link = activityLink(entry);
    const note = (
        kind: NoteKind,
        title: string,
        description = ""
    ): ActivityNote => ({
        kind,
        title,
        description,
        mine,
        topic: topicOf(name),
        ...(link ? {link} : {})
    });

    switch (name) {
        case "transfer":
            return data.from === ctx.accountId
                ? note(
                      "success",
                      label,
                      ctx.t("sent", {
                          amount: amount(data.amount),
                          to: nameOf(ctx, data.to)
                      })
                  )
                : note(
                      "success",
                      label,
                      ctx.t("received", {
                          amount: amount(data.amount),
                          from: nameOf(ctx, data.from)
                      })
                  );
        case "limit_order_create":
            return note(
                "info",
                label,
                ctx.t("order_placed", {
                    sell: amount(data.amount_to_sell),
                    receive: amount(data.min_to_receive),
                    price: priceText(
                        ctx,
                        data.amount_to_sell,
                        data.min_to_receive
                    )
                })
            );
        case "liquidity_pool_exchange": {
            const received = receivedOf(entry);
            return received
                ? note(
                      "success",
                      ctx.t("pool_swap_title"),
                      ctx.t("pool_swap", {
                          pays: amount(data.amount_to_sell),
                          receives: amount(received),
                          pool: poolId(data.pool),
                          price: priceText(ctx, data.amount_to_sell, received)
                      })
                  )
                : note(
                      "info",
                      ctx.t("pool_swap_title"),
                      ctx.t("pool_swap_asked", {
                          pays: amount(data.amount_to_sell),
                          min: amount(data.min_to_receive),
                          pool: poolId(data.pool)
                      })
                  );
        }
        case "liquidity_pool_deposit":
            return note(
                "success",
                ctx.t("pool_deposit_title"),
                ctx.t("pool_deposit", {
                    a: amount(data.amount_a),
                    b: amount(data.amount_b),
                    pool: poolId(data.pool)
                })
            );
        case "liquidity_pool_withdraw":
            return note(
                "success",
                ctx.t("pool_withdraw_title"),
                ctx.t("pool_withdraw", {
                    share: amount(data.share_amount),
                    pool: poolId(data.pool)
                })
            );
        case "samet_fund_borrow":
            return note(
                "info",
                ctx.t("loan_title"),
                ctx.t("loan_borrowed", {
                    amount: amount(data.borrow_amount),
                    fund: fundId(data.fund_id)
                })
            );
        case "samet_fund_repay":
            return note(
                "info",
                ctx.t("loan_title"),
                ctx.t("loan_repaid", {
                    amount: amount(data.repay_amount),
                    fee: amount(data.fund_fee),
                    fund: fundId(data.fund_id)
                })
            );
        case "limit_order_cancel":
            return note(
                "info",
                label,
                ctx.t("order_cancelled", {order: String(data.order || "")})
            );
        case "call_order_update":
            return note(
                "info",
                label,
                ctx.t("borrow_changed", {
                    collateral: amount(data.delta_collateral),
                    debt: amount(data.delta_debt)
                })
            );
        case "fill_order": {
            const pays = amount(data.pays);
            const receives = amount(data.receives);
            const order = String(data.order_id || "");
            // the object the fill belongs to says what it was: 1.4 a forced settlement, 1.8 a
            // margin call, 1.7 a limit order
            if (order.startsWith("1.4.")) {
                return note(
                    "success",
                    ctx.t("settlement_title"),
                    ctx.t("settle_done", {pays, receives})
                );
            }
            if (order.startsWith("1.8.")) {
                return note(
                    "warning",
                    ctx.t("margin_call_title"),
                    ctx.t("margin_call", {pays, receives})
                );
            }
            return note(
                "success",
                ctx.t(data.is_maker ? "order_filled_title" : "trade_done"),
                ctx.t(data.is_maker ? "trade_sold_maker" : "trade_sold", {
                    pays,
                    receives,
                    price: priceText(ctx, data.pays, data.receives),
                    order: order.replace(/^1\.7\./, "#")
                })
            );
        }
        case "asset_settle": {
            // an instant settlement (of a prediction market or a globally settled asset) says
            // at once what was received; the others wait for the settlement delay
            const result: any = entry.result;
            const received =
                Array.isArray(result) && result[0] === 2 ? result[1] : null;
            return note(
                "info",
                ctx.t("settlement_title"),
                received && received.amount
                    ? ctx.t("settle_instant", {
                          amount: amount(data.amount),
                          received: amount(received)
                      })
                    : ctx.t("settle_requested", {amount: amount(data.amount)})
            );
        }
        case "asset_settle_cancel":
            return note(
                "warning",
                ctx.t("settlement_title"),
                ctx.t("settle_cancelled", {amount: amount(data.amount)})
            );
        default:
            // any other operation: its name and, when it moves an amount, the amount
            return note("info", label, data.amount ? amount(data.amount) : "");
    }
}
