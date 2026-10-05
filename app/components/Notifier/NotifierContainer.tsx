// TypeScript/function-component port of the legacy NotifierContainer.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical translation, no logic
// changes. Not security-sensitive per AGENTS.md (grepped for `WalletDb`/
// `WalletApi`/`Actions\.`/`ApplicationApi\.` - none appear).
//
// The original's `<AltContainer stores={[AccountStore]} inject={{account:
// () => AccountStore.getState().currentAccount}}><Notifier /></AltContainer>`
// (alt-container cloning its single child with an injected `account` prop)
// is replaced by `useAltStore(AccountStore)`, this migration's established
// `AltContainer` -> hook translation (e.g. `FormattedPrice.tsx`), rendering
// `<Notifier account={...} />` directly instead of cloning a child - same
// observable result (`Notifier` receives the same `account` value either
// way).
import * as React from "react";
import AccountStore from "stores/AccountStore";
import Notifier from "./Notifier";
import {useAltStore} from "../../next/hooks/useAltStore";

export default function NotifierContainer() {
    const accountState = useAltStore<any>(AccountStore as any);

    return <Notifier account={accountState.currentAccount} />;
}
