// "Delete local data": removes the wallet, its keys, the linked accounts and the saved
// preferences from this browser. Two approvals, in two steps: first the warning is read
// and the risk accepted, then the word DELETE is typed. Nothing is deleted before the
// second one. The blockchain is not touched; without a backup the keys are gone.
import * as React from "react";
import {Link} from "react-router-dom";
import counterpart from "counterpart";
import iDB from "idb-instance";
import {Modal} from "../../design-system/Modal";
import {Button} from "../../design-system/Button";
import {Alert} from "../../design-system/Alert";
import {Checkbox} from "../../design-system/Checkbox";
import {Input} from "../../design-system/Input";
import {
    CONFIRM_WORD,
    DeleteStep,
    LocalInventory,
    canContinue,
    canDelete,
    deleteLocalData,
    localInventory
} from "../../lib/common/deleteLocal";
import styles from "./DeleteLocalDialog.module.scss";

const t = (key: string, params?: Record<string, any>) =>
    counterpart.translate(
        `settings.local_data.delete.${key}`,
        params
    ) as string;

/** The databases the app has open, for browsers that cannot list them. */
function openDatabaseNames(): string[] {
    const names: string[] = [];
    try {
        const root = (iDB as any).root;
        if (root && root.database_name) names.push(root.database_name);
        const db = (iDB as any).instance().db();
        if (db && db.name) names.push(db.name);
    } catch (e) {
        // not initialised yet: nothing is open
    }
    return names;
}

function closeAppConnections() {
    const root = (iDB as any).root;
    if (root && root.db) root.close();
    iDB.close();
}

function browserEnvironment() {
    let storage: Storage | null = null;
    try {
        storage = window.localStorage;
    } catch (e) {
        // storage blocked by the browser
    }
    return {indexedDB: window.indexedDB, localStorage: storage};
}

export interface DeleteLocalDialogProps {
    visible: boolean;
    onCancel: () => void;
    /** After everything is deleted; the page reloads so nothing stale stays in memory. */
    onDeleted?: () => void;
}

export default function DeleteLocalDialog({
    visible,
    onCancel,
    onDeleted = () => window.location.reload()
}: DeleteLocalDialogProps) {
    const [step, setStep] = React.useState<DeleteStep>("warning");
    const [accepted, setAccepted] = React.useState(false);
    const [typed, setTyped] = React.useState("");
    const [inventory, setInventory] = React.useState<LocalInventory>({
        databases: [],
        storageKeys: []
    });
    const [busy, setBusy] = React.useState(false);
    const [problem, setProblem] = React.useState<string | null>(null);
    const mounted = React.useRef(true);
    React.useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    // opening the dialog always starts at the warning, with nothing approved
    React.useEffect(() => {
        if (!visible) return;
        setStep("warning");
        setAccepted(false);
        setTyped("");
        setProblem(null);
        setBusy(false);
        localInventory(browserEnvironment(), openDatabaseNames()).then(
            found => mounted.current && setInventory(found)
        );
    }, [visible]);

    const runDelete = React.useCallback(async () => {
        // both approvals are checked again where it counts
        if (!canContinue(accepted) || !canDelete(typed)) return;
        setBusy(true);
        setProblem(null);
        try {
            const env = browserEnvironment();
            const current = await localInventory(env, openDatabaseNames());
            const result = await deleteLocalData(env, current, {
                closeConnections: closeAppConnections
            });
            if (!mounted.current) return;
            if (result.blocked.length) {
                setBusy(false);
                setProblem(t("blocked"));
                return;
            }
            onDeleted();
        } catch (e) {
            if (!mounted.current) return;
            setBusy(false);
            setProblem(
                t("failed", {
                    reason: (e && (e as Error).message) || String(e)
                })
            );
        }
    }, [accepted, typed, onDeleted]);

    const footer =
        step === "warning" ? (
            <div className={styles.footer}>
                <Button onClick={onCancel}>
                    {counterpart.translate("operation_dialog.cancel")}
                </Button>
                <Button
                    variant="accent"
                    disabled={!canContinue(accepted)}
                    onClick={() => setStep("final")}
                >
                    {t("continue")}
                </Button>
            </div>
        ) : (
            <div className={styles.footer}>
                <Button
                    disabled={busy}
                    onClick={() => {
                        setStep("warning");
                        setTyped("");
                        setProblem(null);
                    }}
                >
                    {t("back")}
                </Button>
                <Button
                    className={styles.danger}
                    disabled={!canDelete(typed) || busy}
                    loading={busy}
                    onClick={runDelete}
                >
                    {t("confirm")}
                </Button>
            </div>
        );

    return (
        <Modal
            visible={visible}
            title={t("title")}
            onCancel={busy ? () => undefined : onCancel}
            width={520}
            footer={footer}
        >
            <div className={styles.body}>
                <p className={styles.step}>
                    {t("step", {step: step === "warning" ? 1 : 2})}
                </p>
                {step === "warning" ? (
                    <>
                        <Alert
                            type="warning"
                            showIcon
                            message={t("warn_title")}
                            description={t("warn_risk")}
                        />
                        <p className={styles.text}>{t("warn_intro")}</p>
                        <ul className={styles.list}>
                            <li>
                                {t("warn_wallet", {
                                    count: inventory.databases.length
                                })}
                            </li>
                            <li>{t("warn_accounts")}</li>
                            <li>
                                {t("warn_prefs", {
                                    count: inventory.storageKeys.length
                                })}
                            </li>
                        </ul>
                        <p className={styles.text}>{t("warn_stays")}</p>
                        <Link
                            className={styles.link}
                            to="/wallet/backup/create"
                            onClick={onCancel}
                        >
                            {t("backup_link")}
                        </Link>
                        <Checkbox
                            className={styles.accept}
                            checked={accepted}
                            onChange={e => setAccepted(e.target.checked)}
                        >
                            {t("accept")}
                        </Checkbox>
                    </>
                ) : (
                    <>
                        <Alert
                            type="error"
                            showIcon
                            message={t("final_title")}
                            description={t("final_text", {word: CONFIRM_WORD})}
                        />
                        <label className={styles.field}>
                            <span className={styles.label}>
                                {t("final_label", {word: CONFIRM_WORD})}
                            </span>
                            <Input
                                value={typed}
                                autoFocus
                                autoComplete="off"
                                autoCapitalize="characters"
                                spellCheck={false}
                                aria-label={t("final_label", {
                                    word: CONFIRM_WORD
                                })}
                                disabled={busy}
                                onChange={e => setTyped(e.target.value)}
                                onPressEnter={() => {
                                    if (canDelete(typed)) runDelete();
                                }}
                            />
                        </label>
                    </>
                )}
                {problem ? (
                    <Alert type="error" showIcon message={problem} />
                ) : null}
            </div>
        </Modal>
    );
}
