// TypeScript/functional-component port of the legacy PasswordSettings.jsx
// (Phase 2, docs/UI_MIGRATION_PLAN.md). Trivial wrapper only - the actual
// password-change logic lives entirely in WalletChangePassword (untouched,
// still a .jsx file, out of scope here). Wallet-security-sensitive tier
// per AGENTS.md, handled last with extra care - minimal diff since this
// file itself never touches key material.
import * as React from "react";
import WalletChangePassword from "../Wallet/WalletChangePassword";

export default function PasswordSettings() {
    return <WalletChangePassword />;
}
