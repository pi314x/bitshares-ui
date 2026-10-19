import * as React from "react";
import counterpart from "counterpart";
import styles from "./LoadingScreen.module.scss";
import {Ring} from "./LoadingIndicator";
import {
    LOCAL_STEP_ORDER,
    describeLocalStep,
    getLocalSteps,
    subscribeLocalSteps
} from "../lib/common/startupProgress";

export type LoadingStage = "latency" | "connect" | "database";

type RowState = "pending" | "active" | "done" | "failed";

const ORDER: LoadingStage[] = ["latency", "connect", "database"];

// The status line is free text from routerTransition (already translated), so
// the stage is read off its fixed leading words, taken from the same locale
// strings with the placeholders cut out.
const MARK = "\u0000";
const beforePlaceholder = (key: string, params: {[k: string]: string} = {}) =>
    String(counterpart.translate(key, params))
        .split(MARK)[0]
        .trim();

export function stageFromStatus(
    status: string | null | undefined
): LoadingStage {
    const text = (status || "").trim();
    if (!text) return "latency";
    const mark = {server: MARK, pinged: MARK, totalToPing: MARK};
    const starts = (key: string) => {
        const lead = beforePlaceholder(key, mark);
        return lead.length > 0 && text.startsWith(lead);
    };
    if (starts("app_init.database")) return "database";
    if (starts("app_init.connecting")) return "connect";
    return "latency";
}

interface LoadingScreenProps {
    status?: string | null;
    server?: string | null;
    /** The legacy `themes` setting ("lightTheme" | "darkTheme" | "midnightTheme"). */
    theme?: string | null;
    /** The app is ready: fade out (the owner removes it a moment later). */
    leaving?: boolean;
    children?: React.ReactNode;
}

export function LoadingScreen({
    status,
    server,
    theme,
    leaving,
    children
}: LoadingScreenProps) {
    // The shell's ThemeProvider is not mounted yet, so set the tokens' theme
    // here, or a light-theme user gets a dark start-up screen.
    React.useEffect(() => {
        document.documentElement.setAttribute(
            "data-theme",
            theme === "lightTheme" ? "light" : "dark"
        );
    }, [theme]);
    const stage = stageFromStatus(status);
    const current = ORDER.indexOf(stage);
    const labels: {[k in LoadingStage]: string} = {
        latency: counterpart.translate("app_init.step_latency") as string,
        connect: counterpart.translate("app_init.step_connect") as string,
        database: counterpart.translate("app_init.step_database") as string
    };
    // What has been read from this device (the local database, the settings, the
    // keys stored in this browser, the wallet, the accounts) is part of the same
    // sequence, after the connection: one list, in the order it happens.
    const local = React.useSyncExternalStore(
        subscribeLocalSteps,
        getLocalSteps,
        getLocalSteps
    );
    type Row = {id: string; text: string; state: RowState};
    const rows: Row[] = [
        ...(["latency", "connect"] as LoadingStage[]).map(id => {
            const index = ORDER.indexOf(id);
            return {
                id,
                text: labels[id],
                state: (index < current
                    ? "done"
                    : index === current
                    ? "active"
                    : "pending") as RowState
            };
        }),
        ...LOCAL_STEP_ORDER.map(id => {
            const step = local[id];
            const {key, params} = describeLocalStep(id, step);
            return {
                id,
                text: counterpart.translate(key, params) as string,
                state: (step.state === "none" ? "done" : step.state) as RowState
            };
        })
    ];
    // the line the screen is at: the first that is not done (none, once all are)
    const activeRow = rows.find(row => row.state !== "done");
    const activeId = activeRow ? activeRow.id : null;
    return (
        <div
            className={`${styles.screen}${leaving ? ` ${styles.leaving}` : ""}`}
            role="status"
            aria-live="polite"
        >
            <span className={styles.ringWrap}>
                <Ring />
            </span>
            <h1 className={styles.title}>
                {counterpart.translate("app_init.loading_title")}
            </h1>
            <ol className={styles.steps}>
                {rows.map(row => (
                    <li
                        key={row.id}
                        className={[
                            styles.step,
                            row.state === "done" ? styles.done : "",
                            row.state === "active" || row.id === activeId
                                ? styles.active
                                : "",
                            row.state === "failed" ? styles.failed : ""
                        ]
                            .filter(Boolean)
                            .join(" ")}
                        data-state={row.state}
                        aria-current={row.id === activeId ? "step" : undefined}
                    >
                        <span className={styles.mark} aria-hidden="true" />
                        {row.text}
                    </li>
                ))}
            </ol>
            {status ? <p className={styles.detail}>{status}</p> : null}
            {server ? (
                <p className={styles.detail}>
                    {counterpart.translate("app_init.node_label")}{" "}
                    <strong>{server}</strong>
                </p>
            ) : null}
            {children}
        </div>
    );
}

export default LoadingScreen;
