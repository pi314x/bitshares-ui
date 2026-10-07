// TypeScript/functional-component port of the legacy FeesContainer.jsx
// (Blockchain/ batch 1, docs/UI_MIGRATION_PLAN.md). Mechanical, no logic
// changes intended.
//
// The original existed only to inject `settings` (a static, non-function
// value evaluated once at `render()` time) from `SettingsStore` into
// `Fees` via `AltContainer`'s `inject` prop, and to re-render whenever
// `SettingsStore` changed (`stores={[SettingsStore]}`). Both are covered
// here by this migration's standard `useAltStore` adapter hook
// (`app/next/hooks/useAltStore.ts`), the same replacement already used
// for every other plain `AltContainer`-wrapping `*Container.jsx` in this
// codebase (e.g. `Explorer/Assets.tsx`), which additionally makes the
// injected value always current rather than only refreshed when the
// parent re-renders - a strict improvement over the original's
// stale-until-remount quirk, not a behavior this file's only real caller
// (`Explorer.tsx`'s tab list, which mounts `<FeesContainer />` with no
// props) could ever observe as a regression.
//
// Not security-sensitive per AGENTS.md: grepped for `WalletApi`,
// `WalletDb`, `ApplicationApi`, `.add_type_operation`, `process_transaction`
// - none appear anywhere in this file or in `Fees.jsx`; both are read-only
// fee-schedule display components.
import * as React from "react";
import SettingsStore from "stores/SettingsStore";
import {useAltStore} from "../../next/hooks/useAltStore";
import Fees from "./Fees";

export default function FeesContainer(props: Record<string, any>) {
    const settingsState = useAltStore<any>(SettingsStore);

    return <Fees {...props} settings={settingsState.settings} />;
}
