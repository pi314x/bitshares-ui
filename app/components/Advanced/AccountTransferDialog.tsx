// account_transfer (operation 9): give an account to another one. The chain has no
// handler for it - bitshares-core lists it as "unimplemented" - so the node refuses it;
// the dialog says so before it is sent, and shows what the node answers.
import * as React from "react";
import {Alert} from "../../design-system/Alert";
import {
    DialogNote,
    OperationDialog,
    useOperationSubmit
} from "../Utility/OperationDialog";
import AdvancedActions from "../../actions/AdvancedActions";
import {buildAccountTransfer} from "../../lib/common/advancedOps";
import {
    AccountNameField,
    errorText,
    idOf,
    t,
    useAccountField,
    useCurrentAccount
} from "./fields";

export default function AccountTransferDialog(props: {
    onCancel: () => void;
    onDone: () => void;
}) {
    const me = useCurrentAccount();
    const owner = useAccountField();
    const {submitting, error, run} = useOperationSubmit(
        true,
        props.onDone,
        t("account_transfer.success")
    );
    const built = buildAccountTransfer({
        accountId: idOf(me.account),
        newOwnerId: owner.id
    });
    const refusal =
        owner.text.trim() && !built.ok && owner.lookup.state === "ok"
            ? errorText(built)
            : null;

    return (
        <OperationDialog
            visible={true}
            title={t("account_transfer.title")}
            submitLabel={t("account_transfer.submit")}
            canSubmit={built.ok}
            submitting={submitting}
            error={error}
            onSubmit={() =>
                built.ok &&
                run(() =>
                    AdvancedActions.send([["account_transfer", built.op]])
                )
            }
            onCancel={props.onCancel}
        >
            <Alert
                type="warning"
                showIcon
                message={t("account_transfer.not_accepted_title")}
                description={t("account_transfer.not_accepted")}
            />
            <DialogNote>
                {t("account_transfer.from", {name: me.name || "-"})}
            </DialogNote>
            <AccountNameField
                label={t("account_transfer.new_owner")}
                help={t("account_transfer.new_owner_help")}
                value={owner.text}
                onChange={owner.setText}
                lookup={owner.lookup}
            />
            {refusal ? <DialogNote>{refusal}</DialogNote> : null}
        </OperationDialog>
    );
}
