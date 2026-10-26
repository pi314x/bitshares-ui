import * as React from "react";
import {
    fetchTransactionId,
    transactionId,
    TransactionIdResult
} from "../../lib/common/transactionId";

interface Where {
    /** The transaction itself (a block page has it): its id needs no request */
    trx?: any;
    /** Where the operation is, as the account history says */
    blockNum?: number;
    trxInBlock?: number;
    opInTrx?: number;
    opType?: number;
}

/**
 * The transaction id of an operation: `undefined` while the block is read, then the
 * result (see `TransactionIdResult`).
 */
export function useTransactionId({
    trx,
    blockNum,
    trxInBlock,
    opInTrx,
    opType
}: Where): TransactionIdResult | undefined {
    const [result, setResult] = React.useState<TransactionIdResult | undefined>(
        () => {
            if (!trx) return undefined;
            const id = transactionId(trx);
            return id ? {id} : null;
        }
    );

    React.useEffect(() => {
        if (trx || blockNum === undefined || trxInBlock === undefined) return;
        let live = true;
        fetchTransactionId(blockNum, trxInBlock, opInTrx, opType).then(
            found => {
                if (live) setResult(found);
            }
        );
        return () => {
            live = false;
        };
    }, [trx, blockNum, trxInBlock, opInTrx, opType]);

    return result;
}
