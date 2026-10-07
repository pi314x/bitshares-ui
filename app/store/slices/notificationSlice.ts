// Redux Toolkit replacement for the Alt.js `NotificationStore`/
// `NotificationActions` pair (docs/UI_MIGRATION_PLAN.md, Phase 9 - see
// `../reduxStore.ts`'s header for the overall migration approach). Holds
// the exact same state shape the original Alt store did
// (`{notification: null}`), so `stores/NotificationStore.ts`'s facade can
// reproduce the original's `getState()` output verbatim.
import {createSlice, PayloadAction} from "@reduxjs/toolkit";

export interface NotificationState {
    notification: any;
}

const initialState: NotificationState = {
    notification: null
};

const notificationSlice = createSlice({
    name: "notification",
    initialState,
    reducers: {
        setNotification(state, action: PayloadAction<any>) {
            // Alt's own stores hold plain (often non-serializable, e.g.
            // Immutable.js-bearing) objects directly in state - RTK's
            // Immer wrapping is harmless here since `notification` is
            // always replaced wholesale, never deeply mutated.
            state.notification = action.payload;
        }
    }
});

export const {setNotification} = notificationSlice.actions;

export const selectNotification = (state: {notification: NotificationState}) =>
    state.notification.notification;

export default notificationSlice.reducer;
