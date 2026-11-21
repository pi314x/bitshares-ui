// Wires the connection keeper (connectionKeeper.ts) to the real connection: the status the app
// keeps (`rpc_connection_status`), the page coming to the front, the network coming back.
import {Apis} from "bitsharesjs-ws";
import {ChainStore} from "bitsharesjs";
import {reduxStore} from "../../store/reduxStore";
import {selectBlockchain} from "../../store/slices/blockchainSlice";
import SettingsStore from "../../stores/SettingsStore";
import willTransitionTo, {routerTransitioner} from "../../routerTransition";
import {createConnectionKeeper} from "./connectionKeeper";

const PROBE_TIMEOUT_MS = 4000;

/** A small request: true when the node answers in time. */
function probe(): Promise<boolean> {
    return new Promise(resolve => {
        const timer = setTimeout(() => resolve(false), PROBE_TIMEOUT_MS);
        try {
            (Apis as any)
                .instance()
                .db_api()
                .exec("get_objects", [["2.1.0"]])
                .then(
                    () => {
                        clearTimeout(timer);
                        resolve(true);
                    },
                    () => {
                        clearTimeout(timer);
                        resolve(false);
                    }
                );
        } catch (e) {
            clearTimeout(timer);
            resolve(false);
        }
    });
}

async function reconnect() {
    const url = (SettingsStore as any).getSetting("activeNode");
    if (!url) throw new Error("no node to go back to");
    await (Apis as any).close();
    const instance = await (Apis as any).reset(url, true, undefined, {
        enableOrders: true
    });
    await instance.init_promise;
    // the new socket has no subscriptions: ChainStore takes them up again, as it does for a
    // "reconnect" of the library's own kind
    await (ChainStore as any).resetCache(false);
}

async function reconnectFully() {
    (routerTransitioner as any)._oldChain = "old";
    await willTransitionTo(true);
}

let installed = false;

export function installConnectionKeeper() {
    if (installed || typeof window === "undefined") return;
    installed = true;

    const keeper = createConnectionKeeper({
        probe,
        reconnect,
        reconnectFully,
        busy: () => !!(routerTransitioner as any).isTransitionInProgress(),
        drop: () => (Apis as any).close(),
        log: (...args) => console.log("[connection]", ...args)
    });

    let last: string | null = null;
    reduxStore.subscribe(() => {
        const status = selectBlockchain(reduxStore.getState())
            .rpc_connection_status;
        if (status === last) return;
        last = status;
        if (status === "open") keeper.opened();
        else if (status === "closed" || status === "error") keeper.lost();
    });

    const check = () => {
        void keeper.check();
    };
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
    });
    window.addEventListener("online", check);
    // a page restored from the back/forward cache
    window.addEventListener("pageshow", event => {
        if ((event as PageTransitionEvent).persisted) check();
    });
}
