// Real data wiring for NextShell (docs/UI_MIGRATION_PLAN.md, Phase 1). This
// is what App.jsx actually mounts at /next — reads the same legacy Alt.js
// stores Layout/Header.jsx and Layout/Footer.jsx read (the adapter pattern
// from §6.2), then hands the results to the presentational NextShell as
// props. Kept separate from NextShell itself so the standalone preview
// harness (app/next/preview-entry.tsx, webpack.preview.config.js) can
// render NextShell with static data without pulling in bitsharesjs and the
// rest of the legacy store graph — that's a lot of weight and Node
// polyfill config for a tool whose whole point is being a fast, isolated
// way to review a screen's UI.
import * as React from "react";
import NextShell from "./NextShell";
import {RailNavGroup} from "../design-system/Rail";
import {useAltStore} from "./hooks/useAltStore";
// Untyped legacy Alt.js stores / module (no .d.ts yet) — resolved via
// tsconfig's baseUrl the same way webpack resolves them via resolve.modules.
import AccountStore from "stores/AccountStore";
import BlockchainStore from "stores/BlockchainStore";
import {getDefaultMarket} from "branding";

interface AccountStoreState {
    currentAccount: string | null;
    passwordAccount: string | null;
}

interface BlockchainStoreState {
    rpc_connection_status: string | null;
}

const NAV_GROUPS: RailNavGroup[] = [
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
            {label: "Trade", to: `/market/${getDefaultMarket()}`},
            {label: "Liquidity pools", to: "/pools"},
            {label: "Explorer", to: "/explorer"}
        ]
    }
];

export default function NextShellContainer(): JSX.Element {
    const account = useAltStore<AccountStoreState>(AccountStore);
    const blockchain = useAltStore<BlockchainStoreState>(BlockchainStore);

    return (
        <NextShell
            navGroups={NAV_GROUPS}
            accountName={account.currentAccount || account.passwordAccount}
            connectionStatus={blockchain.rpc_connection_status}
        />
    );
}
