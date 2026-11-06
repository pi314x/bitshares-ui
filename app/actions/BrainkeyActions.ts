// TypeScript port of the legacy BrainkeyActions.js (Phase 5,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes. Security-
// sensitive per AGENTS.md (carries the raw brainkey phrase as an action
// payload) - the brainkey passes through unchanged, never logged.
//
// Phase 9 update (docs/UI_MIGRATION_PLAN.md, batch 7): replaces Alt's
// dispatcher with a direct call into `BrainkeyStoreFactory
// .notifySetBrainkey(brnkey)`, which broadcasts to every currently
// -registered `BrainkeyStore` instance - see that file's header for why
// (the original's `bindListeners` had every per-name instance bind the
// same shared action, so a real dispatch always broadcast to all of
// them too, not just one).
import BrainkeyStoreFactory from "stores/BrainkeyStore";

class BrainkeyActionsFacade {
    setBrainkey(brnkey: string) {
        (BrainkeyStoreFactory as any).notifySetBrainkey(brnkey);
        return brnkey;
    }
}

const BrainkeyActionsWrapped = new BrainkeyActionsFacade();
export default BrainkeyActionsWrapped;
