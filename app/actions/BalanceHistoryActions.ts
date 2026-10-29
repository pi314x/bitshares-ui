import {Apis} from "bitsharesjs-ws";
import SametFundActions from "./SametFundActions";
import {HistoryEntry, PAGE, olderStart} from "../lib/common/balanceHistory";
import {settingsAPIs} from "api/apiConfig";
import {
    MAIN_CHAIN_ID,
    historyNodeCandidates,
    olderHistoryFromOtherNodes
} from "../lib/chain/olderHistory";

export {PAGE, olderStart};

function db(): any {
    return (Apis as any).instance().db_api();
}

function history(): any {
    return (Apis as any).instance().history_api();
}

class BalanceHistoryActionsFacade {
    /** The chain the connected node serves, for a cache that must not mix two. */
    chainKey(): string {
        try {
            const id = (Apis as any).instance().chain_id;
            return id ? String(id).substring(0, 8) : "chain";
        } catch (e) {
            return "chain";
        }
    }

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

    /**
     * Operations older than the connected node keeps, from the other public
     * nodes (see lib/chain/olderHistory.ts). `[]` when there are none or when
     * this is not the main chain; `source` names the node that answered.
     */
    async getOlderFromOtherNodes(
        accountId: string,
        startId: string,
        limit: number = PAGE
    ): Promise<{rows: any[]; source: string | null}> {
        try {
            const api = (Apis as any).instance();
            if (api.chain_id && api.chain_id !== MAIN_CHAIN_ID) {
                return {rows: [], source: null};
            }
            const candidates = historyNodeCandidates(
                (settingsAPIs as any).WS_NODE_LIST,
                api.url ? [api.url] : []
            );
            const found = await olderHistoryFromOtherNodes(
                accountId,
                startId,
                limit,
                candidates
            );
            return {rows: found.rows, source: found.node};
        } catch (error) {
            return {rows: [], source: null};
        }
    }

    /**
     * A page of history with the other nodes as the fallback for what the
     * connected one no longer has. `source` is the node the page came from when
     * it was not the connected one.
     */
    async getHistoryPage(
        accountId: string,
        start?: string | null
    ): Promise<{rows: HistoryEntry[]; source: string | null}> {
        const own = await this.getHistory(accountId, start);
        if (own.length || !start) return {rows: own, source: null};
        const other = await this.getOlderFromOtherNodes(accountId, start);
        return {
            rows: other.rows.map((row: any) => ({
                id: String(row.id),
                op: row.op,
                result: row.result,
                block_num: Number(row.block_num)
            })),
            source: other.source
        };
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
