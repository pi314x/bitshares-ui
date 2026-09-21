// Adapter between the new component tree and the legacy Alt.js flux
// stores (docs/UI_MIGRATION_PLAN.md §6.2: "Adapter layer, not a parallel
// backend"). New components read the SAME account/connection/settings data
// the legacy Header/Footer read, through this hook, rather than duplicating
// it — so there is one source of truth while both stacks are live.
import * as React from "react";

export interface AltStore<T> {
    getState(): T;
    listen(callback: () => void): void;
    unlisten(callback: () => void): void;
}

export function useAltStore<T>(store: AltStore<T>): T {
    const [state, setState] = React.useState(() => store.getState());

    React.useEffect(() => {
        const onChange = () => setState(store.getState());
        store.listen(onChange);
        // Re-sync in case the store changed between render and this effect.
        onChange();
        return () => store.unlisten(onChange);
    }, [store]);

    return state;
}
