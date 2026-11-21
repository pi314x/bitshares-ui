// Older account history from another node.
//
// A node only keeps as many operations per account as its operator configured:
// the one the user is connected to may stop after the last 100 while others
// have years of it. When the connected node has nothing older, the history is
// asked from the other public nodes of the list, one after the other, over a
// plain JSON-RPC websocket of their own (the app's connection is not touched).
//
// This is display data only - nothing from it is signed - and it needs no
// credentials. It does tell those nodes which account is being looked at, so
// it is only done for the history screens that ask for older operations, and
// only on the main chain (the nodes are the main chain's).

export interface HistoryRow {
    id: string;
    op: [number, any];
    result?: any;
    block_num: number;
    trx_in_block?: number;
    op_in_trx?: number;
    virtual_op?: number;
}

export const MAIN_CHAIN_ID =
    "4018d7844c78f6a6c41c6a552b898022310fc5dec06da467ee7905a8dad512c8";

/** The public main-chain nodes from the settings list, in list order. */
export function historyNodeCandidates(
    nodeList: {url: string; region?: string}[],
    exclude: string[] = []
): string[] {
    return nodeList
        .filter(node => {
            const url = node.url || "";
            return (
                url.startsWith("wss://") &&
                url.indexOf("fake.") === -1 &&
                !(node.region || "").toUpperCase().startsWith("TESTNET") &&
                exclude.indexOf(url) === -1
            );
        })
        .map(node => node.url);
}

interface Pending {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
}

/** One request/response conversation over a node's JSON-RPC websocket. */
export function askNode<T>(
    url: string,
    calls: (
        call: (api: number, method: string, params: any[]) => Promise<any>
    ) => Promise<T>,
    timeoutMs = 8000,
    WebSocketImpl: any = typeof WebSocket !== "undefined" ? WebSocket : null
): Promise<T> {
    return new Promise<T>((resolve, reject) => {
        if (!WebSocketImpl) {
            reject(new Error("no websocket"));
            return;
        }
        let socket: any;
        let done = false;
        let nextId = 0;
        const pending: {[id: number]: Pending} = {};
        const finish = (fn: () => void) => {
            if (done) return;
            done = true;
            clearTimeout(timer);
            try {
                socket && socket.close();
            } catch (e) {
                // already closed
            }
            fn();
        };
        const timer = setTimeout(
            () => finish(() => reject(new Error("timeout"))),
            timeoutMs
        );
        const call = (api: number, method: string, params: any[]) =>
            new Promise<any>((res, rej) => {
                const id = ++nextId;
                pending[id] = {resolve: res, reject: rej};
                socket.send(
                    JSON.stringify({
                        id,
                        method: "call",
                        params: [api, method, params]
                    })
                );
            });
        try {
            socket = new WebSocketImpl(url);
        } catch (e) {
            finish(() => reject(e));
            return;
        }
        socket.onerror = () => finish(() => reject(new Error("socket error")));
        socket.onclose = () => finish(() => reject(new Error("closed")));
        socket.onmessage = (event: {data: string}) => {
            let message: any;
            try {
                message = JSON.parse(event.data);
            } catch (e) {
                return;
            }
            const waiting = pending[message.id];
            if (!waiting) return;
            delete pending[message.id];
            if (message.error) {
                waiting.reject(new Error(message.error.message || "error"));
            } else {
                waiting.resolve(message.result);
            }
        };
        socket.onopen = () => {
            calls(call).then(
                value => finish(() => resolve(value)),
                error => finish(() => reject(error))
            );
        };
    });
}

/** `get_account_history` on one node, or throws. */
export function accountHistoryFromNode(
    url: string,
    accountId: string,
    startId: string,
    limit: number,
    WebSocketImpl?: any
): Promise<HistoryRow[]> {
    return askNode<HistoryRow[]>(
        url,
        async call => {
            await call(1, "login", ["", ""]);
            const historyApi = await call(1, "history", []);
            return call(historyApi, "get_account_history", [
                accountId,
                "1.11.0",
                limit,
                startId
            ]);
        },
        8000,
        WebSocketImpl
    );
}

const idNumber = (id: string) => Number(String(id).split(".")[2]);

let lastGoodNode: string | null = null;

/**
 * Operations of `accountId` from `startId` downwards, taken from the first node
 * in `candidates` that has any. Resolves `{rows: [], node: null}` when none
 * does. Rows that are not older than `startId` are dropped (a node that
 * ignores the start would otherwise repeat the newest page).
 */
export async function olderHistoryFromOtherNodes(
    accountId: string,
    startId: string,
    limit: number,
    candidates: string[],
    maxTries = 4,
    WebSocketImpl?: any
): Promise<{rows: HistoryRow[]; node: string | null}> {
    const ordered = lastGoodNode
        ? [lastGoodNode].concat(candidates.filter(c => c !== lastGoodNode))
        : candidates.slice();
    let tries = 0;
    for (const url of ordered) {
        if (tries >= maxTries) break;
        tries += 1;
        try {
            const rows = await accountHistoryFromNode(
                url,
                accountId,
                startId,
                limit,
                WebSocketImpl
            );
            const limitId = idNumber(startId);
            const older = (rows || []).filter(
                row => row && idNumber(row.id) <= limitId
            );
            if (older.length) {
                lastGoodNode = url;
                return {rows: older, node: url};
            }
        } catch (e) {
            // this node is down or too slow: the next one
        }
    }
    return {rows: [], node: null};
}

/** For tests. */
export function resetLastGoodNode() {
    lastGoodNode = null;
}
