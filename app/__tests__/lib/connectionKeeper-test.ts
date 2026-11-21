// The socket class of bitsharesjs-ws closes for good when the connection drops, and the app's close
// callback did nothing: after the phone slept or the network changed the chip said "closed" until the
// page was reloaded. The keeper makes the connection again.
import {
    createConnectionKeeper,
    ConnectionKeeperDeps
} from "../../lib/chain/connectionKeeper";

// a clock of its own: timers wait until the test lets time pass
function clock() {
    let now = 0;
    let next = 1;
    const timers = new Map<number, {at: number; fn: () => void}>();
    return {
        schedule: (fn: () => void, ms: number) => {
            const id = next++;
            timers.set(id, {at: now + ms, fn});
            return id;
        },
        cancel: (id: number) => {
            timers.delete(id);
        },
        /** lets `ms` pass and runs what falls due, in order */
        async advance(ms: number) {
            const until = now + ms;
            for (;;) {
                const due = [...timers.entries()]
                    .filter(([, t]) => t.at <= until)
                    .sort((a, b) => a[1].at - b[1].at)[0];
                if (!due) break;
                timers.delete(due[0]);
                now = due[1].at;
                due[1].fn();
                // let the async work the timer started finish
                for (let i = 0; i < 10; i++) await Promise.resolve();
            }
            now = until;
        },
        pending: () => timers.size
    };
}

function setup(overrides: Partial<ConnectionKeeperDeps> = {}) {
    const time = clock();
    const calls: string[] = [];
    const deps: ConnectionKeeperDeps = {
        probe: async () => true,
        reconnect: async () => {
            calls.push("reconnect");
        },
        reconnectFully: async () => {
            calls.push("full");
        },
        busy: () => false,
        drop: async () => {
            calls.push("drop");
        },
        schedule: time.schedule,
        cancel: time.cancel,
        pauses: [1000, 2000, 4000],
        ...overrides
    };
    return {keeper: createConnectionKeeper(deps), time, calls};
}

describe("connection keeper", () => {
    it("does not touch the start-up's own connection: nothing before a connection has been open", async () => {
        const {keeper, time, calls} = setup();
        keeper.lost();
        await time.advance(60000);
        expect(calls).toEqual([]);
    });

    it("connects again after the connection is lost, after the first pause", async () => {
        const {keeper, time, calls} = setup();
        keeper.opened();
        keeper.lost();
        await time.advance(999);
        expect(calls).toEqual([]);
        await time.advance(1);
        expect(calls).toEqual(["reconnect"]);
        expect(keeper.attempts()).toBe(0);
    });

    it("pauses longer after each failure, then tries the whole start-up", async () => {
        const reconnect = jest.fn().mockRejectedValue(new Error("no"));
        const reconnectFully = jest.fn().mockRejectedValue(new Error("no"));
        const {keeper, time} = setup({reconnect, reconnectFully});
        keeper.opened();
        keeper.lost();
        await time.advance(1000); // attempt 1
        expect(reconnect).toHaveBeenCalledTimes(1);
        await time.advance(1999);
        expect(reconnect).toHaveBeenCalledTimes(1);
        await time.advance(1); // attempt 2 after 2s
        expect(reconnect).toHaveBeenCalledTimes(2);
        await time.advance(4000); // attempt 3 after 4s
        expect(reconnect).toHaveBeenCalledTimes(3);
        await time.advance(4000); // after three failures: the whole start-up
        expect(reconnectFully).toHaveBeenCalledTimes(1);
        expect(keeper.attempts()).toBe(4);
    });

    it("stops asking once the connection is open again", async () => {
        const reconnect = jest.fn().mockRejectedValueOnce(new Error("no"));
        const {keeper, time} = setup({reconnect});
        keeper.opened();
        keeper.lost();
        await time.advance(1000);
        expect(reconnect).toHaveBeenCalledTimes(1);
        keeper.opened(); // the socket came up by itself
        await time.advance(60000);
        expect(reconnect).toHaveBeenCalledTimes(1);
        expect(time.pending()).toBe(0);
    });

    it("leaves a connection alone that the app is making by itself", async () => {
        let busy = true;
        const {keeper, time, calls} = setup({busy: () => busy});
        keeper.opened();
        keeper.lost();
        await time.advance(5000);
        expect(calls).toEqual([]);
        busy = false;
        await time.advance(1000);
        expect(calls).toEqual(["reconnect"]);
    });

    it("lets one attempt run at a time, however often the loss is reported", async () => {
        const {keeper, time, calls} = setup();
        keeper.opened();
        keeper.lost();
        keeper.lost();
        keeper.lost();
        await time.advance(1000);
        expect(calls).toEqual(["reconnect"]);
    });

    describe("when the page comes back to the front", () => {
        it("does nothing while the connection answers", async () => {
            const {keeper, time, calls} = setup();
            keeper.opened();
            await keeper.check();
            await time.advance(10000);
            expect(calls).toEqual([]);
        });

        it("drops a socket that does not answer and connects again at once", async () => {
            const {keeper, time, calls} = setup({probe: async () => false});
            keeper.opened();
            await keeper.check();
            expect(calls).toEqual(["drop"]);
            await time.advance(0);
            expect(calls).toEqual(["drop", "reconnect"]);
        });

        it("does not ask before a connection has been open", async () => {
            const probe = jest.fn().mockResolvedValue(false);
            const {keeper} = setup({probe});
            await keeper.check();
            expect(probe).not.toHaveBeenCalled();
        });

        it("counts a failing probe as no answer", async () => {
            const {keeper, calls} = setup({
                probe: async () => {
                    throw new Error("boom");
                }
            });
            keeper.opened();
            await keeper.check();
            expect(calls).toContain("drop");
        });
    });

    it("schedules nothing after stop", async () => {
        const {keeper, time, calls} = setup();
        keeper.opened();
        keeper.stop();
        keeper.lost();
        await time.advance(60000);
        expect(calls).toEqual([]);
    });
});
