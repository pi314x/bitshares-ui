import {HistoryEntry, PAGE} from "../../lib/common/balanceHistory";
import {
    BalanceHistoryStore,
    HistorySource
} from "../../lib/common/balanceHistoryStore";
import {createMemoryHistoryCache} from "../../lib/common/balanceHistoryCache";

const ME = "1.2.10";

// an account whose operations are 1.11.1 .. 1.11.<count>, one per block (block = id x 10)
const entry = (n: number): HistoryEntry => ({
    id: `1.11.${n}`,
    op: [0, {from: "1.2.99", to: ME}],
    block_num: n * 10
});

/** A node with `count` operations: a page is what the chain's call returns. */
function fakeNode(count: number) {
    const calls: Array<string | null> = [];
    const blockCalls: number[][] = [];
    let total = count;
    const source: HistorySource = {
        chainKey: () => "test",
        getHistoryPage: (_id, start) => {
            calls.push(start);
            const from = start ? Number(start.split(".")[2]) : total;
            const rows: HistoryEntry[] = [];
            for (
                let n = Math.min(from, total);
                n >= 1 && rows.length < PAGE;
                n--
            ) {
                rows.push(entry(n));
            }
            return Promise.resolve({rows, source: null});
        },
        getBlockTimes: blocks => {
            blockCalls.push(blocks);
            const out: {[block: number]: number} = {};
            blocks.forEach(b => (out[b] = 1000 + b));
            return Promise.resolve(out);
        }
    };
    return {
        source,
        calls,
        blockCalls,
        /** the account does more: n new operations */
        grow: (n: number) => (total += n)
    };
}

const store = (
    node: ReturnType<typeof fakeNode>,
    cache = createMemoryHistoryCache(),
    options = {}
) =>
    new BalanceHistoryStore(node.source, cache, {
        persistDelayMs: 0,
        ...options
    });

describe("BalanceHistoryStore", () => {
    it("loads the newest operations first, then back to the first one", async () => {
        const node = fakeNode(250);
        const s = store(node);
        const seen: number[] = [];
        s.subscribe(ME, () => seen.push(s.getState(ME).entries.length));
        await s.start(ME);
        const state = s.getState(ME);
        expect(state.entries).toHaveLength(250);
        expect(state.entries[0].id).toBe("1.11.250"); // newest first
        expect(state.entries[249].id).toBe("1.11.1");
        expect(state.complete).toBe(true);
        expect(state.loading).toBe(false);
        // the first thing shown was the newest page, then it grew page by page
        expect(seen.filter(n => n > 0)[0]).toBe(PAGE);
        expect(seen).toContain(200);
        // every block was asked for once
        const asked = ([] as number[]).concat(...node.blockCalls);
        expect(new Set(asked).size).toBe(asked.length);
    });

    it("keeps what it loaded, and the next visit only asks for what is new", async () => {
        const cache = createMemoryHistoryCache();
        const first = fakeNode(250);
        await store(first, cache).start(ME);

        // a new session (a new store) over the same saved copy; 30 new operations
        const second = fakeNode(250);
        second.grow(30);
        const s = store(second, cache);
        const started = s.start(ME);
        await new Promise(resolve => setTimeout(resolve, 0));
        await started;
        const state = s.getState(ME);
        expect(state.cached).toBe(true);
        expect(state.entries).toHaveLength(280);
        expect(state.entries[0].id).toBe("1.11.280");
        expect(state.complete).toBe(true);
        // no duplicates, one run of ids
        const ids = state.entries.map(e => Number(e.id.split(".")[2]));
        expect(ids).toEqual(ids.slice().sort((a, b) => b - a));
        expect(new Set(ids).size).toBe(280);
        // the newest page only: nothing older was asked for again
        expect(second.calls).toEqual([null]);
        // and only the blocks of the new operations
        expect(([] as number[]).concat(...second.blockCalls)).toHaveLength(30);
    });

    it("closes a gap of several pages since the saved copy", async () => {
        const cache = createMemoryHistoryCache();
        await store(fakeNode(120), cache).start(ME);
        const later = fakeNode(120);
        later.grow(230);
        const s = store(later, cache);
        await s.start(ME);
        expect(s.getState(ME).entries).toHaveLength(350);
        expect(new Set(s.getState(ME).entries.map(e => e.id)).size).toBe(350);
    });

    it("says there is nothing for an account without operations", async () => {
        const s = store(fakeNode(0));
        await s.start(ME);
        expect(s.getState(ME).entries).toHaveLength(0);
        expect(s.getState(ME).complete).toBe(true);
    });

    it("stops at an error, keeps what it has, and goes on from there when started again", async () => {
        const node = fakeNode(300);
        let fail = true;
        const original = node.source.getHistoryPage;
        node.source.getHistoryPage = (id, start) =>
            start && fail
                ? Promise.reject(new Error("node busy"))
                : original(id, start);
        const s = store(node);
        await s.start(ME);
        expect(s.getState(ME).error).toBe("node busy");
        expect(s.getState(ME).entries).toHaveLength(PAGE);
        expect(s.getState(ME).complete).toBe(false);
        expect(s.getState(ME).loading).toBe(false);

        fail = false;
        await s.start(ME);
        expect(s.getState(ME).error).toBeNull();
        expect(s.getState(ME).entries).toHaveLength(300);
        expect(s.getState(ME).complete).toBe(true);
    });

    it("stops at the cap and says so", async () => {
        const s = store(fakeNode(500), createMemoryHistoryCache(), {
            maxEntries: 200
        });
        await s.start(ME);
        expect(s.getState(ME).entries.length).toBeGreaterThanOrEqual(200);
        expect(s.getState(ME).entries.length).toBeLessThan(500);
        expect(s.getState(ME).capped).toBe(true);
        expect(s.getState(ME).complete).toBe(true);
    });

    it("shares one load between everyone who asks, and does not ask again at once", async () => {
        const node = fakeNode(150);
        const s = store(node);
        const a = s.start(ME);
        const b = s.start(ME);
        expect(b).toBe(a);
        await a;
        const calls = node.calls.length;
        await s.start(ME); // finished a moment ago: nothing to ask
        expect(node.calls.length).toBe(calls);
    });

    it("keeps accounts apart, and chains apart in the saved copy", async () => {
        const cache = createMemoryHistoryCache();
        const a = fakeNode(120);
        await store(a, cache).start("1.2.10");
        const other = fakeNode(5);
        other.source.chainKey = () => "other-chain";
        const s = store(other, cache);
        await s.start("1.2.10");
        // the other chain's copy is not used: only its own 5 operations
        expect(s.getState("1.2.10").entries).toHaveLength(5);
        expect(s.getState("1.2.10").cached).toBe(false);
    });
    it("looks for what is new at once when asked to refresh, which start does not for a finished account", async () => {
        const node = fakeNode(150);
        const s = store(node);
        await s.start(ME);
        // a deposit: one more operation on the account
        node.grow(1);
        await s.start(ME); // finished a moment ago: left alone
        expect(s.getState(ME).entries).toHaveLength(150);
        await s.refresh(ME);
        const state = s.getState(ME);
        expect(state.entries).toHaveLength(151);
        expect(state.entries[0].id).toBe("1.11.151");
        expect(state.times[1510]).toBeDefined();
        expect(state.complete).toBe(true);
        expect(state.loading).toBe(false);
    });

    it("looks once more after a load that is on its way, which asked the node before the operation was there", async () => {
        const node = fakeNode(250);
        // the account gets an operation after the first page was handed out
        const original = node.source.getHistoryPage;
        let grown = false;
        node.source.getHistoryPage = (id, start) =>
            original(id, start).then(page => {
                if (!grown) {
                    grown = true;
                    node.grow(2);
                }
                return page;
            });
        const s = store(node);
        const loading = s.start(ME);
        const refreshed = s.refresh(ME);
        // everyone who asks while one is waiting shares it
        expect(s.refresh(ME)).toBe(refreshed);
        await loading;
        expect(s.getState(ME).entries).toHaveLength(250);
        await refreshed;
        const ids = s.getState(ME).entries.map(e => Number(e.id.split(".")[2]));
        expect(ids).toHaveLength(252);
        expect(ids[0]).toBe(252);
        expect(new Set(ids).size).toBe(252);
        expect(s.getState(ME).complete).toBe(true);
    });

    it("leaves the list as it is when there is nothing new, so that nothing is drawn again", async () => {
        const s = store(fakeNode(150));
        await s.start(ME);
        const before = s.getState(ME);
        await s.refresh(ME);
        expect(s.getState(ME).entries).toBe(before.entries);
        expect(s.getState(ME).times).toBe(before.times);
    });
});
