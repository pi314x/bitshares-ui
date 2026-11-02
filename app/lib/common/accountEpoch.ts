// "The account's data may have changed": a counter that pages which read the account's data by themselves (the
// lists of funds, credit deals, vesting balances, pools - read from the node once, when the page opens) follow to
// read it again, so that nothing needs a reload (F5) to show the latest. It goes up when the account has a new
// operation (a transfer in, an order filled, a settlement), when the page comes back to the front or the
// connection is back, and now and then while it is in view (what changes without an operation of the account).
// `components/AccountFreshness.tsx` is what makes it go up; a page only asks for it: `useRefreshOnEpoch(reload)`.
import * as React from "react";

export type EpochReason =
    | "activity"
    | "missed"
    | "visible"
    | "reconnected"
    | "interval";

let epoch = 0;
let lastReason: EpochReason | null = null;
const listeners = new Set<() => void>();

export function bumpAccountEpoch(reason: EpochReason): void {
    epoch++;
    lastReason = reason;
    listeners.forEach(listener => listener());
}

export const getAccountEpoch = (): number => epoch;
export const getAccountEpochReason = (): EpochReason | null => lastReason;

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** The counter (a page that wants to read again when it changes). */
export function useAccountEpoch(): number {
    return React.useSyncExternalStore(subscribe, getAccountEpoch);
}

/**
 * Calls `reload` when the account's data may have changed (not when the page opens: the page reads its data
 * then), a moment after the change so that several in a row are one read. `reload` should replace what is shown
 * in place (no empty list in between), and may be a function that changes every render.
 */
export function useRefreshOnEpoch(
    reload: () => void,
    enabled = true,
    delayMs = 300
): void {
    const current = useAccountEpoch();
    const seen = React.useRef(current);
    const latest = React.useRef(reload);
    latest.current = reload;
    React.useEffect(() => {
        if (current === seen.current) return;
        seen.current = current;
        if (!enabled) return;
        const timer = setTimeout(() => latest.current(), delayMs);
        return () => clearTimeout(timer);
    }, [current, enabled, delayMs]);
}
