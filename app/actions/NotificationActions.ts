// Redux-backed replacement for the Alt.js NotificationActions
// (docs/UI_MIGRATION_PLAN.md, Phase 9 - see `../store/reduxStore.ts`'s
// header for the overall migration approach). Preserves the exact
// method names and the exact `normalize()` logic the original action
// creators ran, dispatching straight into the Redux store instead of
// going through Alt's dispatcher/`bindListeners` - every call site
// (`addNotification`/`success`/`error`/`warning`/`info`) keeps working
// completely unchanged.
import {reduxStore} from "../store/reduxStore";
import {setNotification} from "../store/slices/notificationSlice";

const normalize = (notification: any, level?: string) => {
    if (typeof notification == "string") notification = {message: notification};
    if (level) notification.level = level;
    // Adjust the css position for notices.. bottom messages can't be seen
    //if(notification.level === "success" && ! notification.position)
    //    notification.position = 'br' //bottom right
    return notification;
};

class NotificationActionsFacade {
    addNotification(notification: any) {
        notification = normalize(notification);
        reduxStore.dispatch(setNotification(notification));
        return notification;
    }

    // Creating aliases: success, error, warning and info

    success(notification: any) {
        notification = normalize(notification, "success");
        reduxStore.dispatch(setNotification(notification));
        return notification;
    }

    error(notification: any) {
        notification = normalize(notification, "error");
        reduxStore.dispatch(setNotification(notification));
        return notification;
    }

    warning(notification: any) {
        notification = normalize(notification, "warning");
        reduxStore.dispatch(setNotification(notification));
        return notification;
    }

    info(notification: any) {
        notification = normalize(notification, "info");
        reduxStore.dispatch(setNotification(notification));
        return notification;
    }
}

export default new NotificationActionsFacade();
