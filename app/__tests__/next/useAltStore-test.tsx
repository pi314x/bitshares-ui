import * as React from "react";
import {render, act} from "@testing-library/react";
import {useAltStore, AltStore} from "../../next/hooks/useAltStore";

function makeFakeStore<T>(initial: T): AltStore<T> & {emit: (next: T) => void} {
    let state = initial;
    const listeners: Array<() => void> = [];
    return {
        getState: () => state,
        listen: cb => listeners.push(cb),
        unlisten: cb => {
            const i = listeners.indexOf(cb);
            if (i !== -1) listeners.splice(i, 1);
        },
        emit: next => {
            state = next;
            listeners.slice().forEach(cb => cb());
        }
    };
}

function Probe({store}: {store: AltStore<{count: number}>}) {
    const state = useAltStore(store);
    return <span data-testid="count">{state.count}</span>;
}

describe("useAltStore", () => {
    it("reads the store's initial state", () => {
        const store = makeFakeStore({count: 1});
        const {getByTestId} = render(<Probe store={store} />);
        expect(getByTestId("count").textContent).toBe("1");
    });

    it("re-renders when the store emits a change", () => {
        const store = makeFakeStore({count: 1});
        const {getByTestId} = render(<Probe store={store} />);
        act(() => {
            store.emit({count: 2});
        });
        expect(getByTestId("count").textContent).toBe("2");
    });

    it("stops listening on unmount", () => {
        const store = makeFakeStore({count: 1});
        const {unmount} = render(<Probe store={store} />);
        unmount();
        // Emitting after unmount must not throw (no dangling listener
        // touching an unmounted component's state).
        expect(() => store.emit({count: 99})).not.toThrow();
    });
});
