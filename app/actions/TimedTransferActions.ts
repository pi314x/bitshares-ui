import WalletApi from "api/WalletApi";
import WalletDb from "../stores/WalletDb";
import {
    TimedTransferArgs,
    buildTimedTransferOp
} from "../lib/common/timedTransfer";

class TimedTransferActionsFacade {
    /**
     * Sign and broadcast a `vesting_balance_create` for a timed transfer. It
     * goes through `WalletDb.process_transaction` like every other operation,
     * so the wallet unlock (or the extension) decides who signs; the op is
     * built and validated by `buildTimedTransferOp` first.
     */
    create(args: TimedTransferArgs): Promise<any> {
        return Promise.resolve().then(() => {
            const tr = WalletApi.new_transaction();
            tr.add_type_operation(
                "vesting_balance_create",
                buildTimedTransferOp(args)
            );
            return WalletDb.process_transaction(tr, null, true);
        });
    }
}

export default new TimedTransferActionsFacade();
