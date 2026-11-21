// override_transfer (operation 38): the issuer of an asset that allows it moves an
// amount from one account to another without that account's say. The dialog checks what
// the chain checks: the asset is the account's, and its issuer permission "override
// authority" is set.
import * as React from "react";
import {Input} from "../../design-system/Input";
import {
    DialogField,
    DialogNote,
    OperationDialog,
    useOperationSubmit
} from "../Utility/OperationDialog";
import AdvancedActions from "../../actions/AdvancedActions";
import {
    buildOverrideTransfer,
    overrideProblem
} from "../../lib/common/advancedOps";
import {
    AccountNameField,
    AssetSymbolField,
    errorText,
    idOf,
    t,
    useAccountField,
    useAssetField,
    useCurrentAccount
} from "./fields";

export default function OverrideTransferDialog(props: {
    onCancel: () => void;
    onDone: () => void;
}) {
    const me = useCurrentAccount();
    const issuerId = idOf(me.account);
    const asset = useAssetField();
    const from = useAccountField();
    const to = useAccountField();
    const [amount, setAmount] = React.useState("");
    const {submitting, error, run} = useOperationSubmit(
        true,
        props.onDone,
        t("override.success")
    );

    const problem = asset.asset
        ? overrideProblem(
              {
                  issuer: asset.asset.issuer,
                  options: {flags: asset.asset.flags}
              },
              issuerId
          )
        : null;
    const built = buildOverrideTransfer({
        issuerId,
        fromId: from.id,
        toId: to.id,
        assetId: asset.asset ? asset.asset.id : null,
        precision: asset.asset ? asset.asset.precision : 0,
        amount
    });
    const amountError =
        amount.trim() && !built.ok && built.error === "amount_invalid"
            ? errorText(built)
            : null;
    const accountError =
        from.id && to.id && !built.ok
            ? built.error === "from_is_to" || built.error === "issuer_is_from"
                ? errorText(built)
                : null
            : null;

    return (
        <OperationDialog
            visible={true}
            title={t("override.title")}
            submitLabel={t("override.submit")}
            canSubmit={built.ok && !problem}
            submitting={submitting}
            error={error}
            onSubmit={() =>
                built.ok &&
                run(() =>
                    AdvancedActions.send([["override_transfer", built.op]])
                )
            }
            onCancel={props.onCancel}
        >
            <DialogNote>
                {t("override.issuer", {name: me.name || "-"})}
            </DialogNote>
            <AssetSymbolField
                label={t("override.asset")}
                help={t("override.asset_help")}
                value={asset.text}
                onChange={asset.setText}
                lookup={asset.lookup}
            />
            {problem ? (
                <DialogNote>{t(`override.problem_${problem}`)}</DialogNote>
            ) : null}
            <AccountNameField
                label={t("override.from")}
                value={from.text}
                onChange={from.setText}
                lookup={from.lookup}
            />
            <AccountNameField
                label={t("override.to")}
                value={to.text}
                onChange={to.setText}
                lookup={to.lookup}
            />
            {accountError ? <DialogNote>{accountError}</DialogNote> : null}
            <DialogField
                label={t("override.amount")}
                help={
                    asset.asset
                        ? t("override.amount_help", {
                              symbol: asset.asset.symbol
                          })
                        : undefined
                }
                error={amountError}
            >
                <Input
                    value={amount}
                    inputMode="decimal"
                    aria-label={t("override.amount")}
                    onChange={e => setAmount(e.target.value)}
                />
            </DialogField>
        </OperationDialog>
    );
}
