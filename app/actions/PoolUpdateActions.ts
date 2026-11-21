// Changing the fees of a liquidity pool (liquidity_pool_update): builds the
// transaction from `lib/common/poolFees.ts` and hands it to
// `WalletDb.process_transaction` (wallet unlock, local signing, broadcast).
// Failures reject so the dialog can show the node's reason.
import "../lib/chain/extraOperations";
import WalletApi from "api/WalletApi";
import WalletDb from "../stores/WalletDb";
import {PoolUpdateOp} from "../lib/common/poolFees";

class PoolUpdateActionsFacade {
    update(op: PoolUpdateOp): Promise<any> {
        return Promise.resolve().then(() => {
            const tr = WalletApi.new_transaction();
            tr.add_type_operation("liquidity_pool_update", op);
            return WalletDb.process_transaction(tr, null, true);
        });
    }
}

export default new PoolUpdateActionsFacade();
