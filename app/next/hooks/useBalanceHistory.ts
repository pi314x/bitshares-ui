import * as React from "react";
import {balanceHistory} from "../../lib/chain/balanceHistoryLoader";
import {HistoryState} from "../../lib/common/balanceHistoryStore";

/**
 * An account's history as it loads (the newest operations first, then the older ones
 * page by page, kept on this device). Starting is idempotent: every chart of the same
 * account shares one load, which goes on when the screen is left.
 */
export function useBalanceHistory(
    accountId: string,
    /** false until there is something to draw: an account with no balances asks for nothing */
    enabled = true
): HistoryState {
    const subscribe = React.useCallback(
        (listener: () => void) => balanceHistory.subscribe(accountId, listener),
        [accountId]
    );
    const snapshot = React.useCallback(
        () => balanceHistory.getState(accountId),
        [accountId]
    );
    React.useEffect(() => {
        if (enabled) balanceHistory.start(accountId);
    }, [accountId, enabled]);
    return React.useSyncExternalStore(subscribe, snapshot);
}
