// committee_member_update (operation 30): a committee member changes the url its
// candidacy shows. Only the account of a committee member can; the dialog looks the
// member up and says so when the account is none.
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
    MAX_URL_LENGTH,
    buildCommitteeMemberUpdate
} from "../../lib/common/advancedOps";
import {errorText, idOf, t, useCurrentAccount, useLookup} from "./fields";

export default function CommitteeMemberDialog(props: {
    onCancel: () => void;
    onDone: () => void;
}) {
    const me = useCurrentAccount();
    const accountId = idOf(me.account);
    const member = useLookup(accountId || "", id =>
        AdvancedActions.getCommitteeMember(id)
    );
    const [url, setUrl] = React.useState<string | null>(null);
    const current = member.state === "ok" ? member.value.url : "";
    // the field starts with the url the member has now
    const text = url === null ? current : url;
    const {submitting, error, run} = useOperationSubmit(
        true,
        props.onDone,
        t("committee_member.success")
    );
    const built = buildCommitteeMemberUpdate({
        memberId: member.state === "ok" ? member.value.id : null,
        accountId,
        currentUrl: current,
        newUrl: text
    });

    return (
        <OperationDialog
            visible={true}
            title={t("committee_member.title")}
            submitLabel={t("committee_member.submit")}
            canSubmit={built.ok}
            submitting={submitting}
            error={error}
            onSubmit={() =>
                built.ok &&
                run(() =>
                    AdvancedActions.send([
                        ["committee_member_update", built.op]
                    ])
                )
            }
            onCancel={props.onCancel}
        >
            <DialogNote>
                {t("committee_member.account", {name: me.name || "-"})}
            </DialogNote>
            {member.state === "missing" ? (
                <DialogNote>{t("committee_member.not_a_member")}</DialogNote>
            ) : null}
            {member.state === "ok" ? (
                <DialogField
                    label={t("committee_member.url")}
                    help={t("committee_member.url_help", {
                        id: member.value.id,
                        max: MAX_URL_LENGTH
                    })}
                    error={
                        !built.ok && built.error === "url_too_long"
                            ? errorText(built)
                            : null
                    }
                >
                    <Input
                        value={text}
                        inputMode="url"
                        autoCapitalize="none"
                        aria-label={t("committee_member.url")}
                        onChange={e => setUrl(e.target.value)}
                    />
                </DialogField>
            ) : null}
        </OperationDialog>
    );
}
