// Entry point for the strangler-fig rewrite (docs/UI_MIGRATION_PLAN.md,
// Phase 0/1). Mounted at /next behind the legacy app's router so the new
// design system can be built out and reviewed screen-by-screen without
// touching any existing route. Routes migrate out of `app/next` and into
// the normal route table (replacing their legacy counterpart) as each one
// reaches parity; nothing here is meant to stay at `/next` long-term.
import * as React from "react";
import {ThemeProvider, useTheme} from "../design-system/ThemeProvider";
import {Button} from "../design-system/Button";
import "../design-system/theme.scss";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-sans/700.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";

function ThemeToggle() {
    const {theme, toggleTheme} = useTheme();
    return (
        <Button variant="accent" onClick={toggleTheme}>
            Switch to {theme === "dark" ? "light" : "dark"} theme
        </Button>
    );
}

export default function NextShell(): JSX.Element {
    return (
        <ThemeProvider>
            <div style={{minHeight: "100vh", padding: 24}}>
                <h1>BitShares — new UI shell</h1>
                <p style={{color: "var(--muted)"}}>
                    Phase 0 scaffold: design-system tokens, theme switching
                    and a typed component (
                    <code>design-system/Button</code>) rendering through the
                    strangler-fig route at <code>/next</code>. See{" "}
                    <code>docs/UI_MIGRATION_PLAN.md</code>.
                </p>
                <ThemeToggle />
            </div>
        </ThemeProvider>
    );
}
