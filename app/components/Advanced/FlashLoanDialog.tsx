// A flash loan from a SameT fund: samet_fund_borrow (67) and samet_fund_repay (68) in one
// transaction. What is borrowed has to be repaid, with the fund's fee, by the end of the
// transaction, or the whole transaction fails and nothing happens (only the node's check
// before it is sent costs nothing). What is done with the money in between is the
// operations added here as JSON (swaps through pools, orders, transfers).
import * as React from "react";
import {Link} from "react-router-dom";
import {Input} from "../../design-system/Input";
import {
    DialogField,
    DialogNote,
    OperationDialog,
    useOperationSubmit
} from "../Utility/OperationDialog";
import AdvancedActions from "../../actions/AdvancedActions";
import {buildFlashLoan, lendable} from "../../lib/common/advancedOps";
import {formatAmount, formatFeeRate} from "../../lib/common/sametFunds";
import {Step, parseSteps} from "../../lib/common/opJson";
import OperationSteps from "./OperationSteps";
import {errorText, idOf, t, useCurrentAccount, useLookup} from "./fields";
import styles from "./Advanced.module.scss";

const fundId = (text: string) =>
    /^\d+$/.test(text.trim()) ? `1.20.${text.trim()}` : text.trim();

export default function FlashLoanDialog(props: {
    onCancel: () => void;
    onDone: () => void;
}) {
    const me = useCurrentAccount();
    const [fundText, setFundText] = React.useState("");
    const fund = useLookup(fundId(fundText), id =>
        /^1\.20\.\d+$/.test(id)
            ? AdvancedActions.getFund(id)
            : Promise.resolve(null)
    );
    const fundValue = fund.state === "ok" ? fund.value : null;
    const asset = useLookup(fundValue ? fundValue.asset_type : "", id =>
        AdvancedActions.getAssetById(id)
    );
    const assetValue = asset.state === "ok" ? asset.value : null;
    const [amount, setAmount] = React.useState("");
    const [steps, setSteps] = React.useState<Step[]>([]);
    const {submitting, error, run} = useOperationSubmit(
        true,
        props.onDone,
        t("flash.success")
    );

    const built = buildFlashLoan({
        borrowerId: idOf(me.account),
        fund: fundValue,
        precision: assetValue ? assetValue.precision : 0,
        amount
    });
    const parsedSteps = parseSteps(steps);
    const symbol = assetValue ? assetValue.symbol : "";
    const precision = assetValue ? assetValue.precision : 0;

    return (
        <OperationDialog
            visible={true}
            title={t("flash.title")}
            submitLabel={t("flash.submit")}
            canSubmit={built.ok && parsedSteps.ok && !!assetValue}
            submitting={submitting}
            error={error}
            width={640}
            onSubmit={() =>
                built.ok &&
                parsedSteps.ok &&
                run(() =>
                    AdvancedActions.send([
                        ["samet_fund_borrow", built.op.borrow],
                        ...parsedSteps.op,
                        ["samet_fund_repay", built.op.repay]
                    ])
                )
            }
            onCancel={props.onCancel}
        >
            <DialogNote>
                {t("flash.explain", {name: me.name || "-"})}
            </DialogNote>
            <DialogField
                label={t("flash.fund")}
                help={
                    <>
                        {t("flash.fund_help")}{" "}
                        <Link to="/samet-funds">{t("flash.funds_page")}</Link>
                    </>
                }
                error={
                    fund.state === "missing"
                        ? t("flash.fund_missing")
                        : fund.state === "error"
                        ? t("lookup_failed")
                        : null
                }
            >
                <Input
                    value={fundText}
                    inputMode="numeric"
                    placeholder="1.20.0"
                    aria-label={t("flash.fund")}
                    onChange={e => setFundText(e.target.value)}
                />
            </DialogField>
            {fundValue && assetValue ? (
                <dl className={styles.facts}>
                    <dt>{t("flash.asset")}</dt>
                    <dd>{symbol}</dd>
                    <dt>{t("flash.balance")}</dt>
                    <dd>{formatAmount(fundValue.balance, precision)}</dd>
                    <dt>{t("flash.unpaid")}</dt>
                    <dd>{formatAmount(fundValue.unpaid_amount, precision)}</dd>
                    <dt>{t("flash.lendable")}</dt>
                    <dd>{formatAmount(lendable(fundValue), precision)}</dd>
                    <dt>{t("flash.rate")}</dt>
                    <dd>{formatFeeRate(fundValue.fee_rate)}</dd>
                </dl>
            ) : null}
            <DialogField
                label={
                    symbol
                        ? t("flash.amount", {symbol})
                        : t("flash.amount_plain")
                }
                help={
                    built.ok
                        ? t("flash.fee_help", {
                              fee: formatAmount(built.op.fee, precision),
                              symbol
                          })
                        : undefined
                }
                error={
                    amount.trim() && !built.ok && built.error !== "fund_invalid"
                        ? errorText(built)
                        : null
                }
            >
                <Input
                    value={amount}
                    inputMode="decimal"
                    aria-label={
                        symbol
                            ? t("flash.amount", {symbol})
                            : t("flash.amount_plain")
                    }
                    onChange={e => setAmount(e.target.value)}
                />
            </DialogField>
            <OperationSteps
                label={t("flash.steps")}
                help={t("flash.steps_help")}
                steps={steps}
                onChange={setSteps}
            />
            {!parsedSteps.ok ? (
                <DialogNote>{errorText(parsedSteps)}</DialogNote>
            ) : null}
            <DialogNote>{t("flash.risk")}</DialogNote>
        </OperationDialog>
    );
}
