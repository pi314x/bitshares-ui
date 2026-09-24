// TypeScript port of the legacy ImportKeysStore.js (Phase 5,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes - a single
// boolean flag, no key material.
import alt from "alt-instance";
import BaseStore from "stores/BaseStore";

class ImportKeysStore extends (BaseStore as any) {
    state: any;

    constructor() {
        super();
        this.state = this._getInitialState();
        this._export("importing");
    }

    _getInitialState() {
        return {importing: false};
    }

    importing(importing: boolean) {
        this.setState({importing});
    }
}

export const ImportKeysStoreWrapped: any = (alt as any).createStore(
    ImportKeysStore,
    "ImportKeysStore"
);
export default ImportKeysStoreWrapped;
