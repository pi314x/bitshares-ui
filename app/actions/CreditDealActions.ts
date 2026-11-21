// Updating a credit deal (credit_deal_update): the automatic repayment. Builds the
// transaction from `lib/common/creditDeal.ts` and hands it to
// `WalletDb.process_transaction` (wallet unlock, local signing, broadcast). Failures
// reject so the dialog can show the node's reason. No keys or passwords are read here.
import "../lib/chain/extraOperations";
import WalletApi from "api/WalletApi";
import WalletDb from "../stores/WalletDb";
import {buildCreditDealUpdateOp} from "../lib/common/creditDeal";

class CreditDealActionsFacade {
    setAutoRepay(args: {
        account: string;
        dealId: string;
        autoRepay: number;
    }): Promise<any> {
        return Promise.resolve().then(() => {
            const op = buildCreditDealUpdateOp(args);
            if (!op) throw new Error("Unknown repayment mode");
            const tr = WalletApi.new_transaction();
            tr.add_type_operation("credit_deal_update", op);
            return WalletDb.process_transaction(tr, null, true);
        });
    }
}

export default new CreditDealActionsFacade();
