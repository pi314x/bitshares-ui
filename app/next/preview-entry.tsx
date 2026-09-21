// Standalone mount point for reviewing `app/next` screens (screenshots,
// visual review) without booting the legacy app shell, which blocks on a
// live blockchain connection before rendering anything (see AppInit.jsx).
// Not part of the real app bundle — built separately via
// `yarn build-preview` / webpack.preview.config.js.
import * as React from "react";
import * as ReactDOM from "react-dom";
import {MemoryRouter} from "react-router-dom";
import NextShell from "./NextShell";
import {Button} from "../design-system/Button";
import {useTheme} from "../design-system/ThemeProvider";

// Static preview data: deliberately NOT NextShellContainer, which reads the
// real Alt.js stores and pulls in bitsharesjs's whole dependency graph (see
// NextShellContainer.tsx's comment) — this harness stays fast and isolated
// by rendering the presentational NextShell directly with representative
// fixture data instead.
const PREVIEW_NAV_GROUPS = [
    {
        label: "Account",
        items: [
            {label: "Dashboard", to: "/", exact: true},
            {label: "Accounts", to: "/accounts"},
            {label: "Settings", to: "/settings"}
        ]
    },
    {
        label: "Markets",
        items: [
            {label: "Trade", to: "/market/BTS_CNY"},
            {label: "Liquidity pools", to: "/pools"},
            {label: "Explorer", to: "/explorer"}
        ]
    }
];

function PreviewThemeToggle() {
    const {theme, toggleTheme} = useTheme();
    return (
        <Button variant="accent" onClick={toggleTheme}>
            Switch to {theme === "dark" ? "light" : "dark"} theme
        </Button>
    );
}

function PreviewContent() {
    return (
        <>
            <h1>BitShares — new UI shell</h1>
            <p style={{color: "var(--muted)"}}>
                Standalone preview with static fixture data (see
                preview-entry.tsx) — the real app renders this shell through{" "}
                <code>NextShellContainer</code> with live store data instead.
                See <code>docs/UI_MIGRATION_PLAN.md</code>.
            </p>
            <PreviewThemeToggle />
        </>
    );
}

// MemoryRouter, not BrowserRouter: this preview never navigates for real
// (no legacy route components are mounted here), it just needs a Router
// ancestor for Rail's <NavLink> to read the current location from.
const mountNode = document.getElementById("preview-root");
ReactDOM.render(
    <MemoryRouter initialEntries={["/"]}>
        <NextShell
            navGroups={PREVIEW_NAV_GROUPS}
            connectionStatus="open"
            activeNode="wss://node.xbts.io/ws"
            nodeSelector={
                <div style={{fontSize: 12, color: "var(--faint)"}}>
                    (real node selector — components/Utility/NodeSelector —
                    omitted here, see NextShellContainer)
                </div>
            }
            currentAccount="init0"
            accounts={["init0", "init1", "committee-account"]}
            onSelectAccount={() => {}}
            locked={true}
            onToggleLock={() => {}}
            currentLocale="en"
            locales={["en", "de", "fr", "ja"]}
            onSelectLocale={() => {}}
            onShowSend={() => {}}
            onShowDeposit={() => {}}
            onShowWithdraw={() => {}}
            content={<PreviewContent />}
        />
    </MemoryRouter>,
    mountNode
);
