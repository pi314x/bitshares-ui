// `ChainStore.requestAllDataForAccount` asks the node for an account's balances (when the account has
// more than the node sends at once) and reaches for the database API without looking whether there is
// one. That API exists only once the websocket has logged in: after a reconnect or a node switch there
// are seconds where `Apis.instance().db_api()` is undefined, and the account overview, which calls this
// in every render, took the whole page down ("undefined is not an object (evaluating 'db_api().exec')").
// The call is made when the API is there, and a failure is left for the next render, which asks again.
import {Apis} from "bitsharesjs-ws";
import {ChainStore} from "bitsharesjs";

export function requestAllBalances(accountId: string): void {
    try {
        if (!(Apis as any).instance().db_api()) return;
        (ChainStore as any).requestAllDataForAccount(accountId, "balance");
    } catch (e) {
        // not now: the next render asks again
    }
}
