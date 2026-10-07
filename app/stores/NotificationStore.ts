// Redux-backed replacement for the Alt.js NotificationStore
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../store/reduxStore.ts`'s
// header for the overall migration approach). Preserves the exact
// Alt-store interface every call site already relies on -
// `getState().notification`, `listen(callback)`, `unlisten(callback)` -
// so `App.jsx` (still a direct `.listen()`/`.unlisten()`/`.getState()`
// caller) and any `useAltStore(NotificationStore)` hook caller keep
// working completely unchanged.
import {reduxStore} from "../store/reduxStore";
import {selectNotification} from "../store/slices/notificationSlice";

class NotificationStoreFacade {
    private unsubscribers = new Map<() => void, () => void>();

    getState() {
        return {notification: selectNotification(reduxStore.getState())};
    }

    listen(callback: () => void) {
        let previous = selectNotification(reduxStore.getState());
        const unsubscribe = reduxStore.subscribe(() => {
            const next = selectNotification(reduxStore.getState());
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
}

export default new NotificationStoreFacade();
