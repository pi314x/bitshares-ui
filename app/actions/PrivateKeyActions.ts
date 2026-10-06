// Redux-backed replacement for the Alt.js PrivateKeyActions
// (docs/UI_MIGRATION_PLAN.md, Phase 9 batch 8 - see
// `../store/reduxStore.ts`'s header for the overall migration approach).
// Preserves the exact method names and return values (both methods
// return a real Promise, matching the original's "returned promise is
// deprecated" thunk pattern - `WalletDb.ts`'s `saveKey()` still awaits
// `addKey(...)`'s resolved `{result, id}` shape).
//
// Cross-store notification: the original had BOTH `PrivateKeyStore` and
// `AccountRefsStore` bind a listener to `addKey` (Alt's dispatcher fires
// every listener bound to an action regardless of which store owns it).
// `addKey` here calls both stores' handlers directly, in the same
// relative order a real Alt dispatch would have (store registration
// order is not behaviorally significant here - `AccountRefsStore
// .onAddPrivateKey` only reads `ChainStore` state synchronously, it
// never depends on `PrivateKeyStore.onAddKey`'s result).
import privateKeyStore from "../stores/PrivateKeyStore";
import accountRefsStore from "../stores/AccountRefsStore";

class PrivateKeyActionsFacade {
    addKey(private_key_object: any, transaction: any): Promise<any> {
        // returned promise is deprecated
        return new Promise(resolve => {
            (privateKeyStore as any).onAddKey({
                private_key_object,
                transaction,
                resolve
            });
            (accountRefsStore as any).onAddPrivateKey({private_key_object});
        });
    }

    loadDbData(): Promise<any> {
        // returned promise is deprecated
        return new Promise(resolve => {
            (privateKeyStore as any).onLoadDbData(resolve);
        });
    }
}

export default new PrivateKeyActionsFacade();
