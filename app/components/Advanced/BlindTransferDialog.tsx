// The three blind (confidential) transfers: into the blinded balances (39), between them
// (40) and back out (41). The commitments, the range proofs and the stealth memos are
// made by a tool that has the cryptography (the command-line wallet's blind commands);
// they are pasted here as JSON and this dialog signs and sends the operation. A range
// proof cannot be made in this application.
import * as React from "react";
import {Select} from "../../design-system/Select";
import {Input} from "../../design-system/Input";
import {
    DialogField,
    DialogNote,
    OperationDialog,
    useOperationSubmit
} from "../Utility/OperationDialog";
import AdvancedActions from "../../actions/AdvancedActions";
import {
    buildBlindTransfer,
    buildTransferFromBlind,
    buildTransferToBlind
} from "../../lib/common/advancedOps";
import {
    AccountNameField,
    AreaField,
    AssetSymbolField,
    errorText,
    idOf,
    t,
    useAccountField,
    useAssetField,
    useCurrentAccount
} from "./fields";

type Mode = "to_blind" | "blind" | "from_blind";
const OPERATION: Record<Mode, string> = {
    to_blind: "transfer_to_blind",
    blind: "blind_transfer",
    from_blind: "transfer_from_blind"
};

export default function BlindTransferDialog(props: {
    onCancel: () => void;
    onDone: () => void;
}) {
    const me = useCurrentAccount();
    const [mode, setMode] = React.useState<Mode>("to_blind");
    const asset = useAssetField();
    const receiver = useAccountField();
    const [amount, setAmount] = React.useState("");
    const [factor, setFactor] = React.useState("");
    const [inputs, setInputs] = React.useState("");
    const [outputs, setOutputs] = React.useState("");
    const {submitting, error, run} = useOperationSubmit(
        true,
        props.onDone,
        t("blind.success")
    );
    const assetId = asset.asset ? asset.asset.id : null;
    const precision = asset.asset ? asset.asset.precision : 0;

    const built =
        mode === "to_blind"
            ? buildTransferToBlind({
                  fromId: idOf(me.account),
                  assetId,
                  precision,
                  amount,
                  blindingFactor: factor,
                  outputs
              })
            : mode === "blind"
            ? buildBlindTransfer({assetId, inputs, outputs})
            : buildTransferFromBlind({
                  toId: receiver.id,
                  assetId,
                  precision,
                  amount,
                  blindingFactor: factor,
                  inputs
              });
    const touched =
        (mode !== "from_blind" && outputs.trim()) ||
        (mode !== "to_blind" && inputs.trim());
    const refusal = touched && !built.ok ? errorText(built) : null;

    return (
        <OperationDialog
            visible={true}
            title={t("blind.title")}
            submitLabel={t(`blind.submit_${mode}`)}
            canSubmit={built.ok}
            submitting={submitting}
            error={error}
            width={640}
            onSubmit={() =>
                built.ok &&
                run(() => AdvancedActions.send([[OPERATION[mode], built.op]]))
            }
            onCancel={props.onCancel}
        >
            <DialogNote>{t("blind.explain")}</DialogNote>
            <DialogField label={t("blind.mode")}>
                <Select value={mode} onChange={v => setMode(v as Mode)}>
                    <Select.Option value="to_blind">
                        {t("blind.mode_to_blind")}
                    </Select.Option>
                    <Select.Option value="blind">
                        {t("blind.mode_blind")}
                    </Select.Option>
                    <Select.Option value="from_blind">
                        {t("blind.mode_from_blind")}
                    </Select.Option>
                </Select>
            </DialogField>
            {mode === "to_blind" ? (
                <DialogNote>
                    {t("blind.from", {name: me.name || "-"})}
                </DialogNote>
            ) : null}
            <AssetSymbolField
                label={t(mode === "blind" ? "blind.asset_fee" : "blind.asset")}
                help={mode === "blind" ? t("blind.asset_fee_help") : undefined}
                value={asset.text}
                onChange={asset.setText}
                lookup={asset.lookup}
            />
            {mode === "from_blind" ? (
                <AccountNameField
                    label={t("blind.to")}
                    value={receiver.text}
                    onChange={receiver.setText}
                    lookup={receiver.lookup}
                />
            ) : null}
            {mode !== "blind" ? (
                <>
                    <DialogField label={t("blind.amount")}>
                        <Input
                            value={amount}
                            inputMode="decimal"
                            aria-label={t("blind.amount")}
                            onChange={e => setAmount(e.target.value)}
                        />
                    </DialogField>
                    <DialogField
                        label={t("blind.factor")}
                        help={t("blind.factor_help")}
                    >
                        <Input
                            value={factor}
                            autoCapitalize="none"
                            spellCheck={false}
                            aria-label={t("blind.factor")}
                            onChange={e => setFactor(e.target.value)}
                        />
                    </DialogField>
                </>
            ) : null}
            {mode !== "to_blind" ? (
                <AreaField
                    label={t("blind.inputs")}
                    help={t("blind.inputs_help")}
                    rows={6}
                    value={inputs}
                    onChange={setInputs}
                />
            ) : null}
            {mode !== "from_blind" ? (
                <AreaField
                    label={t("blind.outputs")}
                    help={t("blind.outputs_help")}
                    rows={6}
                    value={outputs}
                    onChange={setOutputs}
                />
            ) : null}
            {refusal ? <DialogNote>{refusal}</DialogNote> : null}
        </OperationDialog>
    );
}
