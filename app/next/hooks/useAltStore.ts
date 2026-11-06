// Adapter between a component and a legacy flux-style store object
// (`getState()` / `listen()` / `unlisten()`).
//
// Components read the Redux-backed stores with `useReduxState(selectX)`
// instead (`./useReduxState.ts`). This hook is what remains for the two cases
// that are not a single Redux slice selector:
//   - `WalletDb`, whose state is a plain object that it mutates in place and
//     announces through a version counter (`WalletUnlockModal.tsx`);
//   - per-name `BrainkeyStore` instances (`Wallet/Brainkey.tsx`).
// Both hold wallet material, so they were deliberately left as they were.
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
