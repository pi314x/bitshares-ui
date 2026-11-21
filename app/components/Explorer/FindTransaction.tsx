// "Find a transaction": a transaction id (the hash) in, the block that holds it out. By the id alone:
// the connected node knows a transaction by its id for about a day, an older one is looked up in the
// public index of the chain's history and confirmed by the node (see lib/common/findTransaction.ts).
import * as React from "react";
import {Link, LinkProps} from "react-router-dom";
import counterpart from "counterpart";
import {ChainTypes} from "bitsharesjs";
import {Alert} from "../../design-system/Alert";
import {Button} from "../../design-system/Button";
import {Card} from "../../design-system/Card";
import {Input} from "../../design-system/Input";
import {formatDateTime} from "../../lib/common/dateTime";
import {
    FindResult,
    findTransaction,
    normalizeTransactionId
} from "../../lib/common/findTransaction";
import {INDEX_HOST, liveChain} from "../../lib/chain/transactionFinder";
import styles from "./FindTransaction.module.scss";

// (same @types/react-router-dom v5 + modern TS workaround as Blocks.tsx)
const TypedLink = Link as React.ComponentType<LinkProps>;

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(`find_transaction.${key}`, params) as string;

const OP_NAMES: {[code: number]: string} = {};
function opName(code: number): string {
    if (!Object.keys(OP_NAMES).length) {
        const operations: {[name: string]: number} = (ChainTypes as any)
            .operations;
        Object.keys(operations).forEach(name => {
            OP_NAMES[operations[name]] = name;
        });
    }
    return OP_NAMES[code] || String(code);
}

/** the chain's time (UTC, without a zone) in the reader's clock */
const chainTime = (time: string) => formatDateTime(`${time}Z`);

type State =
    | {phase: "idle"}
    | {phase: "searching"}
    | {phase: "done"; result: FindResult}
    | {phase: "error"; text: string};

export default function FindTransaction() {
    const [id, setId] = React.useState("");
    const [state, setState] = React.useState<State>({phase: "idle"});
    const run = React.useRef<{stopped: boolean} | null>(null);

    // leaving the page ends a search that is still reading
    React.useEffect(
        () => () => {
            if (run.current) run.current.stopped = true;
        },
        []
    );

    async function find() {
        const wanted = normalizeTransactionId(id);
        if (!wanted) {
            setState({phase: "error", text: t("bad_id")});
            return;
        }
        if (run.current) run.current.stopped = true;
        const token = {stopped: false};
        run.current = token;
        const show = (next: State) => {
            if (!token.stopped) setState(next);
        };
        show({phase: "searching"});
        try {
            const result = await findTransaction(liveChain, wanted, {
                cancelled: () => token.stopped
            });
            show({phase: "done", result});
        } catch (error) {
            show({
                phase: "error",
                text: t("failed", {
                    message: (error && (error as Error).message) || ""
                })
            });
        }
    }

    function stop() {
        if (run.current) run.current.stopped = true;
        // (the finder answers "stopped" when it next looks; the page need not wait for that)
        setState({phase: "done", result: {kind: "stopped"}});
    }

    const searching = state.phase === "searching";

    return (
        <Card className={styles.find}>
            <h3 className={styles.title}>{t("title")}</h3>
            <p className={styles.hint}>{t("hint", {host: INDEX_HOST})}</p>
            <form
                className={styles.form}
                onSubmit={event => {
                    event.preventDefault();
                    if (!searching) find();
                }}
            >
                <label className={styles.field}>
                    <span className={styles.label}>{t("id_label")}</span>
                    <Input
                        className={styles.mono}
                        value={id}
                        placeholder={t("id_placeholder")}
                        spellCheck={false}
                        autoComplete="off"
                        onChange={event => setId(event.target.value)}
                    />
                </label>
                <div className={styles.actions}>
                    {searching ? (
                        <Button onClick={stop}>{t("stop")}</Button>
                    ) : (
                        <Button
                            variant="accent"
                            type="submit"
                            disabled={!id.trim()}
                        >
                            {t("find")}
                        </Button>
                    )}
                </div>
            </form>
            <div className={styles.result} aria-live="polite">
                <Result state={state} />
            </div>
        </Card>
    );
}

function Result({state}: {state: State}) {
    if (state.phase === "idle") return null;
    if (state.phase === "error") {
        return <Alert type="error" message={state.text} showIcon />;
    }
    if (state.phase === "searching") {
        return <p className={styles.searching}>{t("searching")}</p>;
    }
    const result = state.result;
    switch (result.kind) {
        case "found":
            return (
                <Alert
                    type="success"
                    showIcon
                    message={t("found", {
                        block: result.blockNum.toLocaleString(),
                        number: result.trxInBlock + 1
                    })}
                    description={
                        <div className={styles.found}>
                            <span>
                                {t("operations", {
                                    list: result.opTypes.map(opName).join(", ")
                                })}
                            </span>
                            {result.via === "index" ? (
                                <span>
                                    {t("found_index", {host: INDEX_HOST})}
                                </span>
                            ) : null}
                            <TypedLink
                                to={`/block/${result.blockNum}/${result.trxInBlock}`}
                            >
                                {t("open_block")}
                            </TypedLink>
                        </div>
                    }
                />
            );
        case "pending":
            return (
                <Alert
                    type="info"
                    showIcon
                    message={t("pending")}
                    description={t("pending_until", {
                        time: chainTime(result.expiration)
                    })}
                />
            );
        case "lost":
            return (
                <Alert
                    type="warning"
                    showIcon
                    message={t("lost", {
                        blocks: result.blocks.toLocaleString()
                    })}
                    description={t("pending_until", {
                        time: chainTime(result.expiration)
                    })}
                />
            );
        case "unverified":
            return (
                <Alert
                    type="warning"
                    showIcon
                    message={t("unverified", {
                        host: INDEX_HOST,
                        block: result.blockNum.toLocaleString()
                    })}
                />
            );
        case "index_unreachable":
            return (
                <Alert
                    type="warning"
                    showIcon
                    message={t("index_unreachable", {host: INDEX_HOST})}
                    description={result.message}
                />
            );
        case "stopped":
            return <Alert type="info" showIcon message={t("stopped")} />;
        default:
            return (
                <Alert
                    type="info"
                    showIcon
                    message={t("not_found")}
                    description={t("not_found_why")}
                />
            );
    }
}
