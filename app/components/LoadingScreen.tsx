import * as React from "react";
import counterpart from "counterpart";
import styles from "./LoadingScreen.module.scss";
import {Ring} from "./LoadingIndicator";

export type LoadingStage = "latency" | "connect" | "database";

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
    children?: React.ReactNode;
}

export function LoadingScreen({
    status,
    server,
    theme,
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
    return (
        <div className={styles.screen} role="status" aria-live="polite">
            <span className={styles.ringWrap}>
                <Ring />
            </span>
            <h1 className={styles.title}>
                {counterpart.translate("app_init.loading_title")}
            </h1>
            <ol className={styles.steps}>
                {ORDER.map((id, index) => (
                    <li
                        key={id}
                        className={[
                            styles.step,
                            index < current ? styles.done : "",
                            index === current ? styles.active : ""
                        ]
                            .filter(Boolean)
                            .join(" ")}
                        aria-current={index === current ? "step" : undefined}
                    >
                        <span className={styles.mark} aria-hidden="true" />
                        {labels[id]}
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
