// Custom authorities of the current account: the list (read from the chain by id, the ids
// found in the account's history, or added by hand), a new one, a change, a removal
// (custom_authority_create / _update / _delete, operations 54-56). BSIP 40 is not on the
// main network: there the list is empty and a new one is refused, which the form says.
import * as React from "react";
import {Modal} from "../../design-system/Modal";
import {Button} from "../../design-system/Button";
import {Input} from "../../design-system/Input";
import {
    DialogNote,
    OperationDialog,
    useOperationSubmit
} from "../Utility/OperationDialog";
import AdvancedActions from "../../actions/AdvancedActions";
import {
    AUTHORITY_ID,
    CustomAuthority,
    buildCustomAuthorityDelete,
    isInForce
} from "../../lib/common/customAuthorities";
import {
    CUSTOM_AUTHORITY_OPERATIONS,
    describeRestrictions
} from "../../lib/common/restrictions";
import CustomAuthorityForm from "./CustomAuthorityForm";
import {idOf, t, useCurrentAccount} from "./fields";
import styles from "./Advanced.module.scss";

function DeleteAuthorityDialog(props: {
    authority: CustomAuthority;
    accountId: string | null;
    onCancel: () => void;
    onDone: () => void;
}) {
    const {submitting, error, run} = useOperationSubmit(
        true,
        props.onDone,
        t("authority.deleted")
    );
    const built = buildCustomAuthorityDelete({
        accountId: props.accountId,
        authorityId: props.authority.id
    });
    return (
        <OperationDialog
            visible={true}
            title={t("authority.delete_title", {id: props.authority.id})}
            submitLabel={t("authority.delete_submit")}
            canSubmit={built.ok}
            submitting={submitting}
            error={error}
            onSubmit={() =>
                built.ok &&
                run(() =>
                    AdvancedActions.send([
                        ["custom_authority_delete", built.op]
                    ])
                )
            }
            onCancel={props.onCancel}
        >
            <DialogNote>{t("authority.delete_text")}</DialogNote>
        </OperationDialog>
    );
}

const operationName = (id: number) =>
    (CUSTOM_AUTHORITY_OPERATIONS.find(([i]) => i === id) || [id, `#${id}`])[1];

export default function CustomAuthoritiesDialog(props: {onCancel: () => void}) {
    const me = useCurrentAccount();
    const accountId = idOf(me.account);
    const [authorities, setAuthorities] = React.useState<
        CustomAuthority[] | null
    >(null);
    const [failed, setFailed] = React.useState(false);
    const [now, setNow] = React.useState(Date.now() / 1000);
    const [extraIds, setExtraIds] = React.useState<string[]>([]);
    const [idText, setIdText] = React.useState("");
    const [editing, setEditing] = React.useState<
        CustomAuthority | "new" | null
    >(null);
    const [deleting, setDeleting] = React.useState<CustomAuthority | null>(
        null
    );
    const [reload, setReload] = React.useState(0);

    React.useEffect(() => {
        if (!accountId) return;
        let cancelled = false;
        setAuthorities(null);
        setFailed(false);
        AdvancedActions.getHeadTime()
            .then(time => !cancelled && setNow(time))
            .catch(() => undefined);
        AdvancedActions.getCustomAuthorities(accountId, extraIds)
            .then(found => !cancelled && setAuthorities(found))
            .catch(() => !cancelled && setFailed(true));
        return () => {
            cancelled = true;
        };
    }, [accountId, extraIds, reload]);

    const refresh = () => {
        setEditing(null);
        setDeleting(null);
        setReload(reload + 1);
    };
    const addId = () => {
        const id = idText.trim();
        if (!AUTHORITY_ID.test(id) || extraIds.includes(id)) return;
        setExtraIds([...extraIds, id]);
        setIdText("");
    };

    return (
        <>
            <Modal
                visible={true}
                title={t("authority.list_title")}
                width={720}
                onCancel={props.onCancel}
                footer={
                    <div className={styles.inline}>
                        <Button onClick={props.onCancel}>{t("close")}</Button>
                        <Button
                            variant="accent"
                            disabled={!accountId}
                            onClick={() => setEditing("new")}
                        >
                            {t("authority.new")}
                        </Button>
                    </div>
                }
            >
                <div className={styles.stack}>
                    <DialogNote>
                        {t("authority.list_explain", {name: me.name || "-"})}
                    </DialogNote>
                    {failed ? (
                        <p className={styles.empty}>{t("lookup_failed")}</p>
                    ) : null}
                    {authorities === null && !failed ? (
                        <p className={styles.empty}>{t("lookup_loading")}</p>
                    ) : null}
                    {authorities && !authorities.length ? (
                        <p className={styles.empty}>{t("authority.none")}</p>
                    ) : null}
                    {(authorities || []).map(authority => {
                        const lines = describeRestrictions(
                            operationName(authority.operationType),
                            authority.restrictions
                        );
                        return (
                            <div className={styles.step} key={authority.id}>
                                <dl className={styles.facts}>
                                    <dt>{t("authority.id")}</dt>
                                    <dd>{authority.id}</dd>
                                    <dt>{t("authority.operation")}</dt>
                                    <dd>
                                        {`${
                                            authority.operationType
                                        } ${operationName(
                                            authority.operationType
                                        )}`}
                                    </dd>
                                    <dt>{t("authority.state")}</dt>
                                    <dd>
                                        {t(
                                            isInForce(authority, now)
                                                ? "authority.in_force"
                                                : authority.enabled
                                                ? "authority.not_in_force"
                                                : "authority.disabled"
                                        )}
                                    </dd>
                                    <dt>{t("authority.valid")}</dt>
                                    <dd>{`${authority.validFrom.replace(
                                        "T",
                                        " "
                                    )} - ${authority.validTo.replace(
                                        "T",
                                        " "
                                    )} UTC`}</dd>
                                    <dt>{t("authority.signers")}</dt>
                                    <dd>
                                        {[
                                            ...(authority.auth?.account_auths ||
                                                []),
                                            ...(authority.auth?.key_auths || [])
                                        ]
                                            .map(
                                                ([who, w]: any) =>
                                                    `${who} (${w})`
                                            )
                                            .join(", ")}
                                        {` - ${t("authority.threshold_short", {
                                            count:
                                                authority.auth?.weight_threshold
                                        })}`}
                                    </dd>
                                </dl>
                                {lines.length ? (
                                    <ul className={styles.lines}>
                                        {lines.map((line, i) => (
                                            <li
                                                key={i}
                                            >{`#${line.id} ${line.field} ${line.fn} ${line.value}`}</li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className={styles.empty}>
                                        {t("authority.no_restrictions")}
                                    </p>
                                )}
                                <div className={styles.inline}>
                                    <Button
                                        size="small"
                                        onClick={() => setEditing(authority)}
                                    >
                                        {t("authority.change")}
                                    </Button>
                                    <Button
                                        size="small"
                                        onClick={() => setDeleting(authority)}
                                    >
                                        {t("authority.remove")}
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                    <div className={styles.row}>
                        <Input
                            value={idText}
                            placeholder="1.17.0"
                            autoCapitalize="none"
                            spellCheck={false}
                            aria-label={t("authority.add_by_id")}
                            onChange={e => setIdText(e.target.value)}
                            onPressEnter={addId}
                        />
                        <Button
                            size="small"
                            disabled={!AUTHORITY_ID.test(idText.trim())}
                            onClick={addId}
                        >
                            {t("authority.add_by_id")}
                        </Button>
                    </div>
                </div>
            </Modal>
            {editing ? (
                <CustomAuthorityForm
                    authority={editing === "new" ? undefined : editing}
                    onCancel={() => setEditing(null)}
                    onDone={refresh}
                />
            ) : null}
            {deleting ? (
                <DeleteAuthorityDialog
                    authority={deleting}
                    accountId={accountId}
                    onCancel={() => setDeleting(null)}
                    onDone={refresh}
                />
            ) : null}
        </>
    );
}
