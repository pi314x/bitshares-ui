// TypeScript/function-component port of the legacy NotifierContainer.jsx
// (Phase 8, docs/UI_MIGRATION_PLAN.md). Mechanical translation, no logic
// changes. Not security-sensitive per AGENTS.md (grepped for `WalletDb`/
// `WalletApi`/`Actions\.`/`ApplicationApi\.` - none appear).
//
// The original's `<AltContainer stores={[AccountStore]} inject={{account:
// () => AccountStore.getState().currentAccount}}><Notifier /></AltContainer>`
// (alt-container cloning its single child with an injected `account` prop)
// is replaced by `useReduxState(selectAccountState)`, this migration's established
// `AltContainer` -> hook translation (e.g. `FormattedPrice.tsx`), rendering
// `<Notifier account={...} />` directly instead of cloning a child - same
// observable result (`Notifier` receives the same `account` value either
// way).
import * as React from "react";
import Notifier from "./Notifier";
import {useReduxState} from "../../next/hooks/useReduxState";
import {selectAccountState} from "../../store/slices/accountSlice";

export default function NotifierContainer() {
    const accountState = useReduxState<any>(selectAccountState);

    return <Notifier account={accountState.currentAccount} />;
}
