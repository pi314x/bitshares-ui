// TypeScript port of the legacy BackupStore.js (Phase 5,
// docs/UI_MIGRATION_PLAN.md). Mechanical, no logic changes. Same
// `extends (BaseStore as any)` treatment as BrainkeyStore.ts/
// ImportKeysStore.ts, since alt.createStore() injects setState/
// bindListeners/etc. at runtime, invisible to TS's structural inference
// from the untyped BaseStore.js.
import alt from "alt-instance";
import BackupActions from "actions/BackupActions";
import BaseStore from "stores/BaseStore";
import {hash, PublicKey} from "bitsharesjs";

class BackupStore extends (BaseStore as any) {
    state: any;

    constructor() {
        super();
        this.state = this._getInitialState();
        this.bindListeners({
            onIncommingFile: (BackupActions as any).incommingWebFile,
            onIncommingBuffer: (BackupActions as any).incommingBuffer,
            onReset: (BackupActions as any).reset
        });
        this._export("setWalletObjct");
    }

    _getInitialState() {
        return {
            name: null,
            contents: null,
            sha1: null,
            size: null,
            last_modified: null,
            public_key: null,
            wallet_object: null
        };
    }

    setWalletObjct(wallet_object: any) {
        this.setState({wallet_object});
    }

    onReset() {
        this.setState(this._getInitialState());
    }

    onIncommingFile({name, contents, last_modified}: any) {
        const sha1 = (hash as any).sha1(contents).toString("hex");
        const size = contents.length;
        const public_key = getBackupPublicKey(contents);
        this.setState({name, contents, sha1, size, last_modified, public_key});
    }

    onIncommingBuffer({name, contents, public_key}: any) {
        this.onReset();
        const sha1 = (hash as any).sha1(contents).toString("hex");
        const size = contents.length;
        if (!public_key) public_key = getBackupPublicKey(contents);
        this.setState({name, contents, sha1, size, public_key});
    }
}

export const BackupStoreWrapped: any = (alt as any).createStore(
    BackupStore,
    "BackupStore"
);
export default BackupStoreWrapped;

function getBackupPublicKey(contents: any) {
    try {
        return (PublicKey as any).fromBuffer(contents.slice(0, 33));
    } catch (e) {
        console.error(e, (e as any).stack);
    }
}
