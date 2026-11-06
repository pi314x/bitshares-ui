// Updating an open limit order (limit_order_update). The operation comes from the
// planner in `lib/common/orderUpdate.ts`; this builds the transaction and hands it
// to `WalletDb.process_transaction`, which asks for the wallet unlock, signs
// locally and broadcasts. Failures reject, so the dialog can show the node's reason.
// Nothing here reads, logs or stores keys or passwords.
import "../lib/chain/extraOperations";
import WalletApi from "api/WalletApi";
import WalletDb from "../stores/WalletDb";
import {OrderUpdateOp} from "../lib/common/orderUpdate";

class OrderUpdateActionsFacade {
    update(op: OrderUpdateOp): Promise<any> {
        return Promise.resolve().then(() => {
            const tr = WalletApi.new_transaction();
            tr.add_type_operation("limit_order_update", op);
            return WalletDb.process_transaction(tr, null, true);
        });
    }
}

export default new OrderUpdateActionsFacade();
