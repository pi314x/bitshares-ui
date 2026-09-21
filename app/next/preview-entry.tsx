// Standalone mount point for reviewing `app/next` screens (screenshots,
// visual review) without booting the legacy app shell, which blocks on a
// live blockchain connection before rendering anything (see AppInit.jsx).
// Not part of the real app bundle — built separately via
// `yarn build-preview` / webpack.preview.config.js.
import * as React from "react";
import * as ReactDOM from "react-dom";
import {MemoryRouter} from "react-router-dom";
import NextShell from "./NextShell";

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

// MemoryRouter, not BrowserRouter: this preview never navigates for real
// (no legacy route components are mounted here), it just needs a Router
// ancestor for Rail's <NavLink> to read the current location from.
const mountNode = document.getElementById("preview-root");
ReactDOM.render(
    <MemoryRouter initialEntries={["/"]}>
        <NextShell
            navGroups={PREVIEW_NAV_GROUPS}
            connectionStatus="open"
            accountName="init0"
        />
    </MemoryRouter>,
    mountNode
);
