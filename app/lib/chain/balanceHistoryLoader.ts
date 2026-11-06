// The one store of account histories of the app, wired to the node and to this device's
// storage (the logic is lib/common/balanceHistoryStore.ts).
import BalanceHistoryActions from "../../actions/BalanceHistoryActions";
import {createIdbHistoryCache} from "../common/balanceHistoryCache";
import {BalanceHistoryStore} from "../common/balanceHistoryStore";

export const balanceHistory = new BalanceHistoryStore(
    {
        chainKey: () => BalanceHistoryActions.chainKey(),
        getHistoryPage: (accountId, start) =>
            BalanceHistoryActions.getHistoryPage(accountId, start),
        getBlockTimes: blocks => BalanceHistoryActions.getBlockTimes(blocks)
    },
    createIdbHistoryCache()
);
