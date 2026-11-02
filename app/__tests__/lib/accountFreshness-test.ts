import {
    FreshnessDeps,
    HIDDEN_RELOAD_MS,
    INTERVAL_MS,
    createFreshness
} from "../../lib/chain/accountFreshness";

function setup(over: Partial<FreshnessDeps> = {}) {
    const state = {
        chain: "2.9.10" as string | null,
        cached: "2.9.10" as string | null,
        now: 1000
    };
    const bumps: string[] = [];
    const reconcile = jest.fn(async () => {
        // the chain store has what the chain has after it
        state.cached = state.chain;
    });
    const deps: FreshnessDeps = {
        chainMostRecent: async () => state.chain,
        cachedMostRecent: () => state.cached,
        reconcile,
        bump: reason => bumps.push(reason),
        now: () => state.now,
        ...over
    };
    return {f: createFreshness(deps), state, bumps, reconcile};
}

describe("account freshness", () => {
    it("the first look is a baseline: nothing moved, nothing is read again", async () => {
        const {f, bumps, reconcile} = setup();
        await f.check();
        expect(bumps).toEqual([]);
        expect(reconcile).not.toHaveBeenCalled();
    });

    it("tells that the account's data may have changed when the chain moved and the chain store has it (the subscription works)", async () => {
        const {f, state, bumps, reconcile} = setup();
        await f.check();
        state.chain = "2.9.11";
        state.cached = "2.9.11";
        await f.check();
        expect(bumps).toEqual(["activity"]);
        expect(reconcile).not.toHaveBeenCalled();
        // the same again: nothing new
        await f.check();
        expect(bumps).toEqual(["activity"]);
    });

    it("reads the account again and tells the pages when the chain store is behind the chain (a notice was missed)", async () => {
        const {f, state, bumps, reconcile} = setup();
        await f.check();
        state.chain = "2.9.12";
        // the chain store still has 2.9.10
        await f.check();
        expect(reconcile).toHaveBeenCalledTimes(1);
        expect(bumps).toEqual(["missed"]);
        // it was brought up to date: the next look finds nothing more
        await f.check();
        expect(bumps).toEqual(["missed"]);
        expect(reconcile).toHaveBeenCalledTimes(1);
    });

    it("does nothing while the chain gives no answer, or the look fails", async () => {
        const unknown = setup({chainMostRecent: async () => null});
        await unknown.f.check();
        expect(unknown.bumps).toEqual([]);
        const failing = setup({
            chainMostRecent: async () => {
                throw new Error("no connection");
            }
        });
        await expect(failing.f.check()).resolves.toBeUndefined();
        expect(failing.bumps).toEqual([]);
    });

    it("does not look twice at once", async () => {
        let release: (value: string) => void = () => undefined;
        let calls = 0;
        const {f} = setup({
            chainMostRecent: () => {
                calls++;
                return new Promise<string>(resolve => {
                    release = resolve;
                });
            }
        });
        const first = f.check();
        await f.check();
        expect(calls).toBe(1);
        release("2.9.10");
        await first;
    });

    it("tells the pages when the page comes back after a while, but not after a moment, and not twice when the account moved", async () => {
        const {f, state, bumps} = setup();
        await f.check();
        await f.visible(HIDDEN_RELOAD_MS - 1);
        expect(bumps).toEqual([]);
        await f.visible(HIDDEN_RELOAD_MS);
        expect(bumps).toEqual(["visible"]);
        // away for long, and the account moved meanwhile: one bump, for the activity
        state.chain = "2.9.20";
        state.cached = "2.9.20";
        await f.visible(5 * HIDDEN_RELOAD_MS);
        expect(bumps).toEqual(["visible", "activity"]);
    });

    it("tells the pages when the connection is back (once, for the activity if the account moved)", async () => {
        const {f, state, bumps} = setup();
        await f.check();
        await f.reconnected();
        expect(bumps).toEqual(["reconnected"]);
        state.chain = "2.9.30";
        state.cached = "2.9.30";
        await f.reconnected();
        expect(bumps).toEqual(["reconnected", "activity"]);
    });

    it("tells the pages now and then while nothing happens, so that what changes without an operation of the account is read", async () => {
        const {f, state, bumps} = setup();
        f.tick();
        expect(bumps).toEqual([]);
        state.now += INTERVAL_MS - 1;
        f.tick();
        expect(bumps).toEqual([]);
        state.now += 1;
        f.tick();
        expect(bumps).toEqual(["interval"]);
        // counted from that bump
        f.tick();
        expect(bumps).toEqual(["interval"]);
        state.now += INTERVAL_MS;
        f.tick();
        expect(bumps).toEqual(["interval", "interval"]);
    });
});
