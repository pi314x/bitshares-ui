// Create (custom_authority_create, 54) or change (custom_authority_update, 55) a custom
// authority: which kind of operation it may sign, when, who may sign it and under which
// restrictions. The rules are `lib/common/customAuthorities.ts`; what is typed as names
// is looked up before anything is built. A chain that has not switched custom
// authorities on (the main network) refuses a new one, which the dialog says first.
import * as React from "react";
import {Checkbox} from "../../design-system/Checkbox";
import {Input} from "../../design-system/Input";
import {Select} from "../../design-system/Select";
import {
    DialogField,
    DialogNote,
    OperationDialog,
    useOperationSubmit
} from "../Utility/OperationDialog";
import AdvancedActions from "../../actions/AdvancedActions";
import {Built} from "../../lib/common/advancedOps";
import {
    BuiltAuthority,
    CustomAuthority,
    CustomAuthorityOptions,
    buildAuthority,
    buildCustomAuthorityCreate,
    buildCustomAuthorityUpdate,
    chainTimeFromLocal,
    customAuthorityLimits,
    localFromChainTime,
    parseWeightedLines
} from "../../lib/common/customAuthorities";
import {
    CUSTOM_AUTHORITY_OPERATIONS,
    RestrictionRow,
    buildRestrictions,
    describeRestrictions,
    parseRestrictionsJson,
    resolveRowNames,
    withPlaceholderIds
} from "../../lib/common/restrictions";
import RestrictionEditor from "./RestrictionEditor";
import {
    AreaField,
    errorText,
    idOf,
    t,
    useAccountList,
    useCurrentAccount
} from "./fields";
import styles from "./Advanced.module.scss";

const DAY = 86400;

const nameOf = (operationId: number) =>
    (CUSTOM_AUTHORITY_OPERATIONS.find(([id]) => id === operationId) || [
        0,
        "transfer"
    ])[1];

const lines = (pairs: Array<[string, number]>) =>
    pairs.map(([who, weight]) => `${who} ${weight}`).join("\n");

export default function CustomAuthorityForm(props: {
    /** the authority to change; none to create one */
    authority?: CustomAuthority;
    onCancel: () => void;
    onDone: () => void;
}) {
    const {authority} = props;
    const updating = !!authority;
    const me = useCurrentAccount();
    const accountId = idOf(me.account);

    const [chain, setChain] = React.useState<{
        limits: CustomAuthorityOptions | null;
        now: number;
    } | null>(null);
    React.useEffect(() => {
        let cancelled = false;
        Promise.all([
            AdvancedActions.getParameters(),
            AdvancedActions.getHeadTime()
        ])
            .then(([parameters, now]) => {
                if (!cancelled) {
                    setChain({limits: customAuthorityLimits(parameters), now});
                }
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);

    const [operationId, setOperationId] = React.useState(
        authority ? authority.operationType : 0
    );
    const [enabled, setEnabled] = React.useState(
        authority ? authority.enabled : true
    );
    const [from, setFrom] = React.useState(() =>
        authority
            ? localFromChainTime(authority.validFrom)
            : localFromChainTime(new Date().toISOString())
    );
    const [to, setTo] = React.useState(() =>
        authority
            ? localFromChainTime(authority.validTo)
            : localFromChainTime(
                  new Date(Date.now() + 30 * DAY * 1000).toISOString()
              )
    );
    const [threshold, setThreshold] = React.useState(
        authority ? String(authority.auth?.weight_threshold ?? 1) : "1"
    );
    const [accountsText, setAccountsText] = React.useState(
        authority ? lines(authority.auth?.account_auths || []) : ""
    );
    const [keysText, setKeysText] = React.useState(
        authority ? lines(authority.auth?.key_auths || []) : ""
    );
    const [authDirty, setAuthDirty] = React.useState(false);
    const [rows, setRows] = React.useState<RestrictionRow[]>([]);
    const [json, setJson] = React.useState("");
    const [remove, setRemove] = React.useState<number[]>([]);
    const {submitting, error, run} = useOperationSubmit(
        true,
        props.onDone,
        t(updating ? "authority.updated" : "authority.created")
    );

    // who may sign
    const accountLines = parseWeightedLines(accountsText);
    const keyLines = parseWeightedLines(keysText);
    const list = useAccountList(
        (accountLines || []).map(line => line.token).join(" ")
    );
    const authorityBuilt: Built<BuiltAuthority> =
        accountLines && keyLines
            ? buildAuthority({
                  threshold,
                  accounts: accountLines.map(line => ({
                      id: list.map[line.token] || line.token,
                      weight: line.weight
                  })),
                  keys: keyLines.map(line => ({
                      key: line.token,
                      weight: line.weight
                  }))
              })
            : {ok: false, error: "authority_invalid"};
    const authorityReady =
        authorityBuilt.ok && list.ready && !list.missing.length;
    // said once the person has typed who may sign, and the names are found
    const authorityProblem =
        (accountsText.trim() || keysText.trim()) &&
        !authorityBuilt.ok &&
        list.ready &&
        !list.missing.length
            ? errorText(authorityBuilt)
            : null;

    // the restrictions: JSON when it holds something, else the rows (names checked
    // in shape now, looked up when it is sent)
    const operationName = nameOf(operationId);
    const jsonUsed = !!json.trim();
    const restrictionsChecked = jsonUsed
        ? parseRestrictionsJson(json)
        : buildRestrictions(
              operationName,
              withPlaceholderIds(operationName, rows)
          );
    const incomplete =
        !jsonUsed && rows.some(r => !r.value.trim() && r.fn !== "eq");

    const validFrom = chainTimeFromLocal(from);
    const validTo = chainTimeFromLocal(to);
    const timesValid = !!validFrom && !!validTo;

    const create = buildCustomAuthorityCreate({
        accountId,
        operationId,
        enabled,
        validFrom,
        validTo,
        authority: authorityBuilt.ok ? authorityBuilt.op : (undefined as any),
        restrictions: restrictionsChecked.ok ? restrictionsChecked.op : [],
        limits: chain ? chain.limits : null,
        now: chain ? chain.now : 0
    });
    const authorityChanged = authDirty;
    const update = authority
        ? buildCustomAuthorityUpdate({
              accountId,
              authorityId: authority.id,
              enabled: enabled !== authority.enabled ? enabled : null,
              // the field shows minutes: an untouched field is not a change (the chain's
              // time has seconds, which a changed field would drop)
              validFrom:
                  validFrom && from !== localFromChainTime(authority.validFrom)
                      ? validFrom
                      : null,
              validTo:
                  validTo && to !== localFromChainTime(authority.validTo)
                      ? validTo
                      : null,
              authority:
                  authorityChanged && authorityBuilt.ok
                      ? authorityBuilt.op
                      : null,
              remove,
              add: restrictionsChecked.ok ? restrictionsChecked.op : []
          })
        : null;

    const notSwitchedOn = !updating && !!chain && !chain.limits;
    const built = updating ? update : create;
    const ready =
        !!built &&
        built.ok &&
        restrictionsChecked.ok &&
        !incomplete &&
        timesValid &&
        (!authorityChanged && updating ? true : authorityReady) &&
        !notSwitchedOn &&
        !!chain;

    const submit = () =>
        run(async () => {
            if (!built || !built.ok) return;
            let restrictions: any[] = restrictionsChecked.ok
                ? restrictionsChecked.op
                : [];
            if (!jsonUsed && rows.length) {
                let named: RestrictionRow[];
                try {
                    named = await resolveRowNames(operationName, rows, {
                        accounts: AdvancedActions.getAccountIds.bind(
                            AdvancedActions
                        ),
                        assets: AdvancedActions.getAssetIds.bind(
                            AdvancedActions
                        )
                    });
                } catch (e) {
                    throw new Error(
                        t("authority.unknown_name", {
                            name: (e as Error).message
                        })
                    );
                }
                const final = buildRestrictions(operationName, named);
                if (!final.ok) throw new Error(errorText(final));
                restrictions = final.op;
            }
            const op = updating
                ? {...built.op, restrictions_to_add: restrictions}
                : {...built.op, restrictions};
            return AdvancedActions.send([
                [
                    updating
                        ? "custom_authority_update"
                        : "custom_authority_create",
                    op
                ]
            ]);
        });

    const existing = authority
        ? describeRestrictions(
              nameOf(authority.operationType),
              authority.restrictions
          )
        : [];

    return (
        <OperationDialog
            visible={true}
            title={t(
                updating ? "authority.update_title" : "authority.create_title"
            )}
            submitLabel={t(
                updating ? "authority.update_submit" : "authority.create_submit"
            )}
            canSubmit={ready}
            submitting={submitting}
            error={error}
            width={680}
            onSubmit={submit}
            onCancel={props.onCancel}
        >
            <DialogNote>
                {t("authority.account", {name: me.name || "-"})}
            </DialogNote>
            {notSwitchedOn ? (
                <DialogNote>{t("authority.not_switched_on")}</DialogNote>
            ) : null}
            <DialogField
                label={t("authority.operation")}
                help={t("authority.operation_help")}
            >
                <Select
                    value={operationId}
                    disabled={updating}
                    onChange={value => {
                        setOperationId(Number(value));
                        setRows([]);
                    }}
                >
                    {CUSTOM_AUTHORITY_OPERATIONS.map(([id, name]) => (
                        <Select.Option key={id} value={id}>
                            {`${id} ${name}`}
                        </Select.Option>
                    ))}
                </Select>
            </DialogField>
            <Checkbox
                checked={enabled}
                onChange={e => setEnabled(e.target.checked)}
            >
                {t("authority.enabled")}
            </Checkbox>
            <div className={styles.row}>
                <DialogField label={t("authority.valid_from")}>
                    <Input
                        type="datetime-local"
                        value={from}
                        aria-label={t("authority.valid_from")}
                        onChange={e => setFrom(e.target.value)}
                    />
                </DialogField>
                <DialogField label={t("authority.valid_to")}>
                    <Input
                        type="datetime-local"
                        value={to}
                        aria-label={t("authority.valid_to")}
                        onChange={e => setTo(e.target.value)}
                    />
                </DialogField>
            </div>
            {validFrom &&
            validTo &&
            !updating &&
            !create.ok &&
            create.error === "valid_range" ? (
                <DialogNote>{errorText(create)}</DialogNote>
            ) : null}
            <DialogField
                label={t("authority.threshold")}
                help={t("authority.threshold_help")}
            >
                <Input
                    value={threshold}
                    inputMode="numeric"
                    aria-label={t("authority.threshold")}
                    onChange={e => {
                        setThreshold(e.target.value);
                        setAuthDirty(true);
                    }}
                />
            </DialogField>
            <AreaField
                label={t("authority.accounts")}
                help={
                    list.missing.length
                        ? undefined
                        : t("authority.accounts_help")
                }
                error={
                    list.missing.length
                        ? t("lookup_missing_some", {
                              names: list.missing.join(", ")
                          })
                        : null
                }
                mono={false}
                rows={3}
                value={accountsText}
                onChange={text => {
                    setAccountsText(text);
                    setAuthDirty(true);
                }}
            />
            <AreaField
                label={t("authority.keys")}
                help={t("authority.keys_help")}
                rows={3}
                value={keysText}
                onChange={text => {
                    setKeysText(text);
                    setAuthDirty(true);
                }}
            />
            {authorityProblem ? (
                <DialogNote>{authorityProblem}</DialogNote>
            ) : null}
            {updating && existing.length ? (
                <DialogField
                    label={t("authority.current_restrictions")}
                    help={t("authority.remove_help")}
                >
                    <div className={styles.stack}>
                        {existing.map((line, i) => (
                            <Checkbox
                                key={i}
                                disabled={line.id === null}
                                checked={
                                    line.id !== null && remove.includes(line.id)
                                }
                                onChange={e => {
                                    if (line.id === null) return;
                                    const id = line.id;
                                    setRemove(
                                        e.target.checked
                                            ? [...remove, id]
                                            : remove.filter(r => r !== id)
                                    );
                                }}
                            >
                                {`#${line.id} ${line.field} ${line.fn} ${line.value}`}
                            </Checkbox>
                        ))}
                    </div>
                </DialogField>
            ) : null}
            <RestrictionEditor
                operationName={operationName}
                rows={rows}
                onRows={setRows}
                json={json}
                onJson={setJson}
                jsonError={
                    jsonUsed && !restrictionsChecked.ok
                        ? errorText(restrictionsChecked)
                        : null
                }
                rowError={
                    !jsonUsed &&
                    rows.length &&
                    !restrictionsChecked.ok &&
                    !incomplete
                        ? errorText(restrictionsChecked)
                        : null
                }
            />
        </OperationDialog>
    );
}
