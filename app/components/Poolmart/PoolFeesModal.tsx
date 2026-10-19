// Change the fees of a pool you own (liquidity_pool_update): what a swap pays
// (taker fee) and what a withdrawal pays. The figures are percent; the chain's rules
// and the operation are `lib/common/poolFees.ts`. The transaction goes through
// `PoolUpdateActions` -> `WalletDb.process_transaction`.
import * as React from "react";
import counterpart from "counterpart";
import {Input} from "../../design-system/Input";
import {
    DialogField,
    DialogNote,
    OperationDialog,
    useOperationSubmit
} from "../Utility/OperationDialog";
import PoolUpdateActions from "../../actions/PoolUpdateActions";
import {buildPoolUpdateOp, feeText, feeUnits} from "../../lib/common/poolFees";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`pool_fees.${key}`, params) as string;

export interface PoolFeesModalProps {
    /** the pool as the pools list holds it; the dialog is shut without one */
    pool: any | null;
    /** the id of the account that signs (the owner of the pool) */
    accountId: string;
    onCancel: () => void;
    onDone: () => void;
}

export default function PoolFeesModal({
    pool,
    accountId,
    onCancel,
    onDone
}: PoolFeesModalProps) {
    const visible = !!pool;
    const [takerText, setTakerText] = React.useState("");
    const [withdrawalText, setWithdrawalText] = React.useState("");
    const {submitting, error, run} = useOperationSubmit(
        visible,
        onDone,
        t("success")
    );

    React.useEffect(() => {
        if (!pool) return;
        setTakerText(feeText(Number(pool.taker_fee_percent)));
        setWithdrawalText(feeText(Number(pool.withdrawal_fee_percent)));
    }, [pool]);

    const taker = feeUnits(takerText);
    const withdrawal = feeUnits(withdrawalText);
    const op =
        pool && taker !== null && withdrawal !== null
            ? buildPoolUpdateOp({
                  account: accountId,
                  poolId: pool.id,
                  current: {
                      taker: Number(pool.taker_fee_percent),
                      withdrawal: Number(pool.withdrawal_fee_percent)
                  },
                  next: {taker, withdrawal}
              })
            : null;

    const submit = () => {
        if (op) run(() => PoolUpdateActions.update(op));
    };

    return (
        <OperationDialog
            visible={visible}
            title={t("title", {id: pool ? pool.id : ""})}
            submitLabel={t("submit")}
            canSubmit={!!op}
            submitting={submitting}
            error={error}
            onSubmit={submit}
            onCancel={onCancel}
        >
            <DialogNote>{t("note")}</DialogNote>
            <DialogField
                label={t("taker")}
                help={t("taker_help")}
                error={taker === null ? t("err_fee") : null}
            >
                <Input
                    value={takerText}
                    inputMode="decimal"
                    onChange={e => setTakerText(e.target.value)}
                />
            </DialogField>
            <DialogField
                label={t("withdrawal")}
                help={t("withdrawal_help")}
                error={withdrawal === null ? t("err_fee") : null}
            >
                <Input
                    value={withdrawalText}
                    inputMode="decimal"
                    onChange={e => setWithdrawalText(e.target.value)}
                />
            </DialogField>
        </OperationDialog>
    );
}
