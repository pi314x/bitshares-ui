// assert (operation 36): a condition the chain checks before the transaction goes on - an
// account has this name, an asset has this symbol, a block is the one with this id. When
// it does not hold, the whole transaction is rejected. Alone it does nothing; its use is in
// front of other operations, which are added here as JSON. The chain allows only the
// predicates below its parameter `max_predicate_opcode`.
import * as React from "react";
import {Button} from "../../design-system/Button";
import {Input} from "../../design-system/Input";
import {Select} from "../../design-system/Select";
import {
    DialogField,
    DialogNote,
    OperationDialog,
    useOperationSubmit
} from "../Utility/OperationDialog";
import AdvancedActions from "../../actions/AdvancedActions";
import {
    PREDICATE_TAGS,
    Predicate,
    buildAssert
} from "../../lib/common/advancedOps";
import {Step, parseSteps} from "../../lib/common/opJson";
import OperationSteps from "./OperationSteps";
import {
    AccountListField,
    errorText,
    findAccount,
    idOf,
    t,
    useAccountList,
    useCurrentAccount,
    useLookup
} from "./fields";
import styles from "./Advanced.module.scss";

type Kind = Predicate["type"];
interface Row {
    kind: Kind;
    text: string;
}

/** One row: what is asserted, looked up as it is typed; hands the predicate up. */
function PredicateRow(props: {
    row: Row;
    kinds: Kind[];
    onChange: (row: Row) => void;
    onRemove: () => void;
    onPredicate: (predicate: Predicate | null) => void;
}) {
    const {row} = props;
    const account = useLookup(
        row.kind === "account_name" ? row.text : "",
        findAccount
    );
    const asset = useLookup(
        row.kind === "asset_symbol" ? row.text : "",
        symbol => AdvancedActions.getAssetBySymbol(symbol.toUpperCase())
    );
    let predicate: Predicate | null = null;
    if (row.kind === "account_name" && account.state === "ok") {
        predicate = {
            type: "account_name",
            accountId: account.value.id,
            name: account.value.name
        };
    } else if (row.kind === "asset_symbol" && asset.state === "ok") {
        predicate = {
            type: "asset_symbol",
            assetId: asset.value.id,
            symbol: asset.value.symbol
        };
    } else if (row.kind === "block_id" && row.text.trim()) {
        predicate = {type: "block_id", id: row.text.trim()};
    }
    const key = JSON.stringify(predicate);
    React.useEffect(() => {
        props.onPredicate(predicate);
        return () => props.onPredicate(null);
    }, [key]);

    const lookup = row.kind === "asset_symbol" ? asset : account;
    const status =
        row.kind === "block_id"
            ? undefined
            : lookup.state === "missing"
            ? t("lookup_missing")
            : lookup.state === "ok"
            ? t(
                  row.kind === "asset_symbol"
                      ? "assert.found_asset"
                      : "assert.found_account",
                  {
                      id: (lookup.value as any).id
                  }
              )
            : undefined;
    return (
        <div className={styles.step}>
            <div className={styles.row}>
                <Select
                    value={row.kind}
                    onChange={value =>
                        props.onChange({kind: value as Kind, text: ""})
                    }
                >
                    {props.kinds.map(kind => (
                        <Select.Option key={kind} value={kind}>
                            {t(`assert.kind_${kind}`)}
                        </Select.Option>
                    ))}
                </Select>
                <Button size="small" onClick={props.onRemove}>
                    {t("steps.remove")}
                </Button>
            </div>
            <DialogField
                label={t(`assert.value_${row.kind}`)}
                help={
                    lookup.state === "ok" || row.kind === "block_id"
                        ? status
                        : undefined
                }
                error={lookup.state === "missing" ? status : null}
            >
                <Input
                    value={row.text}
                    autoCapitalize="none"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={t(`assert.value_${row.kind}`)}
                    onChange={e =>
                        props.onChange({...row, text: e.target.value})
                    }
                />
            </DialogField>
        </div>
    );
}

export default function AssertDialog(props: {
    onCancel: () => void;
    onDone: () => void;
}) {
    const me = useCurrentAccount();
    const [maxOpcode, setMaxOpcode] = React.useState<number | null>(null);
    React.useEffect(() => {
        let cancelled = false;
        AdvancedActions.getParameters()
            .then(
                p => !cancelled && setMaxOpcode(Number(p.max_predicate_opcode))
            )
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);
    // until the chain has answered, the three; the chain refuses what it does not take
    const limit = maxOpcode === null ? 3 : maxOpcode;
    const kinds = (Object.keys(PREDICATE_TAGS) as Kind[]).filter(
        kind => PREDICATE_TAGS[kind] < limit
    );

    const [rows, setRows] = React.useState<Row[]>([
        {kind: "account_name", text: ""}
    ]);
    const [predicates, setPredicates] = React.useState<Array<Predicate | null>>(
        []
    );
    const [required, setRequired] = React.useState("");
    const list = useAccountList(required);
    const [steps, setSteps] = React.useState<Step[]>([]);
    const {submitting, error, run} = useOperationSubmit(
        true,
        props.onDone,
        t("assert.success")
    );

    const resolved = rows.map((_, i) => predicates[i] || null);
    const built = buildAssert({
        payerId: idOf(me.account),
        predicates: resolved.filter((p): p is Predicate => !!p),
        requiredAuthIds: list.ids,
        maxOpcode: limit
    });
    const parsedSteps = parseSteps(steps);
    const ready =
        built.ok &&
        resolved.every(Boolean) &&
        parsedSteps.ok &&
        list.ready &&
        !list.missing.length;

    return (
        <OperationDialog
            visible={true}
            title={t("assert.title")}
            submitLabel={t("assert.submit")}
            canSubmit={ready}
            submitting={submitting}
            error={error}
            width={640}
            onSubmit={() =>
                built.ok &&
                parsedSteps.ok &&
                run(() =>
                    AdvancedActions.send([
                        ["assert", built.op],
                        ...parsedSteps.op
                    ])
                )
            }
            onCancel={props.onCancel}
        >
            <DialogNote>
                {t("assert.explain", {name: me.name || "-"})}
            </DialogNote>
            {maxOpcode !== null && maxOpcode < 3 ? (
                <DialogNote>
                    {t("assert.limited", {count: maxOpcode})}
                </DialogNote>
            ) : null}
            {rows.map((row, index) => (
                <PredicateRow
                    key={index}
                    row={row}
                    kinds={kinds}
                    onChange={next =>
                        setRows(rows.map((r, i) => (i === index ? next : r)))
                    }
                    onRemove={() => {
                        setRows(rows.filter((_, i) => i !== index));
                        setPredicates(predicates.filter((_, i) => i !== index));
                    }}
                    onPredicate={predicate =>
                        setPredicates(previous => {
                            const next = previous.slice();
                            next[index] = predicate;
                            return next;
                        })
                    }
                />
            ))}
            <div className={styles.inline}>
                <Button
                    size="small"
                    disabled={!kinds.length}
                    onClick={() =>
                        setRows([...rows, {kind: kinds[0], text: ""}])
                    }
                >
                    {t("assert.add")}
                </Button>
            </div>
            {!built.ok && rows.length && resolved.every(Boolean) ? (
                <DialogNote>{errorText(built)}</DialogNote>
            ) : null}
            <AccountListField
                label={t("assert.required")}
                help={t("assert.required_help")}
                value={required}
                onChange={setRequired}
                list={list}
            />
            <OperationSteps
                label={t("assert.steps")}
                help={t("assert.steps_help")}
                steps={steps}
                onChange={setSteps}
            />
            {!parsedSteps.ok ? (
                <DialogNote>{errorText(parsedSteps)}</DialogNote>
            ) : null}
        </OperationDialog>
    );
}
