// Presentational shell for the strangler-fig rewrite
// (docs/UI_MIGRATION_PLAN.md, Phase 0/1): Rail + Topbar + content area.
// Takes its data as props rather than reading stores itself, on purpose —
// see NextShellContainer.tsx for why (it's the one that reads the real
// Alt.js stores and is what App.jsx actually mounts at /next).
import * as React from "react";
import {ThemeProvider, useTheme} from "../design-system/ThemeProvider";
import {Button} from "../design-system/Button";
import {Rail, RailNavGroup} from "../design-system/Rail";
import {Topbar} from "../design-system/Topbar";
import styles from "./NextShell.module.scss";
import "../design-system/theme.scss";
import "@fontsource/archivo/500.css";
import "@fontsource/archivo/600.css";
import "@fontsource/archivo/700.css";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";

export interface NextShellProps {
    navGroups: RailNavGroup[];
    /** BlockchainStore's `rpc_connection_status`, or null before it's known. */
    connectionStatus: string | null;
    accountName: string | null;
}

function ThemeToggle() {
    const {theme, toggleTheme} = useTheme();
    return (
        <Button variant="accent" onClick={toggleTheme}>
            Switch to {theme === "dark" ? "light" : "dark"} theme
        </Button>
    );
}

function ShellChrome({navGroups, connectionStatus, accountName}: NextShellProps) {
    return (
        <div className={styles.shell}>
            <Rail groups={navGroups} />
            <div className={styles.main}>
                <Topbar
                    crumb="Phase 1 shell preview"
                    connectionStatus={connectionStatus}
                    accountName={accountName}
                />
                <div className={styles.content}>
                    <h1>BitShares — new UI shell</h1>
                    <p style={{color: "var(--muted)"}}>
                        Phase 1 slice: the rail and topbar above read live
                        data from the same Alt.js stores
                        (<code>stores/AccountStore</code>,{" "}
                        <code>stores/BlockchainStore</code>) the legacy
                        Header/Footer use, via{" "}
                        <code>NextShellContainer</code> — not a mock. Nav
                        links go to real routes, and the rail collapses to a
                        horizontal strip below 860px. See{" "}
                        <code>docs/UI_MIGRATION_PLAN.md</code>.
                    </p>
                    <ThemeToggle />
                </div>
            </div>
        </div>
    );
}

export default function NextShell(props: NextShellProps): JSX.Element {
    return (
        <ThemeProvider>
            <ShellChrome {...props} />
        </ThemeProvider>
    );
}
