// Any operation, as JSON: its name and its fields as the chain reads them, checked by the
// serializer as they are typed, then signed and sent - or proposed, for an account whose
// authority is somebody else's to give. For what has no screen of its own, and for what
// another tool prepared.
import * as React from "react";
import {Button} from "../../design-system/Button";
import {Checkbox} from "../../design-system/Checkbox";
import {Select} from "../../design-system/Select";
import {
    DialogField,
    OperationDialog,
    useOperationSubmit
} from "../Utility/OperationDialog";
import AdvancedActions from "../../actions/AdvancedActions";
import {
    operationTemplate,
    parseOperationJson,
    sendableOperations
} from "../../lib/common/opJson";
import {AreaField, errorText, idOf, t, useCurrentAccount} from "./fields";
import styles from "./Advanced.module.scss";

export default function OperationJsonDialog(props: {
    onCancel: () => void;
    onDone: () => void;
}) {
    const me = useCurrentAccount();
    const names = React.useMemo(() => sendableOperations(), []);
    const [name, setName] = React.useState("transfer");
    const [text, setText] = React.useState(() => operationTemplate("transfer"));
    const [propose, setPropose] = React.useState(false);
    const {submitting, error, run} = useOperationSubmit(
        true,
        props.onDone,
        t("json.success")
    );
    const built = parseOperationJson(name, text);
    const accountId = idOf(me.account);

    return (
        <OperationDialog
            visible={true}
            title={t("json.title")}
            submitLabel={t(propose ? "json.submit_propose" : "json.submit")}
            canSubmit={built.ok && (!propose || !!accountId)}
            submitting={submitting}
            error={error}
            width={640}
            onSubmit={() => {
                if (!built.ok) return;
                if (propose && accountId) {
                    run(() =>
                        AdvancedActions.propose({
                            fee_paying_account: accountId,
                            proposed_ops: [{op: built.op}]
                        })
                    );
                } else {
                    run(() => AdvancedActions.send([[name, built.op[1]]]));
                }
            }}
            onCancel={props.onCancel}
        >
            <DialogField
                label={t("json.operation")}
                help={t("json.operation_help")}
            >
                <Select
                    value={name}
                    showSearch
                    onChange={value => {
                        setName(String(value));
                        setText(operationTemplate(String(value)));
                    }}
                >
                    {names.map(([id, operation]) => (
                        <Select.Option key={id} value={operation}>
                            {`${id} ${operation}`}
                        </Select.Option>
                    ))}
                </Select>
            </DialogField>
            <AreaField
                label={t("json.fields")}
                help={t("json.fields_help")}
                rows={10}
                value={text}
                onChange={setText}
                error={!built.ok ? errorText(built) : null}
            />
            <div className={styles.inline}>
                <Button
                    size="small"
                    onClick={() => setText(operationTemplate(name))}
                >
                    {t("json.template")}
                </Button>
            </div>
            <Checkbox
                checked={propose}
                onChange={e => setPropose(e.target.checked)}
            >
                {t("json.propose", {name: me.name || "-"})}
            </Checkbox>
        </OperationDialog>
    );
}
