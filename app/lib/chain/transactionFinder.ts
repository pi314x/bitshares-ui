// The connected node as the transaction finder (lib/common/findTransaction.ts) asks for it, and the
// public index of the main chain's history for a transaction the node no longer knows.
import {Apis} from "bitsharesjs-ws";
import {TxChain, indexHit} from "../common/findTransaction";
import {MAIN_CHAIN_ID} from "./olderHistory";

const api = () => (Apis as any).instance();
const db = () => api().db_api();

/** Elasticsearch of the BitShares history (es.bitshares.dev): it holds the main chain only. */
export const INDEX_URL = "https://es.bitshares.dev/bitshares-*/_search";
export const INDEX_HOST = "es.bitshares.dev";
const INDEX_TIMEOUT_MS = 10000;

/** What the index is asked: which block (and place in it) has the transaction with this id. Only the id leaves the app. */
export function indexQuery(id: string) {
    return {
        query: {
            bool: {
                must: [{match: {"block_data.trx_id.keyword": {query: id}}}]
            }
        },
        size: 1,
        _source: ["block_data.block_num", "operation_history.trx_in_block"]
    };
}

export const liveChain: TxChain = {
    recentTransaction: id => db().exec("get_recent_transaction_by_id", [id]),
    headBlock: () =>
        db()
            .exec("get_dynamic_global_properties", [])
            .then((props: any) => props.head_block_number as number),
    block: num => db().exec("get_block", [num]),
    indexed: async id => {
        // (a test network's blocks are not in it)
        if (api().chain_id && api().chain_id !== MAIN_CHAIN_ID) return null;
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), INDEX_TIMEOUT_MS);
        try {
            const response = await fetch(INDEX_URL, {
                method: "POST",
                headers: {"Content-Type": "application/json"},
                body: JSON.stringify(indexQuery(id)),
                signal: controller.signal
            });
            if (!response.ok)
                throw new Error(`${INDEX_HOST}: ${response.status}`);
            return indexHit(await response.json());
        } finally {
            clearTimeout(timer);
        }
    }
};
