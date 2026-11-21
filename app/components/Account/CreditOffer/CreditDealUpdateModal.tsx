// Choose whether the chain repays a credit deal by itself when it falls due
// (credit_deal_update). The three modes are the chain's; the transaction goes
// through `CreditDealActions` -> `WalletDb.process_transaction`.
import * as React from "react";
import counterpart from "counterpart";
import {Select} from "../../../design-system/Select";
import {
    DialogField,
    DialogNote,
    OperationDialog,
    useOperationSubmit
} from "../../Utility/OperationDialog";
import CreditDealActions from "../../../actions/CreditDealActions";
import {AUTO_REPAY_MODES, autoRepayOf} from "../../../lib/common/creditDeal";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`credit_offer.auto_repay.${key}`, params) as string;

export interface CreditDealUpdateModalProps {
    account: string;
    /** the deal as the node reports it; the dialog is shut without one */
    deal: any | null;
    onCancel: () => void;
    onDone: () => void;
}

export default function CreditDealUpdateModal({
    account,
    deal,
    onCancel,
    onDone
}: CreditDealUpdateModalProps) {
    const visible = !!deal;
    const current = autoRepayOf(deal);
    const [mode, setMode] = React.useState<number>(current);
    const {submitting, error, run} = useOperationSubmit(
        visible,
        onDone,
        t("success")
    );

    React.useEffect(() => {
        setMode(autoRepayOf(deal));
    }, [deal]);

    const submit = () => {
        if (!deal || mode === current) return;
        run(() =>
            CreditDealActions.setAutoRepay({
                account,
                dealId: deal.id,
                autoRepay: mode
            })
        );
    };

    return (
        <OperationDialog
            visible={visible}
            title={t("title", {id: deal ? deal.id : ""})}
            submitLabel={t("submit")}
            canSubmit={mode !== current}
            submitting={submitting}
            error={error}
            onSubmit={submit}
            onCancel={onCancel}
        >
            <DialogNote>{t("note")}</DialogNote>
            <DialogField label={t("label")} help={t(`help_${mode}`)}>
                <Select value={String(mode)} onChange={v => setMode(Number(v))}>
                    {AUTO_REPAY_MODES.map(m => (
                        <Select.Option key={m} value={String(m)}>
                            {t(`mode_${m}`)}
                        </Select.Option>
                    ))}
                </Select>
            </DialogField>
        </OperationDialog>
    );
}
