// TypeScript port of the legacy BrainkeyActions.js (Phase 5,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes. Security-
// sensitive per AGENTS.md (carries the raw brainkey phrase as an Alt.js
// action payload) - the brainkey passes through unchanged, never logged.
import alt from "alt-instance";

class BrainkeyActions {
    setBrainkey(brnkey: string) {
        return brnkey;
    }
}

const BrainkeyActionsWrapped: any = (alt as any).createActions(
    BrainkeyActions
);
export default BrainkeyActionsWrapped;
