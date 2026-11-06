// Keeps what the app shows of the connected account in step with the chain, without a reload (F5): the chain
// store's data is checked against the chain every few blocks (a notice that was missed is made good), and the
// pages that read the account's data by themselves are told when it may have changed (`accountEpoch.ts`). The
// logic is `lib/chain/accountFreshness.ts`; this wires it to the real chain store, the clock of the blocks, the
// page coming to the front and the connection. It draws nothing.
import * as React from "react";
import {Apis} from "bitsharesjs-ws";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "../next/hooks/useChainStoreTick";
import {useReduxState} from "../next/hooks/useReduxState";
import {selectAccountState} from "../store/slices/accountSlice";
import {selectBlockchain} from "../store/slices/blockchainSlice";
import {bumpAccountEpoch} from "../lib/common/accountEpoch";
import {Freshness, createFreshness} from "../lib/chain/accountFreshness";

/** A look at the chain's statistics of the account every this many blocks, and by the clock at the least this often. */
const BLOCKS_BETWEEN_LOOKS = 2;
const BLOCK_TIME_MS = 3000;
const CLOCK_LOOK_MS = 9000;

const db = () => (Apis as any).instance().db_api();

function headBlockNumber(): number | null {
    const dynamic: any = (ChainStore as any).getObject("2.1.0");
    if (!dynamic || typeof dynamic.get !== "function") return null;
    const number = Number(dynamic.get("head_block_number"));
    return Number.isFinite(number) ? number : null;
}

const accountOf = (name: string): any => {
    try {
        const account: any = (ChainStore as any).getAccount(name);
        return account && typeof account.get === "function" ? account : null;
    } catch (e) {
        return null;
    }
};

/** What the chain store has and the chain says, for the account `name`, as the freshness logic asks for it. */
export function depsFor(name: string) {
    const statisticsId = (): string | null => {
        const account = accountOf(name);
        const id = account ? account.get("statistics") : null;
        return typeof id === "string" ? id : null;
    };
    return {
        chainMostRecent: async (): Promise<string | null> => {
            const id = statisticsId();
            if (!id) return null;
            const rows = await db().exec("get_objects", [[id]]);
            const row = rows && rows[0];
            return row && row.most_recent_op !== undefined
                ? String(row.most_recent_op)
                : null;
        },
        cachedMostRecent: (): string | null => {
            const id = statisticsId();
            const stats: any = id ? (ChainStore as any).getObject(id) : null;
            return stats && typeof stats.get === "function"
                ? String(stats.get("most_recent_op"))
                : null;
        },
        // the account's full data once more, handed to the chain store the way a notice from the node is: the
        // statistics, the balances (a new asset has a new object), the open orders and positions - and the ids
        // of those the chain store has that the chain no longer has (filled, cancelled, closed)
        reconcile: async (): Promise<void> => {
            const results = await db().exec("get_full_accounts", [
                [name],
                false
            ]);
            const full = results && results[0] && results[0][1];
            if (!full) return;
            const objects: any[] = [];
            if (full.statistics) objects.push(full.statistics);
            (full.balances || []).forEach((row: any) => objects.push(row));
            const cached = accountOf(name);
            const same = (key: string, rows: any[] | undefined) => {
                const fresh = new Set((rows || []).map(r => r.id));
                (rows || []).forEach(r => objects.push(r));
                const known = cached ? cached.get(key) : null;
                if (known && typeof known.forEach === "function") {
                    known.forEach((entry: any) => {
                        const id = typeof entry === "string" ? entry : null;
                        if (id && !fresh.has(id)) objects.push(id);
                    });
                }
            };
            same("orders", full.limit_orders);
            same("call_orders", full.call_orders);
            if (objects.length) (ChainStore as any).onUpdate([objects]);
        },
        bump: bumpAccountEpoch,
        now: () => Date.now()
    };
}

export default function AccountFreshness(): null {
    const account = useReduxState<any>(selectAccountState);
    const name: string | null =
        account.currentAccount || account.passwordAccount || null;
    const status = useReduxState<any>(selectBlockchain).rpc_connection_status;
    useChainStoreTick();
    const head = headBlockNumber();

    const freshness = React.useRef<Freshness | null>(null);
    React.useEffect(() => {
        freshness.current = name ? createFreshness(depsFor(name)) : null;
        return () => {
            freshness.current = null;
        };
    }, [name]);

    const visible = () => document.visibilityState === "visible";

    // a look at the chain's statistics of the account: with a new block, but not more often than every few seconds,
    // and by the clock too, in case the blocks do not come through (a subscription that was lost says nothing at all)
    const lastLookAt = React.useRef(0);
    const lookIfDue = React.useCallback((minMs: number) => {
        const f = freshness.current;
        if (!f || !visible()) return;
        f.tick();
        if (Date.now() - lastLookAt.current < minMs) return;
        lastLookAt.current = Date.now();
        void f.check();
    }, []);
    React.useEffect(() => {
        if (head !== null)
            lookIfDue(BLOCKS_BETWEEN_LOOKS * BLOCK_TIME_MS - 500);
    }, [head, name, lookIfDue]);
    React.useEffect(() => {
        const timer = setInterval(
            () => lookIfDue(CLOCK_LOOK_MS),
            BLOCK_TIME_MS
        );
        return () => clearInterval(timer);
    }, [lookIfDue]);

    // the page in view again, and the network back
    React.useEffect(() => {
        let hiddenAt: number | null = null;
        const onVisibility = () => {
            if (document.visibilityState === "hidden") {
                hiddenAt = Date.now();
                return;
            }
            const f = freshness.current;
            const away = hiddenAt === null ? 0 : Date.now() - hiddenAt;
            hiddenAt = null;
            if (f) void f.visible(away);
        };
        const onOnline = () => {
            const f = freshness.current;
            if (f) void f.check();
        };
        document.addEventListener("visibilitychange", onVisibility);
        window.addEventListener("online", onOnline);
        return () => {
            document.removeEventListener("visibilitychange", onVisibility);
            window.removeEventListener("online", onOnline);
        };
    }, []);

    // the connection to the node came back (the subscriptions were made again: what happened meanwhile is read)
    const wasOpen = React.useRef<boolean>(status === "open");
    React.useEffect(() => {
        const open = status === "open";
        if (open && !wasOpen.current && freshness.current) {
            void freshness.current.reconnected();
        }
        wasOpen.current = open;
    }, [status]);

    return null;
}
