// Keeps what the app shows of the connected account in step with the chain, without a reload.
//
// The chain store is told of changes of the account by the node (a subscription), and the pages that read by
// themselves are told nothing: this looks, every few blocks, at one small object - the account's statistics,
// whose `most_recent_op` moves with every operation that touches the account - and
//   - when it is not what the chain store has, a notice was missed (a subscription that was lost, a node that
//     dropped it): the account's full data is read again and given to the chain store as a notice would be
//     (`reconcile`), and
//   - when it moved since the last look, the account's epoch goes up (`bump`): the pages that read by
//     themselves read again.
// It also goes up when the page comes back to the front after a while, when the connection is back, and now
// and then while the page is in view.
//
// The logic takes what touches the world as arguments, and is tested with a clock of its own.
import {EpochReason} from "../common/accountEpoch";

export interface FreshnessDeps {
    /** The account's `most_recent_op` as the chain says it now (null: not known, e.g. no answer). */
    chainMostRecent: () => Promise<string | null>;
    /** The same as the chain store has it (null: the store has no statistics of the account yet). */
    cachedMostRecent: () => string | null;
    /** Reads the account's full data again and gives it to the chain store. */
    reconcile: () => Promise<void>;
    bump: (reason: EpochReason) => void;
    now: () => number;
}

export interface Freshness {
    /** A look now (a new block, the page in view again). */
    check: () => Promise<void>;
    /** The page came back to the front after being hidden for `hiddenMs`. */
    visible: (hiddenMs: number) => Promise<void>;
    /** The connection is back. */
    reconnected: () => Promise<void>;
    /** Time passes while the page is in view: now and then everything is read again. */
    tick: () => void;
}

/** The pages read again after this long even when nothing happened to the account (ms). */
export const INTERVAL_MS = 60 * 1000;
/** A page that was hidden this long is read again when it comes back (ms). */
export const HIDDEN_RELOAD_MS = 30 * 1000;

export function createFreshness(deps: FreshnessDeps): Freshness {
    let lastSeen: string | null = null;
    let lastBump = deps.now();
    let busy = false;

    const bump = (reason: EpochReason) => {
        lastBump = deps.now();
        deps.bump(reason);
    };

    async function look(): Promise<"moved" | "same"> {
        const chain = await deps.chainMostRecent();
        if (chain === null) return "same";
        const cached = deps.cachedMostRecent();
        // the chain store has not got what the chain has: a notice was missed
        if (cached !== null && cached !== chain) {
            await deps.reconcile();
            bump("missed");
            lastSeen = chain;
            return "moved";
        }
        const moved = lastSeen !== null && lastSeen !== chain;
        lastSeen = chain;
        if (moved) bump("activity");
        return moved ? "moved" : "same";
    }

    async function guarded(): Promise<"moved" | "same"> {
        // one look at a time (a block comes every 3 s, an answer can take longer)
        if (busy) return "same";
        busy = true;
        try {
            return await look();
        } catch (e) {
            return "same";
        } finally {
            busy = false;
        }
    }

    return {
        async check() {
            await guarded();
        },
        async visible(hiddenMs) {
            const result = await guarded();
            if (hiddenMs >= HIDDEN_RELOAD_MS && result !== "moved") {
                bump("visible");
            }
        },
        async reconnected() {
            const result = await guarded();
            if (result !== "moved") bump("reconnected");
        },
        tick() {
            if (deps.now() - lastBump >= INTERVAL_MS) bump("interval");
        }
    };
}
