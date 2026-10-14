import {Apis} from "bitsharesjs-ws";
import SametFundActions from "./SametFundActions";
import {HistoryEntry} from "../lib/common/balanceHistory";

/** How many operations one request asks for (the node serves at most 100). */
export const PAGE = 100;

/** "1.11.57" -> "1.11.56": where the page of older operations starts. */
export function olderStart(entries: HistoryEntry[]): string | null {
    if (!entries.length) return null;
    const last = entries[entries.length - 1].id.split(".");
    const n = Number(last[2]);
    return n > 1 ? `${last[0]}.${last[1]}.${n - 1}` : null;
}

function db(): any {
    return (Apis as any).instance().db_api();
}

function history(): any {
    return (Apis as any).instance().history_api();
}

class BalanceHistoryActionsFacade {
    getBalances(accountId: string) {
        return SametFundActions.getBalances(accountId);
    }

    getAssets(ids: string[]) {
        return SametFundActions.getAssets(ids);
    }

    /** What the account has locked in open orders, per asset id (smallest
     * unit, as strings). Empty when the node cannot say. */
    getLockedInOrders(accountId: string): Promise<{[assetId: string]: string}> {
        return db()
            .exec("get_full_accounts", [[accountId], false])
            .then((rows: any[]) => {
                const full = rows && rows[0] && rows[0][1];
                const out: {[assetId: string]: bigint} = {};
                ((full && full.limit_orders) || []).forEach((order: any) => {
                    const asset =
                        order.sell_price &&
                        order.sell_price.base &&
                        order.sell_price.base.asset_id;
                    if (asset && order.for_sale != null) {
                        out[asset] =
                            (out[asset] || BigInt(0)) + BigInt(order.for_sale);
                    }
                });
                const result: {[assetId: string]: string} = {};
                Object.keys(out).forEach(k => (result[k] = out[k].toString()));
                return result;
            })
            .catch(() => ({}));
    }

    /** One page of the account's history, newest first, starting at `start`
     * (inclusive; omitted = the newest operation). */
    getHistory(
        accountId: string,
        start?: string | null
    ): Promise<HistoryEntry[]> {
        return history()
            .exec("get_account_history", [
                accountId,
                "1.11.0",
                PAGE,
                start || "1.11.0"
            ])
            .then((rows: any[]) =>
                (rows || []).map(row => ({
                    id: String(row.id),
                    op: row.op,
                    result: row.result,
                    block_num: Number(row.block_num)
                }))
            );
    }

    /** block number -> unix seconds, for the given blocks. */
    getBlockTimes(blockNums: number[]): Promise<{[block: number]: number}> {
        const unique = Array.from(new Set(blockNums));
        if (!unique.length) return Promise.resolve({});
        return db()
            .exec("get_block_header_batch", [unique])
            .then((rows: any) => {
                // a map arrives as [[num, header], ...] (or an object)
                const pairs: [any, any][] = Array.isArray(rows)
                    ? rows
                    : Object.keys(rows || {}).map(k => [k, rows[k]]);
                const out: {[block: number]: number} = {};
                pairs.forEach(([num, header]) => {
                    const stamp =
                        header &&
                        (header.timestamp ||
                            (header.header && header.header.timestamp));
                    if (stamp) {
                        out[Number(num)] = Math.floor(
                            new Date(
                                stamp + (/Z$/.test(stamp) ? "" : "Z")
                            ).getTime() / 1000
                        );
                    }
                });
                return out;
            });
    }
}

export default new BalanceHistoryActionsFacade();
