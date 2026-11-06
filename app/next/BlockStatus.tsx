import * as React from "react";
import {ChainStore} from "bitsharesjs";
import {useChainStoreTick} from "./hooks/useChainStoreTick";
import {useReduxState} from "./hooks/useReduxState";
import {selectBlockchain} from "../store/slices/blockchainSlice";
import styles from "./BlockStatus.module.scss";

type Health = "live" | "slow" | "stalled" | "offline";

/** How a head block of that age (seconds) reads: a block every 3 seconds is
 * live; a quarter of a minute without one is slow; a minute is a stall. */
export function blockHealth(ageSeconds: number, connected: boolean): Health {
    if (!connected) return "offline";
    if (ageSeconds < 12) return "live";
    if (ageSeconds < 60) return "slow";
    return "stalled";
}

export function formatAge(seconds: number): string {
    if (!Number.isFinite(seconds) || seconds < 0) return "-";
    if (seconds < 1) return "now";
    if (seconds < 60) return `${Math.floor(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h`;
}

// The head block, as the second half of the connection chip in the status bar:
// its number (it ticks as blocks arrive) and how long ago it was made, in
// colour when blocks are late. Read-only; it re-renders itself so that a block
// every three seconds does not re-render the shell.
export default function BlockStatus(): JSX.Element | null {
    useChainStoreTick();
    const blockchain = useReduxState<any>(selectBlockchain);
    const [now, setNow] = React.useState(() => Date.now());
    React.useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    // 2.1.0: the dynamic global properties, updated with every block
    const dynamic: any = (ChainStore as any).getObject("2.1.0");
    if (!dynamic || typeof dynamic.get !== "function") return null;
    const number = Number(dynamic.get("head_block_number"));
    if (!number) return null;
    const stamp: string = dynamic.get("time") || "";
    const made = stamp
        ? Date.parse(stamp + (/Z$/.test(stamp) ? "" : "Z"))
        : NaN;
    const age = Number.isFinite(made) ? Math.max(0, (now - made) / 1000) : NaN;
    const connected = blockchain.rpc_connection_status === "open";
    const health = blockHealth(Number.isFinite(age) ? age : 0, connected);
    const irreversible = Number(dynamic.get("last_irreversible_block_num"));

    return (
        <span
            className={`${styles.block} ${styles[health]}`}
            title={
                irreversible > 0
                    ? `Head block #${number.toLocaleString(
                          "en-US"
                      )}, last irreversible #${irreversible.toLocaleString(
                          "en-US"
                      )} (${(number - irreversible).toLocaleString(
                          "en-US"
                      )} behind)`
                    : `Head block #${number.toLocaleString("en-US")}`
            }
        >
            <span key={number} className={styles.number}>
                #{number.toLocaleString("en-US")}
            </span>
            <span className={styles.age}>{formatAge(age)}</span>
        </span>
    );
}
