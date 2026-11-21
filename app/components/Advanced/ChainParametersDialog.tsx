// committee_member_update_global_parameters (operation 31): ask for a change of the
// chain's parameters. Only the committee can make one: it is a proposal, made from the
// current account, that the committee members approve. Shown are the parameters as the
// chain has them now; the ones edited are the change, the fee schedule stays as it is.
import * as React from "react";
import {Input} from "../../design-system/Input";
import {Select} from "../../design-system/Select";
import {
    DialogNote,
    OperationDialog,
    useOperationSubmit
} from "../Utility/OperationDialog";
import AdvancedActions from "../../actions/AdvancedActions";
import {
    PARAMETERS,
    ParameterDef,
    ParameterEdits,
    ParameterGroup,
    buildParameterProposal,
    editKey,
    parameterValue
} from "../../lib/common/chainParameters";
import {errorText, idOf, t, useCurrentAccount} from "./fields";
import styles from "./Advanced.module.scss";

const GROUPS: ParameterGroup[] = [
    "blocks",
    "limits",
    "fees",
    "pay",
    "voting",
    "htlc",
    "authorities"
];

export default function ChainParametersDialog(props: {
    onCancel: () => void;
    onDone: () => void;
}) {
    const me = useCurrentAccount();
    const [current, setCurrent] = React.useState<any | null>(null);
    const [failed, setFailed] = React.useState(false);
    const [edits, setEdits] = React.useState<ParameterEdits>({});
    const {submitting, error, run} = useOperationSubmit(
        true,
        props.onDone,
        t("parameters.success")
    );
    React.useEffect(() => {
        let cancelled = false;
        AdvancedActions.getParameters()
            .then(parameters => !cancelled && setCurrent(parameters))
            .catch(() => !cancelled && setFailed(true));
        return () => {
            cancelled = true;
        };
    }, []);

    const built = current
        ? buildParameterProposal({
              proposerId: idOf(me.account),
              current,
              edits
          })
        : null;
    const touched = Object.keys(edits).length > 0;

    const field = (def: ParameterDef) => {
        const key = editKey(def);
        const now = parameterValue(current, def);
        const value = key in edits ? edits[key] : now;
        const changed = key in edits && edits[key].trim() !== now;
        return (
            <tr key={key}>
                <td className={styles.paramName}>{def.key}</td>
                <td className={styles.paramNow}>
                    {now || t("parameters.not_set")}
                </td>
                <td>
                    {def.type === "bool" ? (
                        <Select
                            value={value}
                            onChange={v =>
                                setEdits({...edits, [key]: String(v)})
                            }
                        >
                            <Select.Option value="true">true</Select.Option>
                            <Select.Option value="false">false</Select.Option>
                        </Select>
                    ) : (
                        <Input
                            className={styles.paramInput}
                            value={value}
                            inputMode="numeric"
                            aria-label={def.key}
                            style={changed ? {fontWeight: 600} : undefined}
                            onChange={e =>
                                setEdits({...edits, [key]: e.target.value})
                            }
                        />
                    )}
                </td>
            </tr>
        );
    };

    return (
        <OperationDialog
            visible={true}
            title={t("parameters.title")}
            submitLabel={t("parameters.submit")}
            canSubmit={!!built && built.ok}
            submitting={submitting}
            error={error}
            width={760}
            onSubmit={() =>
                built &&
                built.ok &&
                run(() => AdvancedActions.propose(built.op.op))
            }
            onCancel={props.onCancel}
        >
            <DialogNote>
                {t("parameters.explain", {name: me.name || "-"})}
            </DialogNote>
            {failed ? <DialogNote>{t("lookup_failed")}</DialogNote> : null}
            {!current && !failed ? (
                <DialogNote>{t("lookup_loading")}</DialogNote>
            ) : null}
            {current
                ? GROUPS.map(group => (
                      <div key={group}>
                          <h4 className={styles.sectionTitle}>
                              {t(`parameters.group_${group}`)}
                          </h4>
                          <table className={styles.params}>
                              <thead>
                                  <tr>
                                      <th>{t("parameters.name")}</th>
                                      <th>{t("parameters.now")}</th>
                                      <th>{t("parameters.new")}</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  {PARAMETERS.filter(
                                      d => d.group === group
                                  ).map(field)}
                              </tbody>
                          </table>
                      </div>
                  ))
                : null}
            {built && built.ok ? (
                <DialogNote>
                    {t("parameters.changes", {
                        list: built.op.changed.join(", ")
                    })}
                </DialogNote>
            ) : touched && built ? (
                <DialogNote>{errorText(built)}</DialogNote>
            ) : null}
        </OperationDialog>
    );
}
