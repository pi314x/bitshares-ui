// What an account has paid in network fees, as the chain tells it: the account's own statistics hold the
// total since it was created (exact, whatever the node keeps of the history), and the operations the node
// still keeps - usually the last hundred - give the recent pace. Read-only: nothing here signs.
import {Apis} from "bitsharesjs-ws";
import {CORE, FeeRate, HistoryEntry, OwnFees, ownFees} from "../common/ownFees";

const db = () => (Apis as any).instance().db_api();
const history = () => (Apis as any).instance().history_api();

const PAGE = 100;
/** at most this many pages of history are asked for (a node that keeps more than 100 operations) */
const MAX_PAGES = 5;

export interface RecentFees {
    fees: OwnFees;
    /** the operations the node still keeps for the account */
    entries: number;
    /** when the oldest and the newest of them were made; null when the blocks could not be read */
    from: Date | null;
    to: Date | null;
    /** the days between them (0 when they are not known) */
    days: number;
}

export interface OwnFeesInfo {
    accountId: string;
    /** the fees the account has paid since it was created, in core units: those the chain has counted and those pending */
    lifetimeFees: bigint;
    /** the operations the account has been part of since it was created */
    totalOps: number;
    /** null when the history could not be read */
    recent: RecentFees | null;
}

const chainTime = (stamp: string): Date | null => {
    const ms = Date.parse(stamp + (/Z$/.test(stamp) ? "" : "Z"));
    return Number.isFinite(ms) ? new Date(ms) : null;
};

/** The history the node keeps for the account, newest first, a page at a time. */
async function loadHistory(accountId: string): Promise<HistoryEntry[]> {
    const seen = new Set<string>();
    const out: HistoryEntry[] = [];
    let start = "1.11.0";
    for (let page = 0; page < MAX_PAGES; page++) {
        const rows: any[] =
            ((await history().exec("get_account_history", [
                accountId,
                "1.11.0",
                PAGE,
                start
            ])) as any[]) || [];
        let added = 0;
        rows.forEach(row => {
            if (!row || !row.id || seen.has(row.id)) return;
            seen.add(row.id);
            out.push(row as HistoryEntry);
            added++;
        });
        // the start is part of the answer: a page that brings nothing new is the end
        if (rows.length < PAGE || added === 0) break;
        start = rows[rows.length - 1].id;
    }
    return out;
}

/** The core exchange rates of the assets the fees were paid in. */
async function loadRates(assetIds: string[]): Promise<Map<string, FeeRate>> {
    const rates = new Map<string, FeeRate>();
    for (let i = 0; i < assetIds.length; i += PAGE) {
        const rows: any[] =
            ((await db().exec("get_assets", [
                assetIds.slice(i, i + PAGE)
            ])) as any[]) || [];
        rows.forEach(row => {
            const rate = row && row.options && row.options.core_exchange_rate;
            if (!rate || !rate.base || !rate.quote) return;
            rates.set(String(row.id), {
                baseAssetId: String(rate.base.asset_id),
                baseAmount: BigInt(String(rate.base.amount)),
                quoteAssetId: String(rate.quote.asset_id),
                quoteAmount: BigInt(String(rate.quote.amount))
            });
        });
    }
    return rates;
}

async function blockTime(block: number): Promise<Date | null> {
    try {
        const header: any = await db().exec("get_block_header", [block]);
        return header && header.timestamp ? chainTime(header.timestamp) : null;
    } catch (e) {
        return null;
    }
}

export async function loadOwnFees(accountName: string): Promise<OwnFeesInfo> {
    const account: any = await db().exec("get_account_by_name", [accountName]);
    if (!account || !account.id || !account.statistics) {
        throw new Error(`no account ${accountName}`);
    }
    const rows: any[] = (await db().exec("get_objects", [
        [account.statistics]
    ])) as any[];
    const stats = rows && rows[0];
    if (!stats) throw new Error("the account's statistics could not be read");
    const lifetimeFees =
        BigInt(String(stats.lifetime_fees_paid || 0)) +
        BigInt(String(stats.pending_fees || 0)) +
        BigInt(String(stats.pending_vested_fees || 0));

    let recent: RecentFees | null = null;
    try {
        const entries = await loadHistory(account.id);
        // the assets the fees of this account's own operations were paid in, besides the core asset
        const feeAssets = new Set<string>();
        entries.forEach(entry => {
            const op = entry.op && entry.op[1];
            if (op && op.fee && Number(op.fee.amount) > 0) {
                if (op.fee.asset_id !== CORE) feeAssets.add(op.fee.asset_id);
            }
        });
        const rates = await loadRates(Array.from(feeAssets));
        const fees = ownFees(account.id, entries, rates);
        const [from, to] =
            fees.firstBlock !== null && fees.lastBlock !== null
                ? await Promise.all([
                      blockTime(fees.firstBlock),
                      blockTime(fees.lastBlock)
                  ])
                : [null, null];
        recent = {
            fees,
            entries: entries.length,
            from,
            to,
            days:
                from && to
                    ? Math.max(0, (to.getTime() - from.getTime()) / 86400000)
                    : 0
        };
    } catch (e) {
        // the exact total is still there
        recent = null;
    }
    return {
        accountId: String(account.id),
        lifetimeFees,
        totalOps: Number(stats.total_ops || 0),
        recent
    };
}
