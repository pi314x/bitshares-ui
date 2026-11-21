// Keeps the websocket to the node alive. The socket class of bitsharesjs-ws closes for good when the
// connection drops (the phone slept, the network changed, the node restarted) and calls a close
// callback that did nothing: the chip said "closed" and the page showed what it had, until the user
// reloaded it. Here a lost connection is noticed - by its close, and by asking when the page comes
// back to the front or the network returns (a socket the system dropped in the background does not
// always say so) - and made again, with growing pauses, first to the same node and, after a few
// failures, through the whole start-up (which tries the other nodes).
//
// The logic takes what touches the world as arguments: it is tested with a clock of its own.

export interface ConnectionKeeperDeps {
    /** Answers whether the connection works (a small request, with a time limit). */
    probe: () => Promise<boolean>;
    /** Connects again to the node in use and takes up the subscriptions. Rejects on failure. */
    reconnect: () => Promise<void>;
    /** The whole start-up (the other nodes are tried too). Rejects on failure. */
    reconnectFully: () => Promise<void>;
    /** True while the app is connecting or switching nodes by itself: not the keeper's business. */
    busy: () => boolean;
    /** Closes a connection that is dead without saying so, so that its close is seen. */
    drop: () => Promise<void> | void;
    schedule?: (fn: () => void, ms: number) => any;
    cancel?: (handle: any) => void;
    /** Pauses between attempts, in ms (the last one is used again and again). */
    pauses?: number[];
    /** After this many failed attempts at the same node the whole start-up is tried. */
    failuresBeforeFull?: number;
    log?: (...args: any[]) => void;
}

export interface ConnectionKeeper {
    /** The socket closed or failed. */
    lost(): void;
    /** The connection is open (again). */
    opened(): void;
    /** The page came to the front, or the network is back: is the connection still alive? */
    check(): Promise<void>;
    /** Nothing more is scheduled (tests, tear-down). */
    stop(): void;
    /** Attempts made since the last open connection. */
    attempts(): number;
}

const PAUSES = [1000, 2000, 4000, 8000, 15000, 30000];

export function createConnectionKeeper(
    deps: ConnectionKeeperDeps
): ConnectionKeeper {
    const schedule = deps.schedule || ((fn, ms) => setTimeout(fn, ms));
    const cancel = deps.cancel || (handle => clearTimeout(handle));
    const pauses = deps.pauses || PAUSES;
    const failuresBeforeFull = deps.failuresBeforeFull || 3;
    const log = deps.log || (() => undefined);

    let timer: any = null;
    let working = false;
    let attemptsMade = 0;
    // the keeper starts to work once a connection has been open: the first connection is the
    // start-up's, with its own error screen
    let everOpen = false;
    let stopped = false;

    const pauseFor = (attempt: number) =>
        pauses[Math.min(attempt, pauses.length - 1)];

    function plan(ms: number) {
        if (stopped) return;
        if (timer !== null) cancel(timer);
        timer = schedule(() => {
            timer = null;
            void run();
        }, ms);
    }

    async function run() {
        if (stopped || working) return;
        if (deps.busy()) {
            // the app is connecting by itself: look again later
            plan(pauseFor(0));
            return;
        }
        working = true;
        try {
            const full =
                attemptsMade > 0 && attemptsMade % failuresBeforeFull === 0;
            log("reconnecting", {attempt: attemptsMade + 1, full});
            await (full ? deps.reconnectFully() : deps.reconnect());
            attemptsMade = 0;
        } catch (e) {
            attemptsMade += 1;
            log("reconnect failed", attemptsMade, e);
            plan(pauseFor(attemptsMade));
        } finally {
            working = false;
        }
    }

    return {
        lost() {
            if (!everOpen || stopped) return;
            if (working || timer !== null) return;
            plan(pauseFor(attemptsMade));
        },
        opened() {
            everOpen = true;
            if (timer !== null) {
                cancel(timer);
                timer = null;
            }
            // (a successful run resets the count itself: a socket that opens and is lost
            // again at once keeps its growing pauses)
        },
        async check() {
            if (!everOpen || stopped || working || timer !== null) return;
            if (deps.busy()) return;
            let alive = false;
            try {
                alive = await deps.probe();
            } catch (e) {
                alive = false;
            }
            if (alive) return;
            log("the connection does not answer");
            try {
                // its close is what starts the reconnection; if there is none to see
                // (the socket is gone already), start it directly
                await deps.drop();
            } catch (e) {
                // nothing to close
            }
            if (timer === null && !working) plan(0);
        },
        stop() {
            stopped = true;
            if (timer !== null) {
                cancel(timer);
                timer = null;
            }
        },
        attempts: () => attemptsMade
    };
}
