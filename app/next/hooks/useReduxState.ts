// Reads a piece of the Redux store from a component, re-rendering when (and
// only when) the selected value changes. This is what `useReduxState` did for a
// store facade, minus the facade: the component names the slice selector
// itself (`useReduxState(selectSettingsState)`), so the data flow is visible at
// the call site and there is no second copy of the state in `useState`.
//
// It is `useSyncExternalStore` on the singleton `reduxStore`, which is what
// react-redux's own `useSelector` is built on, but it does not need a
// `<Provider>` above the component. `AppInit` mounts the Provider, yet the
// design-system showcases, the standalone preview and every component test
// render a screen without one.
//
// The selector must return a stable reference while the slice has not changed
// (every `select*` in `app/store/slices` is a plain property read). A selector
// that builds a new object on each call would make React re-render forever.
import {useSyncExternalStore} from "react";
import {reduxStore, RootState} from "../../store/reduxStore";

export function useReduxState<T>(selector: (state: RootState) => T): T {
    return useSyncExternalStore(reduxStore.subscribe, () =>
        selector(reduxStore.getState())
    );
}
