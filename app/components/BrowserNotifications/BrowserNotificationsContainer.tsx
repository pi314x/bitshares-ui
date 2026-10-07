// TypeScript/functional-component port of the legacy
// BrowserNotificationsContainer.jsx (Phase 8, docs/UI_MIGRATION_PLAN.md).
//
// Not security-sensitive: this file only wires `AccountStore`/
// `SettingsStore` state into `BrowserNotifications` (see that file's own
// header comment for why it isn't security-sensitive either).
//
// Structural change: the original was two components - an `AltContainer`
// (listening only to `AccountStore`, via `stores={[AccountStore]}`) whose
// `inject` object populated both `account` (`AccountStore`'s
// `currentAccount`) and `settings` (`SettingsStore`'s `settings`), plus a
// tiny functional `Wrapper` that rendered `<BrowserNotifications {...props}
// />` only when `props.account` was truthy (else `null`). Both collapse
// into this single function component.
//
// Preserved quirk: `stores={[AccountStore]}` means the original's
// `AltContainer` only re-ran its `inject` getters (and thus only ever
// picked up a *new* `settings` value) when `AccountStore` fired a change
// event (or this tree re-rendered for some unrelated reason) -
// `SettingsStore` was never itself registered as a trigger. Reproduced
// here by subscribing to `AccountStore` via `useAltStore` (so this
// component re-renders on every `AccountStore` change) but reading
// `SettingsStore.getState().settings` as a plain, non-subscribed call
// during render - a `SettingsStore`-only change does not, by itself,
// cause this component (or anything downstream of it) to re-render or
// re-propagate the new settings, exactly as before.
import * as React from "react";
import AccountStore from "stores/AccountStore";
import SettingsStore from "stores/SettingsStore";
import {useAltStore} from "../../next/hooks/useAltStore";
import BrowserNotifications from "./BrowserNotifications";

export default function BrowserNotificationsContainer() {
    const accountState = useAltStore<any>(AccountStore as any);
    const account = accountState.currentAccount;
    const settings = (SettingsStore as any).getState().settings;

    if (!account) return null;

    return <BrowserNotifications account={account} settings={settings} />;
}
