// What identifies an operation on the chain, with a copy button on each id: its
// own id (`1.11.…`), the block, and the id of the transaction it is in (the hash
// an explorer searches by). Shown above the operation's JSON, and on the block
// page above a transaction's operations.
import * as React from "react";
import counterpart from "counterpart";
import CopyIconButton from "../Utility/CopyIconButton";
import {
    fetchTransactionId,
    transactionId,
    TransactionIdResult
} from "../../lib/common/transactionId";
import styles from "./OperationFacts.module.scss";

interface OperationFactsProps {
    /** The history entry's id, `1.11.…` */
    operationId?: string;
    blockNum?: number;
    /** Where the operation is, as the account history says */
    trxInBlock?: number;
    opInTrx?: number;
    opType?: number;
    /** The transaction itself (the block page has it): its id needs no request */
    trx?: any;
}

const t = (key: string) => counterpart.translate(key) as string;

export default function OperationFacts({
    operationId,
    blockNum,
    trxInBlock,
    opInTrx,
    opType,
    trx
}: OperationFactsProps) {
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

    const wantsTrx =
        !!trx || (blockNum !== undefined && trxInBlock !== undefined);

    return (
        <dl className={styles.facts}>
            {operationId ? (
                <div className={styles.fact}>
                    <dt>{t("transaction.operation_id")}</dt>
                    <dd>
                        <code>{operationId}</code>
                        <CopyIconButton text={operationId} />
                    </dd>
                </div>
            ) : null}
            {blockNum !== undefined ? (
                <div className={styles.fact}>
                    <dt>{t("explorer.block.title")}</dt>
                    <dd>
                        <code>{blockNum}</code>
                    </dd>
                </div>
            ) : null}
            {wantsTrx ? (
                <div className={styles.fact}>
                    <dt>{t("transaction.trx_id")}</dt>
                    <dd>
                        {result === undefined ? (
                            <span className={styles.note}>…</span>
                        ) : result === null ? (
                            <span className={styles.note}>
                                {t("transaction.trx_id_unavailable")}
                            </span>
                        ) : "id" in result ? (
                            <React.Fragment>
                                <code>{result.id}</code>
                                <CopyIconButton text={result.id} />
                            </React.Fragment>
                        ) : (
                            <span className={styles.note}>
                                {t("transaction.trx_id_none")}
                            </span>
                        )}
                    </dd>
                </div>
            ) : null}
        </dl>
    );
}
