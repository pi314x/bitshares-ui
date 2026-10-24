// Redux-backed replacement for the Alt.js CachedPropertyStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../store/reduxStore.ts`'s
// header for the overall migration approach). Tier 2 by association
// (depended on by `PrivateKeyStore`) but not itself key material - a
// generic IndexedDB-backed key/value cache.
//
// Preserves the exact interface every call site relies on - `getState()
// .props`, `listen(callback)`, `unlisten(callback)`, and the two
// directly-callable methods the original `_export()`ed (`get`, `reset` -
// not Alt-dispatched, called straight on the store singleton) - plus
// `onSet`/`onGet`, now plain public methods here (rather than
// bindListeners-private) so `../actions/CachedPropertyActions.ts` can
// call them directly at the point Alt's dispatcher used to trigger them.
//
// `onSet` keeps a `pendingProps` mirror, matching the original's own
// `this.state.props = props` synchronous assignment that happened
// *before* the async `iDB.setCachedProperty(...)` write resolved (only
// the listener-visible `this.setState(...)` - here, the Redux dispatch -
// waited on that write). Without it, two `onSet` calls for the same
// name/value in quick succession (before the first write resolves)
// would both pass the `props.get(name) === value` guard and both hit
// IndexedDB, instead of the second being short-circuited like the
// original did.
import {reduxStore} from "../store/reduxStore";
import iDB from "idb-instance";
import {
    setProps,
    resetCachedProperty,
    selectCachedPropertyState
} from "../store/slices/cachedPropertySlice";

class CachedPropertyStoreFacade {
    private unsubscribers = new Map<() => void, () => void>();
    private pendingProps: any = null;

    getState() {
        return selectCachedPropertyState(reduxStore.getState());
    }

    listen(callback: () => void) {
        let previous = selectCachedPropertyState(reduxStore.getState());
        const unsubscribe = reduxStore.subscribe(() => {
            const next = selectCachedPropertyState(reduxStore.getState());
            if (next !== previous) {
                previous = next;
                callback();
            }
        });
        this.unsubscribers.set(callback, unsubscribe);
    }

    unlisten(callback: () => void) {
        const unsubscribe = this.unsubscribers.get(callback);
        if (unsubscribe) {
            unsubscribe();
            this.unsubscribers.delete(callback);
        }
    }

    get(name: string) {
        return this.onGet({name});
    }

    onSet({name, value}: {name: string; value: any}) {
        const props = this.pendingProps || this.getState().props;
        if (props.get(name) === value) return;
        const newProps = props.set(name, value);
        this.pendingProps = newProps;
        (iDB as any).setCachedProperty(name, value).then(() => {
            this.pendingProps = null;
            reduxStore.dispatch(setProps(newProps));
        });
    }

    onGet({name}: {name: string}) {
        const props = this.getState().props;
        const value = props.get(name);
        if (value !== undefined) return value;
        try {
            (iDB as any).getCachedProperty(name, null).then((value: any) => {
                const newProps = this.getState().props.set(name, value);
                reduxStore.dispatch(setProps(newProps));
            });
        } catch (err) {
            console.error("getCachedProperty error:", err);
        }
    }

    reset() {
        reduxStore.dispatch(resetCachedProperty());
    }
}

export default new CachedPropertyStoreFacade();
