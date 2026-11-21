// Phase 9 (docs/UI_MIGRATION_PLAN.md): plain singleton replacing the real
// Alt `alt.createActions(LogsActions)` wrapper - grep-confirmed no store
// ever bound to this class, both methods already return Promises (never
// dispatched by Alt either way), so this is a pure mechanical drop of
// the Alt wrapping with zero logic changes.
import ls from "common/localStorage";

const STORAGE_KEY = "__graphene__";
let ss = ls(STORAGE_KEY);

class LogsActions {
    async setLog(log) {
        return await ss.set("logs", JSON.stringify(log));
    }
    getLogs() {
        return new Promise(resolve => {
            try {
                resolve(JSON.parse(ss.get("logs", [])));
            } catch (err) {
                resolve(["Error loading logs from localStorage"]);
            }
        });
    }
}

export default new LogsActions();
