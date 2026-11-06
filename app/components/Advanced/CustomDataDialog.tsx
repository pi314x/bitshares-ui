// custom (operation 35): a transaction that carries data and does nothing else. Programs
// read it from the chain (a number says whose it is) and the accounts named as required
// must have signed it. Stored for ever and paid by the byte.
import * as React from "react";
import {Input} from "../../design-system/Input";
import {Select} from "../../design-system/Select";
import {
    DialogField,
    DialogNote,
    OperationDialog,
    useOperationSubmit
} from "../Utility/OperationDialog";
import AdvancedActions from "../../actions/AdvancedActions";
import {buildCustom} from "../../lib/common/advancedOps";
import {
    AccountListField,
    AreaField,
    errorText,
    idOf,
    t,
    useAccountList,
    useCurrentAccount
} from "./fields";

export default function CustomDataDialog(props: {
    onCancel: () => void;
    onDone: () => void;
}) {
    const me = useCurrentAccount();
    const [required, setRequired] = React.useState("");
    const list = useAccountList(required);
    const [id, setId] = React.useState("0");
    const [mode, setMode] = React.useState<"text" | "hex">("text");
    const [data, setData] = React.useState("");
    const {submitting, error, run} = useOperationSubmit(
        true,
        props.onDone,
        t("custom.success")
    );
    const built = buildCustom({
        payerId: idOf(me.account),
        requiredAuthIds: list.ids,
        id,
        dataMode: mode,
        data
    });
    const ready = built.ok && list.ready && !list.missing.length;

    return (
        <OperationDialog
            visible={true}
            title={t("custom.title")}
            submitLabel={t("custom.submit")}
            canSubmit={ready}
            submitting={submitting}
            error={error}
            onSubmit={() =>
                built.ok &&
                run(() => AdvancedActions.send([["custom", built.op]]))
            }
            onCancel={props.onCancel}
        >
            <DialogNote>{t("custom.payer", {name: me.name || "-"})}</DialogNote>
            <DialogField
                label={t("custom.id")}
                help={t("custom.id_help")}
                error={
                    !built.ok && built.error === "id_invalid"
                        ? errorText(built)
                        : null
                }
            >
                <Input
                    value={id}
                    inputMode="numeric"
                    aria-label={t("custom.id")}
                    onChange={e => setId(e.target.value)}
                />
            </DialogField>
            <DialogField label={t("custom.format")}>
                <Select
                    value={mode}
                    onChange={value =>
                        setMode(value === "hex" ? "hex" : "text")
                    }
                >
                    <Select.Option value="text">
                        {t("custom.text")}
                    </Select.Option>
                    <Select.Option value="hex">{t("custom.hex")}</Select.Option>
                </Select>
            </DialogField>
            <AreaField
                label={t("custom.data")}
                help={t("custom.data_help")}
                mono={mode === "hex"}
                rows={5}
                value={data}
                onChange={setData}
                error={
                    !built.ok &&
                    (built.error === "data_invalid" ||
                        built.error === "data_too_large")
                        ? errorText(built)
                        : null
                }
            />
            <AccountListField
                label={t("custom.required")}
                help={t("custom.required_help")}
                value={required}
                onChange={setRequired}
                list={list}
            />
        </OperationDialog>
    );
}
